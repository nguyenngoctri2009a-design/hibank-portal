/**
 * MB Bank Find Bank & Beneficiary Lookup API
 * SINGLE SOURCE OF TRUTH: Firebase Realtime Database
 * Tra cứu 100% qua Firebase Realtime Database (không dùng dữ liệu ảo)
 */

const FIREBASE_BASE = 'https://sfsdfsf-c4c13-default-rtdb.asia-southeast1.firebasedatabase.app';
const FIREBASE_URL = `${FIREBASE_BASE}/mbbank`;

const recipientCache = new Map();
const CACHE_TTL = 3000;

async function lookupFirebaseRecipient(query, bankCode) {
  const cacheKey = `${bankCode}_${query}`;
  const cached = recipientCache.get(cacheKey);
  if (cached && (Date.now() - cached.time < CACHE_TTL)) {
    return cached.name;
  }

  const cleanNum = String(query || '').replace(/\D/g, '');
  const qLower = String(query || '').toLowerCase();

  try {
    const [bankRes, cleanRes, rootRes] = await Promise.all([
      fetch(`${FIREBASE_URL}/recipients/${bankCode}_${query}.json?ts=${Date.now()}`, { cache: 'no-store' }),
      fetch(`${FIREBASE_URL}/recipients/${query}.json?ts=${Date.now()}`, { cache: 'no-store' }),
      fetch(`${FIREBASE_BASE}/.json?ts=${Date.now()}`, { cache: 'no-store' })
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
    if (rootRes.ok) {
      const rootData = await rootRes.json();
      if (rootData && typeof rootData === 'object') {
        for (const [k, v] of Object.entries(rootData)) {
          if (!v || typeof v !== 'object') continue;

          // Kiểm tra nếu k hoặc STK hoặc TK trùng với query
          const stk = String(v.STK || v.accountNumber || v.stk || '').trim();
          const stkNum = stk.replace(/\D/g, '');
          const tk = String(v.TK || v.username || '').toLowerCase();
          const kLower = k.toLowerCase();

          if (kLower === qLower || tk === qLower || (cleanNum && stkNum === cleanNum) || stk === query) {
            const name = String(v.customerName || v.accountName || v.TK || k).trim().toUpperCase();
            recipientCache.set(cacheKey, { name, time: Date.now() });
            return name;
          }

          // Kiểm tra subfolder recipients trong mục tài khoản đó
          if (v.recipients && typeof v.recipients === 'object') {
            const rec = v.recipients[`${bankCode}_${query}`] || v.recipients[query] || (cleanNum ? (v.recipients[`${bankCode}_${cleanNum}`] || v.recipients[cleanNum]) : null);
            if (rec && (rec.customerName || rec.accountName)) {
              const name = String(rec.customerName || rec.accountName).trim().toUpperCase();
              recipientCache.set(cacheKey, { name, time: Date.now() });
              return name;
            }
          }
        }
      }
    }
  } catch (e) {}

  return null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch(e) { body = {}; }
  }
  body = body || {};
  const b = (body && typeof body.data === 'object') ? body.data : body;

  const accNum = String(
    body.recipient_account ||
    body.recipientAccount ||
    body.recipient_account_number ||
    body.recipientAcc ||
    body.recipient_acc ||
    body.receiver_account ||
    body.receiverAccount ||
    body.beneficiary_account ||
    body.beneficiaryAccount ||
    body.account_number ||
    body.accountNumber ||
    body.stk ||
    body.acc ||
    b.recipient_account ||
    b.recipientAccount ||
    b.recipient_account_number ||
    b.recipientAcc ||
    b.recipient_acc ||
    b.receiver_account ||
    b.receiverAccount ||
    b.beneficiary_account ||
    b.beneficiaryAccount ||
    b.account_number ||
    b.accountNumber ||
    b.stk ||
    b.acc ||
    req.query?.recipient_account ||
    req.query?.recipientAccount ||
    req.query?.account_number ||
    req.query?.accountNumber ||
    req.query?.stk ||
    req.query?.acc ||
    ''
  ).trim();

  const clean = accNum;
  const bankCode = String(body.bank_code || body.bankCode || b.bank_code || b.bankCode || req.query?.bank_code || req.query?.bankCode || 'MB').toUpperCase();
  const customNameParam = body.account_name || body.accountName || body.customerName || b.account_name || b.accountName || req.query?.name;

  if (!accNum) {
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

  let resolvedName = null;

  if (customNameParam && typeof customNameParam === 'string' && customNameParam.trim().length > 1) {
    resolvedName = customNameParam.trim().toUpperCase();
  } else {
    resolvedName = await lookupFirebaseRecipient(accNum, bankCode);
  }

  if (!resolvedName) {
    return res.status(200).json({
      success: false,
      code: 1,
      status: 'error',
      message: 'Tài khoản không tồn tại',
      account_number: accNum,
      accountNumber: accNum,
      stk: accNum,
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
    'LPB': 'NGAN HANG TMCP LOC PHAT VIET NAM (LPBANK)'
  };

  const fullBankName = bankNameMap[bankCode] || `NGAN HANG ${bankCode}`;

  const payload = {
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
    status: 'ACTIVE'
  };

  return res.status(200).json({
    success: true,
    code: 0,
    status: 'success',
    data: payload,
    result: payload,
    ...payload
  });
}
