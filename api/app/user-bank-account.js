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
  const num = acc.accountNumber || '1234567890';
  const name = acc.customerName || acc.accountName || 'THÀNH VIÊN MB';
  const user = acc.username || num;
  const otp = acc.otp || '111111';
  const phone = acc.phone || acc.sdt || num;
  const pass = acc.password || '123456';

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
    tier: acc.tier || 'MB Priority Digital',
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

  const requested = requestedRaw ? String(requestedRaw).replace(/\D/g, '') : null;

  const root = await getLiveRootData();
  const allAccounts = root.accounts || {};
  const activeKey = requested || (root.active_account ? String(root.active_account).replace(/\D/g, '') : (root.accountNumber || '1800123123'));

  let current = allAccounts[activeKey];
  if (!current) {
    current = {
      accountNumber: root.accountNumber || activeKey,
      username: root.username || activeKey,
      accountName: root.customerName || root.accountName || 'THÀNH VIÊN MB',
      customerName: root.customerName || root.accountName || 'THÀNH VIÊN MB',
      balance: typeof root.balance === 'number' ? root.balance : 0,
      phone: root.phone || root.sdt || activeKey,
      otp: root.otp || '111111',
      password: root.password || '123456',
      tier: root.tier || 'MB Priority Digital'
    };
  } else {
    // Luôn ưu tiên số dư mới nhất từ Firebase (cho dù vừa được cập nhật ở root hay sub-node)
    if (activeKey === String(root.active_account || root.accountNumber || '').replace(/\D/g, '')) {
      if (typeof root.balance === 'number') {
        current.balance = root.balance;
      }
    }
    if (typeof current.balance !== 'number') {
      current.balance = typeof root.balance === 'number' ? root.balance : 0;
    }
  }

  const primaryAcc = mapAccountObject(current, 1, true);

  const accountList = [primaryAcc];
  let idCounter = 2;
  for (const [key, item] of Object.entries(allAccounts)) {
    if (key !== primaryAcc.account_number && item && item.accountNumber) {
      accountList.push(mapAccountObject(item, idCounter++, false));
    }
  }

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
    tier: current.tier || 'MB Priority Digital',
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
