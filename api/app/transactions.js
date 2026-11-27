const FIREBASE_URL = 'https://sfsdfsf-c4c13-default-rtdb.asia-southeast1.firebasedatabase.app/mbbank';

async function getActiveAccount() {
  try {
    const res = await fetch(`${FIREBASE_URL}/active_account.json`);
    if (res.ok) {
      const val = await res.json();
      if (val) return String(val).replace(/\D/g, '');
    }
  } catch (e) {}
  return '1234567890';
}

async function getAccountData(accNum) {
  try {
    const res = await fetch(`${FIREBASE_URL}/accounts/${accNum}.json`);
    if (res.ok) {
      const val = await res.json();
      if (val) return val;
    }
  } catch (e) {}
  try {
    const rRes = await fetch(`${FIREBASE_URL}.json`);
    if (rRes.ok) {
      const r = await rRes.json();
      if (r) return r;
    }
  } catch (e) {}
  return {
    accountNumber: accNum,
    customerName: 'NGUYEN NGOC TRI',
    balance: 95000000
  };
}

async function getStoredTransactions(accNum, accData) {
  const name = accData.customerName || accData.accountName || 'NGUYEN NGOC TRI';
  const bal = typeof accData.balance === 'number' ? accData.balance : 95000000;

  const defaultInitial = [
    {
      id: 'TXN-INIT-01',
      accountNumber: accNum,
      account_number: accNum,
      stk: accNum,
      type: 'IN',
      amount: 100000000,
      balance: 100000000,
      so_tien: 100000000,
      counterparty_name: 'NGAN HANG TMCP QUAN DOI (MB)',
      counterpartyName: 'NGAN HANG TMCP QUAN DOI (MB)',
      counterparty_bank: 'MB',
      counterpartyBank: 'MB',
      senderName: name,
      sender_name: name,
      customerName: name,
      customer_name: name,
      custName: name,
      accountName: name,
      account_name: name,
      fullName: name,
      full_name: name,
      description: `${name} nap tien vao tai khoan`,
      noi_dung: `${name} nap tien vao tai khoan`,
      noidung: `${name} nap tien vao tai khoan`,
      remark: `${name} nap tien vao tai khoan`,
      created_at: new Date(Date.now() - 3600000).toISOString(),
      createdAt: new Date(Date.now() - 3600000).toISOString(),
    }
  ];

  try {
    // 1. Try account-specific transactions
    let data = null;
    const accTxRes = await fetch(`${FIREBASE_URL}/accounts/${accNum}/transactions.json`);
    if (accTxRes.ok) {
      data = await accTxRes.json();
    }
    // 2. If null, fallback to global transactions
    if (!data) {
      const res = await fetch(`${FIREBASE_URL}/transactions.json`);
      if (res.ok) {
        data = await res.json();
      }
    }

    if (data && typeof data === 'object') {
      const customList = Object.values(data).map(t => ({
        id: t.id,
        accountNumber: t.accountNumber || accNum,
        account_number: t.accountNumber || accNum,
        stk: t.accountNumber || accNum,
        type: t.type || 'OUT',
        amount: t.amount,
        balance: t.balance,
        so_tien: t.amount,
        counterparty_name: t.receiverName || 'NGAN HANG TMCP QUAN DOI (MB)',
        counterpartyName: t.receiverName || 'NGAN HANG TMCP QUAN DOI (MB)',
        counterparty_bank: t.bankCode || 'MB',
        counterpartyBank: t.bankCode || 'MB',
        senderName: name,
        sender_name: name,
        customerName: name,
        customer_name: name,
        custName: name,
        accountName: name,
        account_name: name,
        fullName: name,
        full_name: name,
        description: t.description || `${name} chuyen tien`,
        noi_dung: t.description || `${name} chuyen tien`,
        noidung: t.description || `${name} chuyen tien`,
        remark: t.description || `${name} chuyen tien`,
        created_at: t.createdAt || new Date().toISOString(),
        createdAt: t.createdAt || new Date().toISOString(),
      }));
      return [...customList.reverse(), ...defaultInitial];
    }
  } catch (e) {}

  return defaultInitial;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-account-number');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const activeAcc = await getActiveAccount();
  const requestedAcc = req.query?.account_number || req.query?.accountNumber || req.query?.stk || req.headers['x-account-number'] || activeAcc;
  const accNum = String(requestedAcc).replace(/\D/g, '') || activeAcc;

  const accData = await getAccountData(accNum);
  const list = await getStoredTransactions(accNum, accData);

  return res.status(200).json({
    success: true,
    code: 0,
    status: 'success',
    accountNumber: accNum,
    balance: accData.balance || 95000000,
    transactions: list,
    data: list,
    account_number: accNum,
    account_name: accData.customerName || 'NGUYEN NGOC TRI',
    customer_name: accData.customerName || 'NGUYEN NGOC TRI',
    total: list.length,
    page: 1,
    limit: 20
  });
}
