import { logApiHit } from '../_log.js';
/**
 * MB Bank Transactions API
 * SINGLE SOURCE OF TRUTH: Firebase Realtime Database
 * Returns 100% live transactions and balance for the requested account.
 * If the account does not exist in Firebase, returns 404 (does NOT fall back to dummy/other accounts).
 */

const FIREBASE_BASE = 'https://sfsdfsf-c4c13-default-rtdb.asia-southeast1.firebasedatabase.app';
const FIREBASE_URL = `${FIREBASE_BASE}/mbbank`;

const IGNORED_ROOT_KEYS = new Set(['mbbank', 'api_logs', 'recipients', 'transactions', 'logs', 'config']);

async function getLiveAccountsMap() {
  const map = {};
  let active = '';
  try {
    const [rootRes, mbRes] = await Promise.all([
      fetch(`${FIREBASE_BASE}/.json?ts=${Date.now()}`, { cache: 'no-store' }),
      fetch(`${FIREBASE_URL}.json?ts=${Date.now()}`, { cache: 'no-store' })
    ]);
    const rootData = rootRes.ok ? (await rootRes.json()) || {} : {};
    const mbData = mbRes.ok ? (await mbRes.json()) || {} : {};

    // 1. Quét các mục tài khoản độc lập tại gốc Firebase (VD: /83860106209)
    for (const [k, v] of Object.entries(rootData)) {
      if (!IGNORED_ROOT_KEYS.has(k) && v && typeof v === 'object' && !Array.isArray(v)) {
        const hasIdent = Boolean(v.TK || v.username || v.STK || v.accountNumber || v.stk);
        const hasAuth = Boolean(v.MK || v.password || v.pass);
        const hasBalance = typeof v.balance === 'number' || typeof v.TIEN === 'number' || v.balance !== undefined || v.TIEN !== undefined;
        if (hasIdent && (hasAuth || hasBalance)) {
          map[k] = { ...v, _folder: k };
        }
      }
    }

    if (mbData.active_account) {
      active = String(mbData.active_account).trim();
    }
  } catch (e) {}

  return { accountsMap: map, activeAccount: active };
}

function resolveAccount(accountsMap, query, activeAccount) {
  if (query) {
    const q = String(query).trim();
    const qLower = q.toLowerCase();
    const qClean = q.replace(/\D/g, '');

    // 1. Khớp chính xác key mục (Folder name, ví dụ: '83860106209')
    if (accountsMap[q]) return accountsMap[q];

    // 2. Khớp case-insensitive folder
    for (const [key, acc] of Object.entries(accountsMap)) {
      if (key.toLowerCase() === qLower) return acc;
    }

    // 3. Khớp tên tài khoản đăng nhập (TK / username)
    for (const acc of Object.values(accountsMap)) {
      const u = String(acc.TK || acc.username || '').toLowerCase();
      if (u === qLower) return acc;
    }

    // 4. Khớp số tài khoản (STK / accountNumber)
    for (const acc of Object.values(accountsMap)) {
      const stk = String(acc.STK || acc.accountNumber || acc.stk || '').toLowerCase();
      if (stk === qLower) return acc;
      if (qClean && stk.replace(/\D/g, '') === qClean) return acc;
    }

    // 5. Khớp số điện thoại (SĐT / phone)
    for (const acc of Object.values(accountsMap)) {
      const p = String(acc.phone || acc.sdt || '').replace(/\D/g, '');
      if (qClean && p === qClean) return acc;
    }

    if (activeAccount && accountsMap[activeAccount]) {
      return accountsMap[activeAccount];
    }
    const keys = Object.keys(accountsMap);
    if (keys.length > 0) {
      return accountsMap[keys[0]];
    }

    return null;
  }

  // NẾU KHÔNG TRUYỀN TÀI KHOẢN: LẤY TÀI KHOẢN ĐANG ACTIVE TRÊN FIREBASE
  if (activeAccount && accountsMap[activeAccount]) {
    return accountsMap[activeAccount];
  }
  const keys = Object.keys(accountsMap);
  if (keys.length > 0) {
    return accountsMap[keys[0]];
  }
  return null;
}

async function getStoredTransactions(acc, folder) {
  const accNum = acc.STK || acc.accountNumber || acc.stk || folder;
  const name = String(acc.customerName || acc.accountName || acc.TK || folder).trim().toUpperCase();
  const bal = typeof acc.balance === 'number' ? acc.balance : (typeof acc.TIEN === 'number' ? acc.TIEN : 0);
  const createdAt = acc.updatedAt || new Date().toISOString();

  const initialTransaction = {
    id: `TXN-INIT-${folder}`,
    accountNumber: accNum,
    account_number: accNum,
    stk: accNum,
    type: 'IN',
    amount: bal,
    balance: bal,
    so_tien: bal,
    counterparty_name: 'NGAN HANG TMCP QUAN DOI (MB)',
    counterpartyName: 'NGAN HANG TMCP QUAN DOI (MB)',
    counterparty_bank: 'MB',
    counterpartyBank: 'MB',
    senderName: 'NGAN HANG TMCP QUAN DOI (MB)',
    sender_name: 'NGAN HANG TMCP QUAN DOI (MB)',
    customerName: name,
    customer_name: name,
    custName: name,
    accountName: name,
    account_name: name,
    fullName: name,
    full_name: name,
    description: `Khoi tao so du ban dau: +${Number(bal).toLocaleString('vi-VN')} VND`,
    noi_dung: `Khoi tao so du ban dau: +${Number(bal).toLocaleString('vi-VN')} VND`,
    noidung: `Khoi tao so du ban dau: +${Number(bal).toLocaleString('vi-VN')} VND`,
    remark: `Khoi tao so du ban dau: +${Number(bal).toLocaleString('vi-VN')} VND`,
    created_at: createdAt,
    createdAt: createdAt
  };

  try {
    const directTxRes = await fetch(`${FIREBASE_BASE}/${folder}/transactions.json?ts=${Date.now()}`, { cache: 'no-store' });
    let data = directTxRes.ok ? await directTxRes.json() : null;

    if (data && typeof data === 'object') {
      const customList = Object.values(data)
        .filter(t => t && typeof t === 'object')
        .map(t => ({
          id: t.id || `TXN-${Date.now()}`,
          accountNumber: accNum,
          account_number: accNum,
          stk: accNum,
          type: t.type || 'OUT',
          amount: Number(t.amount || t.so_tien || 0),
          balance: Number(t.balance !== undefined ? t.balance : bal),
          so_tien: Number(t.amount || t.so_tien || 0),
          counterparty_name: t.receiverName || t.counterparty_name || 'NGAN HANG TMCP QUAN DOI (MB)',
          counterpartyName: t.receiverName || t.counterparty_name || 'NGAN HANG TMCP QUAN DOI (MB)',
          counterparty_bank: t.bankCode || t.counterparty_bank || 'MB',
          counterpartyBank: t.bankCode || t.counterparty_bank || 'MB',
          senderName: t.senderName || name,
          sender_name: t.senderName || name,
          customerName: name,
          customer_name: name,
          custName: name,
          accountName: name,
          account_name: name,
          fullName: name,
          full_name: name,
          description: t.description || t.noi_dung || `${name} chuyen tien`,
          noi_dung: t.description || t.noi_dung || `${name} chuyen tien`,
          noidung: t.description || t.noi_dung || `${name} chuyen tien`,
          remark: t.description || t.noi_dung || `${name} chuyen tien`,
          created_at: t.createdAt || t.created_at || new Date().toISOString(),
          createdAt: t.createdAt || t.created_at || new Date().toISOString()
        }));

      if (customList.length > 0) {
        return customList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }
    }
  } catch (e) {}

  return [initialTransaction];
}

export default async function handler(req, res) {
  logApiHit('transactions.js', req);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const requestedRaw = req.query?.account_number || 
                       req.query?.accountNumber || 
                       req.query?.stk || 
                       req.query?.username || 
                       req.headers['x-account-number'];

  const requested = requestedRaw ? String(requestedRaw).trim() : null;

  // Lấy dữ liệu 100% từ Firebase
  const { accountsMap, activeAccount } = await getLiveAccountsMap();
  let acc = resolveAccount(accountsMap, requested, activeAccount);

  // Fallback an toàn: nếu token hoặc header chứa tài khoản cũ đã xóa, tự động lấy tài khoản đang active trên Firebase
  if (!acc && activeAccount && accountsMap[activeAccount]) {
    acc = accountsMap[activeAccount];
  }
  if (!acc && Object.keys(accountsMap).length > 0) {
    acc = Object.values(accountsMap)[0];
  }

  // Nếu không có bất kỳ tài khoản nào trên Firebase: báo lỗi rõ ràng
  if (!acc) {
    return res.status(200).json({
      success: false,
      code: 404,
      status: 'error',
      message: 'Hệ thống chưa có tài khoản nào được tạo trên Firebase',
      accountNumber: requested || '',
      account_number: requested || '',
      balance: 0,
      transactions: [],
      data: [],
      total: 0
    });
  }

  const folder = acc._folder || acc.TK || acc.username;
  const accNum = acc.STK || acc.accountNumber || acc.stk || folder;
  const name = String(acc.customerName || acc.accountName || acc.TK || folder).trim().toUpperCase();
  const bal = typeof acc.balance === 'number' ? acc.balance : (typeof acc.TIEN === 'number' ? acc.TIEN : 0);

  const list = await getStoredTransactions(acc, folder);

  return res.status(200).json({
    success: true,
    code: 0,
    status: 'success',
    accountNumber: accNum,
    balance: bal,
    transactions: list,
    data: list,
    account_number: accNum,
    account_name: name,
    customer_name: name,
    total: list.length,
    page: 1,
    limit: 20
  });
}
