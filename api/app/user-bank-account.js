const FIREBASE_BASE = 'https://sfsdfsf-c4c13-default-rtdb.asia-southeast1.firebasedatabase.app/mbbank';

async function getLiveRootData() {
  try {
    const res = await fetch(`${FIREBASE_BASE}.json?ts=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache, no-store' }
    });
    if (res.ok) {
      return (await res.json()) || {};
    }
  } catch (e) {}
  return {};
}

function mapAccountObject(acc, id = 1, isDefault = true) {
  const bal = typeof acc.balance === 'number' ? acc.balance : 0;
  const num = String(acc.accountNumber || '1800123123').replace(/\D/g, '');
  const name = String(acc.customerName || acc.accountName || 'NGUYEN NGOC TRI').trim().toUpperCase();
  const user = acc.username || num;
  const otp = String(acc.otp || '111111').trim();
  const phone = String(acc.phone || acc.sdt || num).trim();
  const pass = String(acc.password || '123456').trim();
  const tier = acc.tier || 'MB Private Banking VIP';

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
  const tokenMatch = authHeader.match(/tok_(?:member|mb)_(\d+)_/);

  const requestedRaw = req.query?.account_number ||
                       req.query?.accountNumber ||
                       req.query?.stk ||
                       req.query?.username ||
                       body.account_number ||
                       body.accountNumber ||
                       body.stk ||
                       body.username ||
                       body.userId ||
                       req.headers['x-account-number'] ||
                       (tokenMatch ? tokenMatch[1] : null);

  const requested = requestedRaw ? String(requestedRaw).trim() : null;

  const root = await getLiveRootData();
  const allAccounts = root.accounts || {};

  // NGUỒN CHUẨN MASTER TỪ WEB / ADMIN (Hỗ trợ cả chuỗi ký tự và số)
  const masterKey = root.active_account 
    ? String(root.active_account).trim() 
    : (Object.keys(allAccounts).length > 0 ? Object.keys(allAccounts)[0] : '1800123123');

  // NẾU REQUESTED KHÔNG TỒN TẠI TRONG ACCOUNTS, BẮT BUỘC KHÓA CHẶT VÀO MASTER KEY CỦA WEB!
  let currentKey = (requested && allAccounts[requested]) ? requested : masterKey;
  let current = allAccounts[currentKey] || allAccounts[masterKey] || (Object.keys(allAccounts).length > 0 ? allAccounts[Object.keys(allAccounts)[0]] : null);

  if (!current) {
    current = {
      accountNumber: masterKey,
      username: masterKey,
      accountName: root.customerName || root.accountName || 'NGUYEN NGOC TRI',
      customerName: root.customerName || root.accountName || 'NGUYEN NGOC TRI',
      balance: typeof root.balance === 'number' ? root.balance : 200000,
      phone: root.phone || root.sdt || masterKey,
      otp: root.otp || '111111',
      password: root.password || '123456',
      tier: root.tier || 'MB Private Banking VIP'
    };
  } else {
    // Luôn bảo toàn số dư gốc của chính tài khoản trong node accounts
    if (typeof current.balance !== 'number') {
      current.balance = 0;
    }
  }

  const primaryAcc = mapAccountObject(current, 1, true);

  // Chỉ trả về DUY NHẤT tài khoản đang đăng nhập / đang kích hoạt.
  // Tuyệt đối không nhồi nhét các tài khoản khác vào danh sách để tránh lẫn lộn số dư giữa các tài khoản!
  const accountList = [primaryAcc];

  const userObj = {
    username: primaryAcc.username,
    userId: primaryAcc.account_number,
    full_name: primaryAcc.customerName,
    fullName: primaryAcc.customerName,
    account_name: primaryAcc.customerName,
    accountName: primaryAcc.customerName,
    customerName: primaryAcc.customerName,
    customer_name: primaryAcc.customerName,
    custName: primaryAcc.customerName,
    cust_name: primaryAcc.customerName,
    senderName: primaryAcc.customerName,
    sender_name: primaryAcc.customerName,
    ownerName: primaryAcc.customerName,
    owner_name: primaryAcc.customerName,
    name: primaryAcc.customerName,
    tier: primaryAcc.tier,
    customerType: 'INDIVIDUAL'
  };

  return res.status(200).json({
    success: true,
    code: 0,
    status: 'success',
    user: userObj,
    accounts: accountList,
    accountList: accountList,
    account_list: accountList,
    data: accountList,
    result: {
      accounts: accountList,
      user: userObj
    }
  });
}
