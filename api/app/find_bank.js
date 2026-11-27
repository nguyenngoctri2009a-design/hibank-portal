const FIREBASE_URL = 'https://sfsdfsf-c4c13-default-rtdb.asia-southeast1.firebasedatabase.app/mbbank';

// In-memory micro-cache (3 seconds TTL) for fast recipient lookups
const recipientCache = new Map();
const CACHE_TTL = 3000;

async function lookupFirebaseRecipient(clean, bankCode) {
  const cacheKey = `${bankCode}_${clean}`;
  const cached = recipientCache.get(cacheKey);
  if (cached && (Date.now() - cached.time < CACHE_TTL)) {
    return cached.name;
  }

  try {
    const [bankRes, cleanRes, accRes] = await Promise.all([
      fetch(`${FIREBASE_URL}/recipients/${bankCode}_${clean}.json`, { headers: { 'Connection': 'keep-alive' } }),
      fetch(`${FIREBASE_URL}/recipients/${clean}.json`, { headers: { 'Connection': 'keep-alive' } }),
      fetch(`${FIREBASE_URL}/accounts/${clean}.json`, { headers: { 'Connection': 'keep-alive' } })
    ]);

    if (bankRes.ok) {
      const data = await bankRes.json();
      if (data && (data.customerName || data.accountName)) {
        const name = (data.customerName || data.accountName).trim().toUpperCase();
        recipientCache.set(cacheKey, { name, time: Date.now() });
        return name;
      }
    }
    if (cleanRes.ok) {
      const data = await cleanRes.json();
      if (data && (data.customerName || data.accountName)) {
        const name = (data.customerName || data.accountName).trim().toUpperCase();
        recipientCache.set(cacheKey, { name, time: Date.now() });
        return name;
      }
    }
    if (accRes.ok) {
      const data = await accRes.json();
      if (data && (data.customerName || data.accountName)) {
        const name = (data.customerName || data.accountName).trim().toUpperCase();
        recipientCache.set(cacheKey, { name, time: Date.now() });
        return name;
      }
    }
  } catch (e) {}

  return null;
}

async function getOwnerInfo() {
  try {
    const res = await fetch(`${FIREBASE_URL}.json`, { headers: { 'Connection': 'keep-alive' } });
    if (res.ok) {
      const root = await res.json();
      if (root) {
        const ownerAcc = String(root.active_account || root.accountNumber || '1234567890').replace(/\D/g, '');
        const ownerName = (root.customerName || root.accountName || 'NGUYEN NGOC TRI').trim().toUpperCase();
        return { ownerAcc, ownerName };
      }
    }
  } catch (e) {}
  return { ownerAcc: '1234567890', ownerName: 'NGUYEN NGOC TRI' };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'public, s-maxage=1, stale-while-revalidate=5');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch(e) { body = {}; }
  }
  body = body || {};

  const accNum = body.account_number || body.accountNumber || body.stk || body.acc || req.query?.account_number || req.query?.accountNumber || req.query?.stk;
  const bankCode = (body.bank_code || body.bankCode || req.query?.bank_code || req.query?.bankCode || 'MB').toUpperCase();
  const customNameParam = body.account_name || body.accountName || body.customerName || req.query?.name;

  const clean = String(accNum || '').replace(/\D/g, '');

  if (!clean) {
    return res.status(200).json({
      success: false,
      code: 1,
      status: 'error',
      message: 'Vui lòng nhập số tài khoản',
      account_name: 'Tài khoản không tồn tại',
      accountName: 'Tài khoản không tồn tại',
      customerName: 'Tài khoản không tồn tại',
      data: null
    });
  }

  const owner = await getOwnerInfo();

  let resolvedName = null;

  if (customNameParam && typeof customNameParam === 'string' && customNameParam.trim().length > 1) {
    resolvedName = customNameParam.trim().toUpperCase();
  } else if (clean === owner.ownerAcc || clean === '1234567890') {
    resolvedName = owner.ownerName;
  } else {
    // Chỉ lấy tên đã có sẵn trong Firebase
    resolvedName = await lookupFirebaseRecipient(clean, bankCode);
  }

  // NẾU CHƯA NHẬP / KHÔNG CÓ TRONG FIREBASE -> HIỆN KHÔNG TỒN TẠI (XÓA BỎ HẾT TÊN ẢO)
  if (!resolvedName) {
    return res.status(200).json({
      success: false,
      code: 1,
      status: 'error',
      message: 'Tài khoản không tồn tại',
      account_number: clean,
      accountNumber: clean,
      stk: clean,
      account_name: 'Tài khoản không tồn tại',
      accountName: 'Tài khoản không tồn tại',
      customerName: 'Tài khoản không tồn tại',
      customer_name: 'Tài khoản không tồn tại',
      beneficiaryName: 'Tài khoản không tồn tại',
      beneficiary_name: 'Tài khoản không tồn tại',
      receiverName: 'Tài khoản không tồn tại',
      receiver_name: 'Tài khoản không tồn tại',
      fullName: 'Tài khoản không tồn tại',
      full_name: 'Tài khoản không tồn tại',
      name: 'Tài khoản không tồn tại',
      bank_code: bankCode,
      bankCode: bankCode,
      data: null
    });
  }

  const bankNameMap = {
    'MB': 'NGAN HANG TMCP QUAN DOI (MB)',
    'VCB': 'NGAN HANG TMCP NGOAI THUONG VIET NAM (VIETCOMBANK)',
    'TCB': 'NGAN HANG TMCP KY THUONG VIET NAM (TECHCOMBANK)',
    'CTG': 'NGAN HANG TMCP CONG THUONG VIET NAM (VIETINBANK)',
    'BIDV': 'NGAN HANG TMCP DAU TU VA PHAT TRIEN VIET NAM',
    'VPB': 'NGAN HANG TMCP VIET NAM THINH VUONG (VPBANK)',
    'ACB': 'NGAN HANG TMCP A CHAU (ACB)',
    'TPB': 'NGAN HANG TMCP TIEN PHONG (TPBANK)',
    'STB': 'NGAN HANG TMCP SAIGON THUONG TIN (SACOMBANK)',
    'VIB': 'NGAN HANG TMCP QUOC TE VIET NAM (VIB)',
    'SHB': 'NGAN HANG TMCP SAI GON - HA NOI (SHB)',
    'MSB': 'NGAN HANG TMCP HANG HAI VIET NAM (MSB)',
    'HDB': 'NGAN HANG TMCP PHAT TRIEN TP.HCM (HDBANK)',
    'OCB': 'NGAN HANG TMCP PHUONG DONG (OCB)',
    'LPB': 'NGAN HANG TMCP LOC PHAT VIET NAM (LPBANK)',
    'MOMO': 'VI DIEN TU MOMO',
    'ZALOPAY': 'VI DIEN TU ZALOPAY'
  };

  const fullBankName = bankNameMap[bankCode] || `NGAN HANG ${bankCode}`;

  const payload = {
    success: true,
    status: 'success',
    code: 0,
    account_number: clean,
    accountNumber: clean,
    stk: clean,
    account_name: resolvedName,
    accountName: resolvedName,
    customerName: resolvedName,
    customer_name: resolvedName,
    beneficiaryName: resolvedName,
    beneficiary_name: resolvedName,
    receiverName: resolvedName,
    receiver_name: resolvedName,
    fullName: resolvedName,
    full_name: resolvedName,
    name: resolvedName,
    bank_code: bankCode,
    bankCode: bankCode,
    bank_name: fullBankName,
    bankName: fullBankName,
    data: {
      account_number: clean,
      accountNumber: clean,
      stk: clean,
      account_name: resolvedName,
      accountName: resolvedName,
      customerName: resolvedName,
      bank_code: bankCode,
      bankCode: bankCode,
      bank_name: fullBankName,
      bankName: fullBankName
    }
  };

  return res.status(200).json(payload);
}
