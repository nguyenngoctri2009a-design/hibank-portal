/**
 * MB Bank User Bank Account API
 * Returns primary bank account information for App MB
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

    // 1. Khớp chính xác folder name
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

    // 5. Khớp số điện thoại
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

function mapAccountObject(acc, id = 1, isDefault = true) {
  const folder = acc._folder || acc.TK || acc.username;
  const bal = typeof acc.balance === 'number' ? acc.balance : (typeof acc.TIEN === 'number' ? acc.TIEN : 0);
  const num = String(acc.STK || acc.accountNumber || acc.stk || folder).trim();
  const name = String(acc.customerName || acc.accountName || acc.TK || folder).trim().toUpperCase();
  const user = acc.TK || acc.username || folder;
  const otp = String(acc.OTP || acc.otp || '111111').trim();
  const phone = String(acc.phone || acc.sdt || num).trim();
  const pass = String(acc.MK || acc.password || '123456').trim();
  const tier = acc.tier || 'MB Priority Digital';

  return {
    id: id,
    is_default: isDefault,
    isDefault: isDefault,
    account_number: num,
    accountNumber: num,
    stk: num,
    so_tai_khoan: num,
    sotaikhoan: num,
    soTaiKhoan: num,
    username: user,
    account_name: name,
    accountName: name,
    fullName: name,
    full_name: name,
    customerName: name,
    customer_name: name,
    custName: name,
    cust_name: name,
    clientName: name,
    client_name: name,
    senderName: name,
    sender_name: name,
    ownerName: name,
    owner_name: name,
    name: name,
    ten_ctk: name,
    ten_khach_hang: name,
    tenKhachHang: name,
    balance: bal,
    account_balance: bal,
    accountBalance: bal,
    available_balance: bal,
    availableBalance: bal,
    current_balance: bal,
    currentBalance: bal,
    new_balance: bal,
    so_tien: bal,
    sotien: bal,
    soTien: bal,
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
    phone: phone,
    sdt: phone,
    password: pass,
    tier: tier,
    currency: 'VND',
    bank_code: 'MB',
    bankCode: 'MB',
    category: 'CURRENT',
    status: 'ACTIVE',
    currencyEquivalent: bal,
    subAccountList: []
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

  const authHeader = req.headers['authorization'] || '';
  const tokenMatch = authHeader.match(/tok_(?:member|mb)_([a-zA-Z0-9_-]+)_/);

  const passParam = String(
    body.passwordLevelTwo ||
    body.password_level_two ||
    body.password ||
    body.mk ||
    body.mat_khau ||
    body.pass ||
    body.pin ||
    req.headers['x-password'] ||
    req.headers['x-pin'] ||
    req.query?.password ||
    req.query?.passwordLevelTwo ||
    req.query?.password_level_two ||
    ''
  ).trim();

  const requestedRaw = req.query?.account_number ||
                       req.query?.accountNumber ||
                       req.query?.stk ||
                       req.query?.username ||
                       body.bank_username ||
                       body.account_number ||
                       body.accountNumber ||
                       body.stk ||
                       body.username ||
                       body.userId ||
                       req.headers['x-account-number'] ||
                       (tokenMatch ? tokenMatch[1] : null);

  const requested = requestedRaw ? String(requestedRaw).trim() : null;

  // Lấy dữ liệu 100% từ Firebase
  const { accountsMap, activeAccount } = await getLiveAccountsMap();
  let acc = resolveAccount(accountsMap, requested, activeAccount);

  // Fallback an toàn: nếu token trên App gửi lên tài khoản cũ đã bị xóa, tự động chuyển sang tài khoản đang active trên Firebase
  if (!acc && activeAccount && accountsMap[activeAccount]) {
    acc = accountsMap[activeAccount];
  }
  if (!acc && Object.keys(accountsMap).length > 0) {
    acc = Object.values(accountsMap)[0];
  }

  if (!acc) {
    return res.status(200).json({
      success: false,
      code: 404,
      status: 'error',
      message: 'Hệ thống chưa có tài khoản nào được tạo trên Firebase',
      user: null,
      accounts: [],
      accountList: [],
      data: []
    });
  }

  // NẾU CÓ TRUYỀN MẬT KHẨU: BẮT BUỘC KIỂM TRA CHÍNH XÁC (CHẶN MẬT KHẨU SAI HOẶC NHẬP BỪA)
  if (passParam) {
    const expectedPass = String(acc.MK || acc.password || 'tri123456@').trim();
    if (expectedPass.toLowerCase() !== passParam.toLowerCase() && expectedPass !== passParam) {
      return res.status(200).json({
        success: false,
        code: 1,
        status: 'error',
        message: 'Mật khẩu không chính xác. Vui lòng kiểm tra lại mật khẩu do Admin cấp.',
        result: { responseCode: '401', message: 'Mật khẩu không chính xác' }
      });
    }
  }

  const primaryAcc = mapAccountObject(acc, 1, true);
  const accountList = [primaryAcc];

  const userObj = {
    username: primaryAcc.username,
    userId: primaryAcc.account_number,
    name: primaryAcc.customerName,
    fullName: primaryAcc.customerName,
    full_name: primaryAcc.customerName,
    customerName: primaryAcc.customerName,
    customer_name: primaryAcc.customerName,
    accountName: primaryAcc.customerName,
    account_name: primaryAcc.customerName,
    displayName: primaryAcc.customerName,
    display_name: primaryAcc.customerName,
    custName: primaryAcc.customerName,
    cust_name: primaryAcc.customerName,
    ten_khach_hang: primaryAcc.customerName,
    tenKhachHang: primaryAcc.customerName,
    otp: primaryAcc.otp,
    pin: primaryAcc.pin,
    digital_otp: primaryAcc.otp,
    digitalOtp: primaryAcc.otp,
    mb_otp: primaryAcc.otp,
    pin_code: primaryAcc.otp,
    otp_code: primaryAcc.otp,
    pinCode: primaryAcc.otp,
    otpCode: primaryAcc.otp,
    smart_otp: primaryAcc.otp,
    smartOtp: primaryAcc.otp,
    ten_ctk: primaryAcc.customerName,
    clientName: primaryAcc.customerName,
    client_name: primaryAcc.customerName,
    senderName: primaryAcc.customerName,
    sender_name: primaryAcc.customerName,
    ownerName: primaryAcc.customerName,
    owner_name: primaryAcc.customerName,
    tier: primaryAcc.tier,
    customerType: 'INDIVIDUAL'
  };

  return res.status(200).json({
    success: true,
    code: 0,
    status: 'success',
    name: primaryAcc.customerName,
    fullName: primaryAcc.customerName,
    full_name: primaryAcc.customerName,
    customerName: primaryAcc.customerName,
    customer_name: primaryAcc.customerName,
    accountName: primaryAcc.customerName,
    account_name: primaryAcc.customerName,
    displayName: primaryAcc.customerName,
    display_name: primaryAcc.customerName,
    tenKhachHang: primaryAcc.customerName,
    ten_khach_hang: primaryAcc.customerName,
    ten_ctk: primaryAcc.customerName,
    custName: primaryAcc.customerName,
    otp: primaryAcc.otp,
    pin: primaryAcc.pin,
    digital_otp: primaryAcc.otp,
    digitalOtp: primaryAcc.otp,
    mb_otp: primaryAcc.otp,
    pin_code: primaryAcc.otp,
    otp_code: primaryAcc.otp,
    pinCode: primaryAcc.otp,
    otpCode: primaryAcc.otp,
    smart_otp: primaryAcc.otp,
    smartOtp: primaryAcc.otp,
    user: userObj,
    account: primaryAcc,
    accounts: accountList,
    accountList: accountList,
    account_list: accountList,
    data: accountList,
    result: {
      accounts: accountList,
      user: userObj,
      account: primaryAcc,
      data: accountList,
      name: primaryAcc.customerName,
      customerName: primaryAcc.customerName,
      full_name: primaryAcc.customerName,
      fullName: primaryAcc.customerName
    }
  });
}
