const FIREBASE_URL = 'https://sfsdfsf-c4c13-default-rtdb.asia-southeast1.firebasedatabase.app/mbbank';

async function getLiveRootData() {
  try {
    const res = await fetch(`${FIREBASE_URL}.json?ts=${Date.now()}`, { cache: 'no-store' });
    if (res.ok) {
      return (await res.json()) || {};
    }
  } catch (e) {}
  return {};
}

async function getStoredTransactions(accNum, name, bal, createdAt) {
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
    description: `Khoi tao so du ban dau: +${Number(bal).toLocaleString('vi-VN')} VND`,
    noi_dung: `Khoi tao so du ban dau: +${Number(bal).toLocaleString('vi-VN')} VND`,
    noidung: `Khoi tao so du ban dau: +${Number(bal).toLocaleString('vi-VN')} VND`,
    remark: `Khoi tao so du ban dau: +${Number(bal).toLocaleString('vi-VN')} VND`,
    created_at: createdAt,
    createdAt: createdAt
  };

  try {
    const accTxRes = await fetch(`${FIREBASE_URL}/accounts/${accNum}/transactions.json?ts=${Date.now()}`, { cache: 'no-store' });
    let data = null;
    if (accTxRes.ok) {
      data = await accTxRes.json();
    }

    if (data && typeof data === 'object') {
      const customList = Object.values(data)
        .filter(t => t && String(t.accountNumber || '').replace(/\D/g, '') === String(accNum).replace(/\D/g, ''))
        .filter(t => t.type === 'IN') // Chỉ trả về các giao dịch nhận/nạp tiền
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

  const root = await getLiveRootData();
  const allAccounts = root.accounts || {};

  // NGUỒN CHUẨN TỪ WEB (Hỗ trợ cả chuỗi ký tự và số)
  const masterKey = root.active_account 
    ? String(root.active_account).trim() 
    : (Object.keys(allAccounts).length > 0 ? Object.keys(allAccounts)[0] : '1800123123');

  const requestedRaw = req.query?.account_number || req.query?.accountNumber || req.query?.stk || req.headers['x-account-number'];
  const requested = requestedRaw ? String(requestedRaw).trim() : null;

  // NẾU TÀI KHOẢN YÊU CẦU KHÔNG CÓ TRÊN HỆ THỐNG, LUÔN DÙNG MASTER TÀI KHOẢN WEB!
  const accNum = (requested && allAccounts[requested]) ? requested : masterKey;
  const accData = allAccounts[accNum] || allAccounts[masterKey] || {};

  const name = String(accData.customerName || accData.accountName || root.customerName || root.accountName || 'NGUYEN NGOC TRI').trim().toUpperCase();
  const bal = typeof accData.balance === 'number' 
    ? accData.balance 
    : (typeof root.balance === 'number' ? root.balance : 200000);
  const createdAt = accData.updatedAt || root.updatedAt || new Date().toISOString();

  const list = await getStoredTransactions(accNum, name, bal, createdAt);

  return res.status(200).json({
    success: true,
    code: 0,
    status: 'success',
    accountNumber: accNum,
    balance: bal,
    transactions: list,
    data: list,
    account_number: accNum,
    account_name: name,
    customer_name: name,
    total: list.length,
    page: 1,
    limit: 20
  });
}
