const FIREBASE_URL = 'https://sfsdfsf-c4c13-default-rtdb.asia-southeast1.firebasedatabase.app/mbbank';

async function getLiveRoot() {
  try {
    const res = await fetch(`${FIREBASE_URL}.json?ts=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache, no-store' }
    });
    if (res.ok) {
      return (await res.json()) || {};
    }
  } catch (e) {}
  return {};
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

  const root = await getLiveRoot();
  const activeKey = root.active_account ? String(root.active_account).replace(/\D/g, '') : (root.accountNumber || '1800123123');
  const allAccounts = root.accounts || {};
  const acc = allAccounts[activeKey] || (Object.keys(allAccounts).length > 0 ? allAccounts[Object.keys(allAccounts)[0]] : null) || {};

  const num = acc.accountNumber || root.accountNumber || activeKey;
  const name = String(acc.customerName || acc.accountName || root.customerName || root.accountName || 'NGUYEN NGOC TRI').trim().toUpperCase();
  const bal = typeof acc.balance === 'number' ? acc.balance : (typeof root.balance === 'number' ? root.balance : 200000);

  const payload = {
    success: true,
    status: 'success',
    code: 0,
    message: 'OK',
    customerName: name,
    customer_name: name,
    custName: name,
    accountName: name,
    account_name: name,
    name: name,
    fullName: name,
    full_name: name,
    ten_ctk: name,
    accountNumber: num,
    account_number: num,
    stk: num,
    so_tai_khoan: num,
    sotaikhoan: num,
    balance: bal,
    account_balance: bal,
    accountBalance: bal,
    new_balance: bal,
    available_balance: bal,
    so_tien: bal,
    sotien: bal,
    data: {
      accountNumber: num,
      account_number: num,
      stk: num,
      balance: bal,
      accountName: name,
      customerName: name
    },
    result: {
      accountNumber: num,
      account_number: num,
      stk: num,
      balance: bal,
      accountName: name,
      customerName: name
    }
  };

  return res.status(200).json(payload);
}
