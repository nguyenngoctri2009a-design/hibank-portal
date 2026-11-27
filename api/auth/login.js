/**
 * MB Bank Authentication API
 * SINGLE SOURCE OF TRUTH: Firebase Realtime Database
 */

const FIREBASE_BASE = 'https://sfsdfsf-c4c13-default-rtdb.asia-southeast1.firebasedatabase.app';
const FIREBASE_URL = `${FIREBASE_BASE}/mbbank`;

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

    // 1. Quét các mục tài khoản độc lập tại gốc Firebase (VD: /TRI, /ABC)
    for (const [k, v] of Object.entries(rootData)) {
      if (k !== 'mbbank' && v && typeof v === 'object') {
        if (v.TK || v.username || v.STK || v.accountNumber || v.balance !== undefined || v.TIEN !== undefined || v.MK || v.password) {
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

    for (const acc of Object.values(accountsMap)) {
      const p = String(acc.phone || acc.sdt || '').replace(/\D/g, '');
      if (qClean && p === qClean) return acc;
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

function buildAccountResponse(acc, token) {
  const folder = acc._folder || acc.TK || acc.username;
  const num = String(acc.STK || acc.accountNumber || acc.stk || folder).trim();
  const name = String(acc.customerName || acc.accountName || acc.TK || folder).trim().toUpperCase();
  const bal = typeof acc.balance === 'number' ? acc.balance : (typeof acc.TIEN === 'number' ? acc.TIEN : 0);
  const otp = String(acc.OTP || acc.otp || '111111').trim();
  const phone = String(acc.phone || acc.sdt || num).trim();
  const pass = String(acc.MK || acc.password || '123456').trim();
  const tier = acc.tier || 'MB Priority Digital';

  const userAccount = {
    id: 1,
    username: acc.TK || acc.username || folder,
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
    cust_name: name,
    name: name,
    displayName: name,
    display_name: name,
    ten_khach_hang: name,
    tenKhachHang: name,
    ten_ctk: name,
    clientName: name,
    client_name: name,
    ownerName: name,
    owner_name: name,
    senderName: name,
    sender_name: name,
    cif: num,
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
    digital_otp: otp,
    digitalOtp: otp,
    mb_otp: otp,
    pin_code: otp,
    otp_code: otp,
    pinCode: otp,
    otpCode: otp,
    smart_otp: otp,
    smartOtp: otp,
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
    name: name,
    customerName: name,
    customer_name: name,
    fullName: name,
    full_name: name,
    accountName: name,
    account_name: name,
    displayName: name,
    display_name: name,
    tenKhachHang: name,
    ten_khach_hang: name,
    ten_ctk: name,
    otp: otp,
    pin: otp,
    digital_otp: otp,
    digitalOtp: otp,
    mb_otp: otp,
    pin_code: otp,
    otp_code: otp,
    pinCode: otp,
    otpCode: otp,
    smart_otp: otp,
    smartOtp: otp,
    data: userAccount,
    user: userAccount,
    account: userAccount,
    accounts: [ userAccount ],
    result: {
      responseCode: '00',
      message: 'Success',
      data: userAccount,
      user: userAccount,
      name: name,
      customerName: name,
      full_name: name,
      fullName: name
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
  const b = (body && typeof body.data === 'object') ? body.data : body;

  const userParam = String(
    body.username ||
    body.bank_username ||
    body.tk ||
    body.accountNumber ||
    body.account_number ||
    body.stk ||
    body.phone ||
    body.sdt ||
    body.userId ||
    body.user ||
    b.username ||
    b.bank_username ||
    b.tk ||
    b.accountNumber ||
    b.account_number ||
    b.stk ||
    b.phone ||
    b.sdt ||
    b.userId ||
    req.query?.username ||
    req.query?.account_number ||
    req.query?.stk ||
    ''
  ).trim();

  const passParam = String(
    body.passwordLevelTwo ||
    body.password_level_two ||
    body.password ||
    body.mk ||
    body.mat_khau ||
    body.pass ||
    body.pin ||
    b.passwordLevelTwo ||
    b.password_level_two ||
    b.password ||
    b.mk ||
    b.mat_khau ||
    b.pass ||
    b.pin ||
    req.headers['x-password'] ||
    req.headers['x-pin'] ||
    req.query?.password ||
    ''
  ).trim();

  const { accountsMap, activeAccount } = await getLiveAccountsMap();

  // NẾU CÓ GỬI MẬT KHẨU HOẶC TÀI KHOẢN -> BẮT BUỘC KIỂM TRA MẬT KHẨU
  if (passParam || userParam) {
    const matched = userParam 
      ? resolveAccount(accountsMap, userParam, null) 
      : resolveAccount(accountsMap, null, activeAccount);

    if (!matched) {
      return res.status(401).json({
        success: false,
        code: 404,
        status: 'error',
        message: 'Tài khoản không tồn tại trên hệ thống Firebase. Vui lòng kiểm tra lại.',
        result: { responseCode: '404', message: 'Tài khoản không tồn tại' }
      });
    }

    if (!passParam) {
      return res.status(401).json({
        success: false,
        code: 1,
        status: 'error',
        message: 'Vui lòng nhập mật khẩu đăng nhập',
        result: { responseCode: '401', message: 'Vui lòng nhập mật khẩu đăng nhập' }
      });
    }

    // Kiểm tra mật khẩu (hỗ trợ MK / password)
    const expectedPass = String(matched.MK || matched.password || '123456').trim();
    if (expectedPass.toLowerCase() !== passParam.toLowerCase() && expectedPass !== passParam) {
      return res.status(401).json({
        success: false,
        code: 1,
        status: 'error',
        message: 'Mật khẩu không chính xác. Vui lòng kiểm tra lại mật khẩu do Admin cấp.',
        result: { responseCode: '401', message: 'Mật khẩu không chính xác' }
      });
    }

    // ĐĂNG NHẬP THÀNH CÔNG: Tự động kích hoạt tài khoản này làm active_account
    const folder = matched._folder || matched.TK || matched.username;
    const token = `tok_mb_${folder}_${Date.now()}`;
    await fetch(`${FIREBASE_URL}/active_account.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(folder)
    }).catch(() => {});

    return res.status(200).json(buildAccountResponse(matched, token));
  }

  // NẾU APP MỞ LÊN KHÔNG GỬI CREDENTIALS: Lấy đúng tài khoản active trên Firebase
  const effectiveAcc = resolveAccount(accountsMap, null, activeAccount);
  if (!effectiveAcc) {
    return res.status(200).json({
      success: false,
      code: 404,
      status: 'error',
      message: 'Hệ thống chưa có tài khoản nào được tạo trên Firebase.'
    });
  }

  const folder = effectiveAcc._folder || effectiveAcc.TK || effectiveAcc.username;
  const token = `autotok_mb_${folder}_${Date.now()}`;
  return res.status(200).json(buildAccountResponse(effectiveAcc, token));
}
