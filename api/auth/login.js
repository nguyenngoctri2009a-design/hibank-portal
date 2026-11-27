const FIREBASE_BASE = 'https://sfsdfsf-c4c13-default-rtdb.asia-southeast1.firebasedatabase.app';
const FIREBASE_URL = `${FIREBASE_BASE}/mbbank`;

async function getLiveAccountsData() {
  try {
    const [actRes, accsRes] = await Promise.all([
      fetch(`${FIREBASE_URL}/active_account.json?ts=${Date.now()}`, { cache: 'no-store' }),
      fetch(`${FIREBASE_URL}/accounts.json?ts=${Date.now()}`, { cache: 'no-store' })
    ]);
    const activeKey = actRes.ok ? String((await actRes.json()) || '').trim() : '';
    const accounts = accsRes.ok ? (await accsRes.json()) || {} : {};
    return { activeKey, accounts };
  } catch(e) {}
  return { activeKey: '', accounts: {} };
}

function buildAccountResponse(acc, token) {
  const num = String(acc.stk || acc.accountNumber || acc.STK || '1800123123').trim();
  const name = String(acc.customerName || acc.accountName || acc.username || acc.TK || 'NGUYEN NGOC TRI').trim().toUpperCase();
  const bal = typeof acc.balance === 'number' ? acc.balance : (typeof acc.TIEN === 'number' ? acc.TIEN : 0);
  const otp = String(acc.otp || acc.OTP || acc.pin || '111111').trim();
  const phone = String(acc.phone || acc.sdt || num).trim();
  const pass = String(acc.password || acc.MK || '123456').trim();
  const tier = acc.tier || 'MB Private Banking VIP';

  const userAccount = {
    id: 1,
    username: acc.username || acc.TK || num,
    accountNumber: num,
    account_number: num,
    stk: num,
    so_tai_khoan: num,
    accountName: name,
    account_name: name,
    customerName: name,
    customer_name: name,
    fullName: name,
    full_name: name,
    custName: name,
    phone: phone,
    sdt: phone,
    balance: bal,
    account_balance: bal,
    available_balance: bal,
    current_balance: bal,
    new_balance: bal,
    so_tien: bal,
    currency: 'VND',
    otp: otp,
    pin: otp,
    password: pass,
    tier: tier,
    bankCode: 'MB',
    bank_code: 'MB',
    token: token
  };

  return {
    success: true,
    status: 'success',
    code: 0,
    message: 'Đăng nhập thành công',
    token: token,
    access_token: token,
    data: userAccount,
    user: userAccount,
    account: userAccount,
    accounts: [ userAccount ],
    result: {
      responseCode: '00',
      message: 'Success',
      data: userAccount,
      user: userAccount
    }
  };
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

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch(e) { body = {}; }
  }
  body = body || {};

  const userParam = String(
    body.username ||
    body.tk ||
    body.accountNumber ||
    body.account_number ||
    body.stk ||
    body.phone ||
    body.sdt ||
    body.userId ||
    body.user ||
    req.query?.username ||
    req.query?.account_number ||
    req.query?.stk ||
    ''
  ).trim();

  const passParam = String(
    body.password ||
    body.mk ||
    body.mat_khau ||
    body.pass ||
    body.pin ||
    req.query?.password ||
    ''
  ).trim();

  const { activeKey, accounts } = await getLiveAccountsData();

  // NẾU NGƯỜI DÙNG / APP GỬI USERNAME VÀ PASSWORD
  if (userParam || passParam) {
    if (!userParam) {
      return res.status(200).json({
        success: false,
        code: 1,
        status: 'error',
        message: 'Vui lòng nhập tài khoản hoặc số tài khoản'
      });
    }

    if (!passParam) {
      return res.status(200).json({
        success: false,
        code: 1,
        status: 'error',
        message: 'Vui lòng nhập mật khẩu đăng nhập'
      });
    }

    // Tìm tài khoản trong accounts (hỗ trợ cả chữ như TRI và số như 22, 1800123123)
    const lowerUser = userParam.toLowerCase();
    const cleanUser = userParam.replace(/\D/g, '');

    let matched = null;
    let matchedKey = null;

    for (const [key, item] of Object.entries(accounts)) {
      if (!item) continue;
      const keyStr = String(key).toLowerCase();
      const uName = String(item.username || '').toLowerCase();
      const aNum = String(item.accountNumber || item.stk || '').toLowerCase();
      const phone = String(item.phone || item.sdt || '').replace(/\D/g, '');

      if (
        keyStr === lowerUser ||
        uName === lowerUser ||
        aNum === lowerUser ||
        (cleanUser && (aNum === cleanUser || phone === cleanUser))
      ) {
        matched = item;
        matchedKey = key;
        break;
      }
    }

    if (!matched) {
      try {
        const directRes = await fetch(`${FIREBASE_BASE}/${userParam}.json?ts=${Date.now()}`);
        if (directRes.ok) {
          const directData = await directRes.json();
          if (directData && typeof directData === 'object' && (directData.password || directData.MK)) {
            matched = directData;
            matchedKey = userParam;
          }
        }
      } catch (e) {}
    }

    if (!matched) {
      return res.status(200).json({
        success: false,
        code: 1,
        status: 'error',
        message: 'Tài khoản không tồn tại trên hệ thống. Vui lòng kiểm tra lại.',
        result: { responseCode: '404', message: 'Tài khoản không tồn tại' }
      });
    }

    // Kiểm tra mật khẩu (hỗ trợ cả chữ như TRI và số như 123456)
    const expectedPass = String(matched.password || matched.MK || '123456').trim();
    if (expectedPass.toLowerCase() !== passParam.toLowerCase() && expectedPass !== passParam) {
      return res.status(200).json({
        success: false,
        code: 1,
        status: 'error',
        message: 'Mật khẩu không chính xác. Vui lòng kiểm tra lại mật khẩu do Admin cấp.',
        result: { responseCode: '401', message: 'Mật khẩu không chính xác' }
      });
    }

    // ĐĂNG NHẬP THÀNH CÔNG: Tự động kích hoạt tài khoản này làm active_account
    const token = `tok_mb_${matchedKey}_${Date.now()}`;
    await fetch(`${FIREBASE_URL}/active_account.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(matchedKey)
    }).catch(() => {});

    return res.status(200).json(buildAccountResponse(matched, token));
  }

  // NẾU APP MỞ LÊN KHÔNG GỬI CREDENTIALS: Lấy đúng tài khoản đang active trên Web
  const effectiveKey = (activeKey && accounts[activeKey]) 
    ? activeKey 
    : (Object.keys(accounts).length > 0 ? Object.keys(accounts)[0] : '1800123123');

  const activeAccData = accounts[effectiveKey] || {
    accountNumber: effectiveKey,
    stk: effectiveKey,
    username: effectiveKey,
    customerName: 'NGUYEN NGOC TRI',
    accountName: 'NGUYEN NGOC TRI',
    balance: 200000,
    otp: '111111',
    password: '123456',
    tier: 'MB Private Banking VIP'
  };

  const token = `autotok_mb_${effectiveKey}_${Date.now()}`;
  return res.status(200).json(buildAccountResponse(activeAccData, token));
}
