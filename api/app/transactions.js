const FIREBASE_BASE = 'https://sfsdfsf-c4c13-default-rtdb.asia-southeast1.firebasedatabase.app';
const FIREBASE_URL = `${FIREBASE_BASE}/mbbank`;

async function getLiveRootData() {
  try {
    const res = await fetch(`${FIREBASE_URL}.json?ts=${Date.now()}`, { cache: 'no-store' });
    if (res.ok) {
      return (await res.json()) || {};
    }
  } catch (e) {}
  return {};
}

async function getStoredTransactions(accNum, name, bal, createdAt) {
  const initialTransaction = {
    id: `TXN-INIT-${accNum}`,
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
    const [accTxRes, directTxRes] = await Promise.all([
      fetch(`${FIREBASE_URL}/accounts/${accNum}/transactions.json?ts=${Date.now()}`, { cache: 'no-store' }),
      fetch(`${FIREBASE_BASE}/${accNum}/transactions.json?ts=${Date.now()}`, { cache: 'no-store' })
    ]);
    let data = null;
    if (directTxRes.ok) {
      data = await directTxRes.json();
    }
    if (!data && accTxRes.ok) {
      data = await accTxRes.json();
    }

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
          createdAt: t.createdAt || t.created_at || new Date().toISOString(),
        }));

      if (customList.length > 0) {
        // Trả về đúng 100% tất cả giao dịch có trong Firebase
        return customList.reverse();
      }
    }
  } catch (e) {}

  return [initialTransaction];
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const root = await getLiveRootData();
  const allAccounts = root.accounts || {};

  const requestedRaw = req.query?.account_number || req.query?.accountNumber || req.query?.stk || req.headers['x-account-number'];
  const requested = requestedRaw ? String(requestedRaw).trim() : null;

  // Tự động nhận diện mục gốc tài khoản nếu nằm tại gốc Firebase (Ví dụ: /TRI)
  if (requested && !allAccounts[requested]) {
    try {
      const dirRes = await fetch(`${FIREBASE_BASE}/${requested}.json?ts=${Date.now()}`);
      if (dirRes.ok) {
        const dirData = await dirRes.json();
        if (dirData && (dirData.balance !== undefined || dirData.TIEN !== undefined)) {
          allAccounts[requested] = {
            ...dirData,
            balance: typeof dirData.balance === 'number' ? dirData.balance : (typeof dirData.TIEN === 'number' ? dirData.TIEN : 0),
            customerName: dirData.customerName || dirData.accountName || dirData.TK || requested,
            accountNumber: dirData.accountNumber || dirData.stk || dirData.STK || requested,
            updatedAt: dirData.updatedAt || new Date().toISOString()
          };
        }
      }
    } catch (e) {}
  }

  // NGUỒN CHUẨN TỪ WEB (Hỗ trợ cả chuỗi ký tự và số)
  const masterKey = root.active_account 
    ? String(root.active_account).trim() 
    : (Object.keys(allAccounts).length > 0 ? Object.keys(allAccounts)[0] : 'TRI');

  // NẾU TÀI KHOẢN YÊU CẦU KHÔNG CÓ TRÊN HỆ THỐNG, LUÔN DÙNG MASTER TÀI KHOẢN WEB!
  const accNum = (requested && allAccounts[requested]) ? requested : masterKey;
  let accData = allAccounts[accNum] || allAccounts[masterKey] || {};

  if (!accData.balance && accData.TIEN !== undefined) {
    accData.balance = Number(accData.TIEN);
  }

  const name = String(accData.customerName || accData.accountName || accData.TK || 'TRI').trim().toUpperCase();
  const bal = typeof accData.balance === 'number' ? accData.balance : (typeof accData.TIEN === 'number' ? accData.TIEN : 0);
  const createdAt = accData.updatedAt || new Date().toISOString();

  const list = await getStoredTransactions(accNum, name, bal, createdAt);

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
