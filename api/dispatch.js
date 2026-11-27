const FIREBASE_BASE = 'https://sfsdfsf-c4c13-default-rtdb.asia-southeast1.firebasedatabase.app';
const FIREBASE_URL = `${FIREBASE_BASE}/mbbank`;

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
      const [accsRes, activeRes, rootRes] = await Promise.all([
        fetch(`${FIREBASE_URL}/accounts.json?ts=${Date.now()}`, { cache: 'no-store' }),
        fetch(`${FIREBASE_URL}/active_account.json?ts=${Date.now()}`, { cache: 'no-store' }),
        fetch(`${FIREBASE_BASE}.json?ts=${Date.now()}`, { cache: 'no-store' })
      ]);
      const accounts = accsRes.ok ? (await accsRes.json()) || {} : {};
      const activeAccount = activeRes.ok ? String((await activeRes.json()) || '').trim() : '';
      const rootData = rootRes.ok ? (await rootRes.json()) || {} : {};

      // Tự động nhận diện các mục tài khoản riêng biệt tại gốc Firebase (Ví dụ: /TRI)
      for (const [k, v] of Object.entries(rootData)) {
        if (k !== 'mbbank' && v && typeof v === 'object' && (v.password || v.MK || v.balance !== undefined || v.TIEN !== undefined)) {
          if (!accounts[k]) {
            accounts[k] = v;
          }
        }
      }

      const accKeys = Object.keys(accounts);
      const effectiveActive = (activeAccount && accounts[activeAccount]) 
        ? activeAccount 
        : (accKeys.length > 0 ? accKeys[0] : '1800123123');

      const currentActive = accounts[effectiveActive] || {};
      const actualBal = typeof currentActive.balance === 'number' 
        ? currentActive.balance 
        : (typeof currentActive.TIEN === 'number' ? currentActive.TIEN : 0);
      const actualName = currentActive.customerName || currentActive.accountName || currentActive.TK || 'NGUYEN NGOC TRI';
      const actualNum = currentActive.accountNumber || currentActive.stk || currentActive.STK || effectiveActive;

      return res.status(200).json({
        success: true,
        code: 0,
        active_account: effectiveActive,
        activeAccount: effectiveActive,
        accounts: accounts,
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

  // Bảo vệ cổng Admin bằng mã khóa bảo mật
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
      await fetch(`${FIREBASE_URL}/active_account.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(accKey)
      });

      const accRes = await fetch(`${FIREBASE_URL}/accounts/${accKey}.json?ts=${Date.now()}`);
      const accData = accRes.ok ? await accRes.json() : null;

      return res.status(200).json({
        success: true,
        code: 0,
        message: `Đã kích hoạt tài khoản ${accKey} làm tài khoản chính`,
        active_account: accKey,
        account: accData
      });
    } catch (err) {
      return res.status(500).json({ success: false, code: 500, error: err.message });
    }
  }

  // ACTION: UPDATE BALANCE DIRECTLY ON THIS ACCOUNT
  if (action === 'update_balance') {
    const rawKey = body.accountNumber || body.account_number || body.stk || body.username || '';
    const accKey = String(rawKey).trim();
    const newBal = Number(body.balance !== undefined ? body.balance : body.tien);

    if (!accKey || !Number.isFinite(newBal) || newBal < 0) {
      return res.status(400).json({ success: false, code: 400, message: 'Tài khoản hoặc số dư không hợp lệ' });
    }

    try {
      const patchData = {
        balance: newBal,
        TIEN: newBal,
        updatedAt: new Date().toISOString()
      };

      await Promise.all([
        fetch(`${FIREBASE_BASE}/${accKey}.json`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patchData)
        }).catch(() => {}),
        fetch(`${FIREBASE_URL}/accounts/${accKey}.json`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patchData)
        }).catch(() => {})
      ]);

      return res.status(200).json({
        success: true,
        code: 0,
        message: `Đã cập nhật số dư mục tài khoản ${accKey} thành ${newBal.toLocaleString('vi-VN')} VND`,
        balance: newBal,
        TIEN: newBal
      });
    } catch (err) {
      return res.status(500).json({ success: false, code: 500, error: err.message });
    }
  }

  // ACTION: EDIT / UPDATE ACCOUNT DETAILS
  if (action === 'update_account') {
    const rawKey = body.accountNumber || body.account_number || body.stk || body.username || '';
    const accKey = String(rawKey).trim();
    if (!accKey) {
      return res.status(400).json({ success: false, code: 400, message: 'Thiếu số tài khoản / username' });
    }

    try {
      const accRes = await fetch(`${FIREBASE_URL}/accounts/${accKey}.json`);
      const existing = accRes.ok ? (await accRes.json()) || {} : {};

      const bal = Number.isFinite(Number(body.balance !== undefined ? body.balance : body.tien)) 
        ? Number(body.balance !== undefined ? body.balance : body.tien) 
        : (existing.balance || 0);

      const updated = {
        ...existing,
        TK: body.username ? String(body.username).trim() : (existing.TK || existing.username || accKey),
        MK: body.password ? String(body.password).trim() : (existing.MK || existing.password || '123456'),
        OTP: body.otp ? String(body.otp).trim() : (existing.OTP || existing.otp || '111111'),
        TIEN: bal,
        STK: body.accountNumber || body.stk ? String(body.accountNumber || body.stk).trim() : (existing.STK || existing.accountNumber || accKey),
        username: body.username ? String(body.username).trim() : (existing.username || accKey),
        accountNumber: body.accountNumber || body.stk ? String(body.accountNumber || body.stk).trim() : (existing.accountNumber || accKey),
        stk: body.accountNumber || body.stk ? String(body.accountNumber || body.stk).trim() : (existing.stk || accKey),
        customerName: body.customerName ? body.customerName.trim().toUpperCase() : (existing.customerName || 'NGUYEN NGOC TRI'),
        accountName: body.customerName ? body.customerName.trim().toUpperCase() : (existing.accountName || 'NGUYEN NGOC TRI'),
        password: body.password ? String(body.password).trim() : (existing.password || '123456'),
        phone: body.phone ? String(body.phone).trim() : (existing.phone || accKey),
        otp: body.otp ? String(body.otp).trim() : (existing.otp || '111111'),
        tier: body.tier || existing.tier || 'MB Priority Digital',
        balance: bal,
        updatedAt: new Date().toISOString()
      };

      await Promise.all([
        fetch(`${FIREBASE_BASE}/${accKey}.json`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updated)
        }).catch(() => {}),
        fetch(`${FIREBASE_URL}/accounts/${accKey}.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updated)
        }).catch(() => {})
      ]);

      return res.status(200).json({
        success: true,
        code: 0,
        message: `Đã cập nhật thông tin tài khoản ${accKey}`,
        account: updated
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
      await Promise.all([
        fetch(`${FIREBASE_BASE}/${accKey}.json`, { method: 'DELETE' }).catch(() => {}),
        fetch(`${FIREBASE_URL}/accounts/${accKey}.json`, { method: 'DELETE' }).catch(() => {})
      ]);
      return res.status(200).json({ success: true, code: 0, message: `Đã xóa tài khoản ${accKey}` });
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
        await Promise.all([
          fetch(`${FIREBASE_BASE}/${accKey}/transactions.json`, { method: 'DELETE' }).catch(() => {}),
          fetch(`${FIREBASE_URL}/accounts/${accKey}/transactions.json`, { method: 'DELETE' }).catch(() => {})
        ]);
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
  const name = String(body.customerName || body.accountName || body.name || username || 'NGUYEN NGOC TRI').trim().toUpperCase();
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
      updatedAt: new Date().toISOString()
    };

    // 1. TẠO MỤC RIÊNG VỚI TÊN TÀI KHOẢN ĐÓ NGAY GỐC FIREBASE: /<nodeKey>.json (Ví dụ: /TRI.json)
    await Promise.all([
      fetch(`${FIREBASE_BASE}/${nodeKey}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(accountRecord)
      }),
      fetch(`${FIREBASE_URL}/accounts/${nodeKey}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(accountRecord)
      }),
      (stk && stk !== nodeKey) ? fetch(`${FIREBASE_URL}/accounts/${stk}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(accountRecord)
      }) : Promise.resolve()
    ]);

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
