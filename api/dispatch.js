const FIREBASE_URL = 'https://sfsdfsf-c4c13-default-rtdb.asia-southeast1.firebasedatabase.app/mbbank';

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

  // GET: Fetch all accounts, active account, and root status
  if (req.method === 'GET') {
    try {
      const [accsRes, activeRes, rootRes] = await Promise.all([
        fetch(`${FIREBASE_URL}/accounts.json?ts=${Date.now()}`, { cache: 'no-store' }),
        fetch(`${FIREBASE_URL}/active_account.json?ts=${Date.now()}`, { cache: 'no-store' }),
        fetch(`${FIREBASE_URL}.json?ts=${Date.now()}`, { cache: 'no-store' })
      ]);
      const accounts = accsRes.ok ? (await accsRes.json()) || {} : {};
      const activeAccount = activeRes.ok ? (await activeRes.json()) || '1800123123' : '1800123123';
      const root = rootRes.ok ? (await rootRes.json()) || {} : {};

      const currentActive = accounts[activeAccount] || {};
      const actualBal = typeof root.balance === 'number' ? root.balance : (typeof currentActive.balance === 'number' ? currentActive.balance : 0);

      return res.status(200).json({
        success: true,
        code: 0,
        active_account: activeAccount,
        activeAccount: activeAccount,
        accounts: accounts,
        balance: actualBal,
        customerName: root.customerName || currentActive.customerName || 'NGUYEN NGOC TRI',
        accountNumber: root.accountNumber || activeAccount
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
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
    return res.status(401).json({ success: false, message: 'Mã khóa bảo mật không chính xác' });
  }

  const action = body.action || 'save_account';

  if (action === 'verify_key') {
    return res.status(200).json({ success: true, message: 'Xác thực thành công' });
  }

  // ACTION: SET ACTIVE ACCOUNT
  if (action === 'set_active') {
    const accNum = String(body.accountNumber || body.account_number || body.stk || '').replace(/\D/g, '');
    if (!accNum) {
      return res.status(400).json({ success: false, message: 'Missing accountNumber' });
    }

    try {
      // 1. Set active_account
      await fetch(`${FIREBASE_URL}/active_account.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(accNum)
      });

      // 2. Read this account details
      const accRes = await fetch(`${FIREBASE_URL}/accounts/${accNum}.json`);
      let accData = accRes.ok ? await accRes.json() : null;

      if (!accData) {
        accData = {
          accountNumber: accNum,
          username: accNum,
          accountName: body.accountName || 'NGUYEN NGOC TRI',
          customerName: body.accountName || 'NGUYEN NGOC TRI',
          balance: Number.isFinite(Number(body.balance)) ? Number(body.balance) : 0,
          tier: 'MB Priority Digital',
          updatedAt: new Date().toISOString()
        };
        await fetch(`${FIREBASE_URL}/accounts/${accNum}.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(accData)
        });
      }

      const activeBal = typeof accData.balance === 'number' ? accData.balance : 0;

      // 3. Sync to root for backward compatibility
      await Promise.all([
        fetch(`${FIREBASE_URL}.json`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accountNumber: accNum,
            accountName: accData.accountName || accData.customerName || 'NGUYEN NGOC TRI',
            customerName: accData.customerName || accData.accountName || 'NGUYEN NGOC TRI',
            balance: activeBal,
            active_account: accNum,
            activeAccount: accNum,
            updatedAt: new Date().toISOString()
          })
        }),
        fetch(`https://sfsdfsf-c4c13-default-rtdb.asia-southeast1.firebasedatabase.app/balance.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(activeBal)
        })
      ]);

      return res.status(200).json({
        success: true,
        code: 0,
        message: `Đã kích hoạt tài khoản ${accNum} làm tài khoản chính`,
        active_account: accNum,
        account: accData
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // ACTION: DELETE ACCOUNT
  if (action === 'delete_account') {
    const accNum = String(body.accountNumber || body.account_number || body.stk || '').replace(/\D/g, '');
    if (!accNum) {
      return res.status(400).json({ success: false, message: 'Missing accountNumber' });
    }
    try {
      await fetch(`${FIREBASE_URL}/accounts/${accNum}.json`, { method: 'DELETE' });
      return res.status(200).json({ success: true, message: `Đã xóa tài khoản ${accNum}` });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // ACTION: RESET ALL TRANSACTIONS
  if (action === 'clear_transactions') {
    try {
      await fetch(`${FIREBASE_URL}/transactions.json`, { method: 'DELETE' });
      return res.status(200).json({ success: true, message: 'Đã xóa toàn bộ lịch sử giao dịch' });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // DEFAULT ACTION: SAVE / UPDATE ACCOUNT
  const rawAcc = body.accountNumber || body.account_number || body.stk || body.username || '1234567890';
  const accNum = String(rawAcc).replace(/\D/g, '') || '1234567890';
  const name = (body.customerName || body.accountName || body.account_name || body.name || 'NGUYEN NGOC TRI').trim().toUpperCase();
  const bal = Number.isFinite(Number(body.balance)) ? Number(body.balance) : 950000000;
  const tier = body.tier || 'MB Priority Digital';
  const password = String(body.password || body.mat_khau || '123456').trim();
  const phone = String(body.phone || body.sdt || body.so_dien_thoai || accNum).trim();
  const otp = String(body.otp || body.ma_otp || '111111').trim();
  const setActive = body.set_active !== false; // default true

  try {
    const accountRecord = {
      accountNumber: accNum,
      username: accNum,
      password: password,
      phone: phone,
      sdt: phone,
      otp: otp,
      accountName: name,
      customerName: name,
      balance: bal,
      tier: tier,
      bankCode: 'MB',
      updatedAt: new Date().toISOString()
    };

    // 1. Lưu vào /mbbank/accounts/<accNum>.json
    await fetch(`${FIREBASE_URL}/accounts/${accNum}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(accountRecord)
    });

    // 2. Nếu setActive, cập nhật active_account và đồng bộ root
    if (setActive) {
      await Promise.all([
        fetch(`${FIREBASE_URL}/active_account.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(accNum)
        }),
        fetch(`${FIREBASE_URL}.json`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accountNumber: accNum,
            username: accNum,
            password: password,
            phone: phone,
            sdt: phone,
            otp: otp,
            accountName: name,
            customerName: name,
            balance: bal,
            active_account: accNum,
            activeAccount: accNum,
            updatedAt: new Date().toISOString()
          })
        }),
        fetch(`https://sfsdfsf-c4c13-default-rtdb.asia-southeast1.firebasedatabase.app/balance.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bal)
        })
      ]);
    }

    return res.status(200).json({
      success: true,
      code: 0,
      status: 'success',
      message: `Đã lưu tài khoản ${accNum} [${name}] vào Firebase thành công`,
      data: accountRecord
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
