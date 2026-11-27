const FIREBASE_URL = 'https://sfsdfsf-c4c13-default-rtdb.asia-southeast1.firebasedatabase.app/mbbank';

async function getActiveAccount() {
  try {
    const res = await fetch(`${FIREBASE_URL}/active_account.json?ts=${Date.now()}`, { cache: 'no-store' });
    if (res.ok) {
      const val = await res.json();
      if (val) return String(val).replace(/\D/g, '');
    }
  } catch (e) {}
  return '1800123123';
}

async function getAccountData(accNum) {
  try {
    const res = await fetch(`${FIREBASE_URL}/accounts/${accNum}.json?ts=${Date.now()}`, { cache: 'no-store' });
    if (res.ok) {
      const val = await res.json();
      if (val) return val;
    }
  } catch (e) {}
  try {
    const rRes = await fetch(`${FIREBASE_URL}.json?ts=${Date.now()}`, { cache: 'no-store' });
    if (rRes.ok) {
      const r = await rRes.json();
      if (r) {
        if (r.accounts && r.accounts[accNum]) return r.accounts[accNum];
        return r;
      }
    }
  } catch (e) {}
  return {
    accountNumber: accNum,
    customerName: 'NGUYEN NGOC TRI',
    balance: 0
  };
}

async function getStoredTransactions(accNum, accData) {
  const name = (accData.customerName || accData.accountName || 'NGUYEN NGOC TRI').toUpperCase();
  const bal = typeof accData.balance === 'number' ? accData.balance : 0;
  const createdAt = accData.updatedAt || new Date(Date.now() - 3600000).toISOString();

  // Biến động số dư khởi tạo độc lập - chính xác số dư ban đầu của tài khoản này
  const initialTransaction = {
    id: `TXN-INIT-${accNum}`,
    accountNumber: accNum,
    account_number: accNum,
    stk: accNum,
    type: 'IN',
    amount: bal,
    balance: bal,
    so_tien: bal,
    counterparty_name: 'NGAN HANG TMCP QUAN DOI (MB)',
    counterpartyName: 'NGAN HANG TMCP QUAN DOI (MB)',
    counterparty_bank: 'MB',
    counterpartyBank: 'MB',
    senderName: 'NGAN HANG TMCP QUAN DOI (MB)',
    sender_name: 'NGAN HANG TMCP QUAN DOI (MB)',
    customerName: name,
    customer_name: name,
    custName: name,
    accountName: name,
    account_name: name,
    fullName: name,
    full_name: name,
    description: `Khoi tao so du ban dau: +${bal.toLocaleString('vi-VN')} VND`,
    noi_dung: `Khoi tao so du ban dau: +${bal.toLocaleString('vi-VN')} VND`,
    noidung: `Khoi tao so du ban dau: +${bal.toLocaleString('vi-VN')} VND`,
    remark: `Khoi tao so du ban dau: +${bal.toLocaleString('vi-VN')} VND`,
    created_at: createdAt,
    createdAt: createdAt
  };

  try {
    // CHỈ ĐỌC DUY NHẤT NODE CỦA TÀI KHOẢN NÀY - TUYỆT ĐỐI KHÔNG ĐỌC TÀI KHOẢN KHÁC
    const accTxRes = await fetch(`${FIREBASE_URL}/accounts/${accNum}/transactions.json?ts=${Date.now()}`, { cache: 'no-store' });
    let data = null;
    if (accTxRes.ok) {
      data = await accTxRes.json();
    }

    if (data && typeof data === 'object') {
      const customList = Object.values(data)
        .filter(t => t && String(t.accountNumber || '').replace(/\D/g, '') === String(accNum).replace(/\D/g, ''))
        .filter(t => t.type === 'IN') // Chỉ trả về giao dịch nhận/nạp tiền (IN). Giao dịch chuyển tiền (OUT) App MB đã tự lưu và hiển thị cục bộ qua .mb_tx_history_vault.json, tránh bị nhân đôi!
        .map(t => ({
          id: t.id,
          accountNumber: accNum,
          account_number: accNum,
          stk: accNum,
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

      if (customList.length > 0) {
        return [...customList.reverse(), initialTransaction];
      }
    }
  } catch (e) {}

  return [initialTransaction];
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
    balance: accData.balance || 0,
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
