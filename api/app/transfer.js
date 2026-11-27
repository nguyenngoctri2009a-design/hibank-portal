/**
 * MB Bank Transfer API
 * Deducts balance directly from the account folder on Firebase
 * Logs transaction directly to that account's /transactions on Firebase
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

async function resolveRecipient(targetAcc, customName, bankCode = 'MB') {
  if (customName && typeof customName === 'string' && customName.trim().length > 1) {
    return customName.trim().toUpperCase();
  }
  const clean = String(targetAcc || '').replace(/\D/g, '');
  if (!clean) return 'NGUOI NHAN';

  try {
    const [bankRes, cleanRes, rootRes] = await Promise.all([
      fetch(`${FIREBASE_URL}/recipients/${bankCode}_${clean}.json?ts=${Date.now()}`, { cache: 'no-store' }),
      fetch(`${FIREBASE_URL}/recipients/${clean}.json?ts=${Date.now()}`, { cache: 'no-store' }),
      fetch(`${FIREBASE_BASE}/.json?ts=${Date.now()}`, { cache: 'no-store' })
    ]);

    if (bankRes.ok) {
      const d = await bankRes.json();
      if (d && (d.customerName || d.accountName)) return (d.customerName || d.accountName).trim().toUpperCase();
    }
    if (cleanRes.ok) {
      const d = await cleanRes.json();
      if (d && (d.customerName || d.accountName)) return (d.customerName || d.accountName).trim().toUpperCase();
    }
    if (rootRes.ok) {
      const rootData = await rootRes.json();
      if (rootData && typeof rootData === 'object') {
        for (const [k, v] of Object.entries(rootData)) {
          if (!v || typeof v !== 'object') continue;
          const stk = String(v.STK || v.accountNumber || v.stk || '').replace(/\D/g, '');
          const tk = String(v.TK || v.username || '').toLowerCase();
          if (stk === clean || k === clean || tk === clean.toLowerCase()) {
            return String(v.customerName || v.accountName || v.TK || k).trim().toUpperCase();
          }
          if (v.recipients && typeof v.recipients === 'object') {
            const rec = v.recipients[`${bankCode}_${clean}`] || v.recipients[clean];
            if (rec && (rec.customerName || rec.accountName)) {
              return String(rec.customerName || rec.accountName).trim().toUpperCase();
            }
          }
        }
      }
    }
  } catch (e) {}

  return clean || 'NGUOI NHAN';
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

  // 1. Tìm tài khoản người gửi trên Firebase
  const { accountsMap, activeAccount } = await getLiveAccountsMap();
  const rawSender = String(
    body.sender_account || 
    body.senderAccount || 
    body.from_account || 
    body.fromAccount || 
    body.account_number || 
    req.headers['x-account-number'] || 
    ''
  ).trim();

  const senderAcc = resolveAccount(accountsMap, rawSender, activeAccount);

  if (!senderAcc) {
    return res.status(200).json({
      success: false,
      status: 'error',
      code: 404,
      message: 'Tài khoản người gửi không tồn tại trên hệ thống Firebase'
    });
  }

  const folder = senderAcc._folder || senderAcc.TK || senderAcc.username;
  const senderBal = typeof senderAcc.balance === 'number' ? senderAcc.balance : (typeof senderAcc.TIEN === 'number' ? senderAcc.TIEN : 0);
  const senderName = String(senderAcc.customerName || senderAcc.accountName || senderAcc.TK || folder).trim().toUpperCase();
  const senderNum = senderAcc.STK || senderAcc.accountNumber || senderAcc.stk || folder;
  const expectedPin = String(senderAcc.OTP || senderAcc.otp || senderAcc.pin || '111111').trim();

  // 2. Kiểm tra mã PIN / Digital OTP
  const b = (body && typeof body.data === 'object') ? body.data : body;
  const rawInputPin = String(
    body.pin_code ||
    body.pinCode ||
    body.digital_otp ||
    body.digitalOtp ||
    body.otp_code ||
    body.otpCode ||
    body.pin ||
    body.otp ||
    body.mb_otp ||
    body.mbOtp ||
    body.smart_otp ||
    body.smartOtp ||
    body.pincode ||
    b.pin_code ||
    b.pinCode ||
    b.digital_otp ||
    b.digitalOtp ||
    b.otp_code ||
    b.otpCode ||
    b.pin ||
    b.otp ||
    req.query?.pin ||
    req.query?.otp ||
    ''
  ).trim();

  if (rawInputPin && rawInputPin !== expectedPin) {
    return res.status(200).json({
      success: false,
      status: 'error',
      code: 1,
      message: 'Mã PIN Digital OTP không chính xác. Vui lòng kiểm tra lại.',
      result: {
        responseCode: '401',
        message: 'Mã PIN Digital OTP không chính xác'
      }
    });
  }

  const amount = Number(body.amount || req.query?.amount || 0);
  if (amount > senderBal) {
    return res.status(200).json({
      success: false,
      status: 'error',
      code: 1,
      message: 'Số dư khả dụng không đủ để thực hiện giao dịch.',
      result: {
        responseCode: '400',
        message: 'Số dư khả dụng không đủ'
      }
    });
  }

  // 3. TRỪ TRỰC TIẾP VÀO SỐ DƯ GỐC CỦA MỤC TÀI KHOẢN TRÊN FIREBASE (KHÔNG TẠO FILE JSON, GỌI API CLOUD FIREBASE)
  const newBal = Math.max(0, senderBal - amount);
  const patchData = {
    balance: newBal,
    TIEN: newBal,
    updatedAt: new Date().toISOString()
  };

  try {
    await fetch(`${FIREBASE_BASE}/${folder}.json`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patchData)
    });
  } catch (e) {}

  const targetAcc = body.receiver_account_number || body.receiver_account || body.receiverAccount || body.recipient_account_number || body.account_number || '0987654321';
  const customReceiver = body.receiver_name || body.beneficiary_name || body.account_name;
  const bankCode = body.bank_code || body.bankCode || 'MB';
  const receiverName = await resolveRecipient(targetAcc, customReceiver, bankCode);

  const txnId = 'TXN-' + Date.now();
  const desc = body.description || body.noi_dung || body.remark || `${senderName} chuyen tien cho ${receiverName}`;

  const txnRecord = {
    id: txnId,
    accountNumber: senderNum,
    type: 'OUT',
    amount: amount,
    balance: newBal,
    receiverName: receiverName,
    receiverAccount: targetAcc,
    bankCode: bankCode,
    description: desc,
    createdAt: new Date().toISOString()
  };

  // 4. LƯU BÁO CÁO GIAO DỊCH DUY NHẤT VÀO /<TK>/transactions TRÊN FIREBASE
  try {
    await fetch(`${FIREBASE_BASE}/${folder}/transactions.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(txnRecord)
    });
  } catch (e) {}

  return res.status(200).json({
    success: true,
    status: 'success',
    code: 0,
    message: 'Chuyen tien thanh cong',
    transaction_id: txnId,
    transactionId: txnId,
    amount: amount,
    balance: newBal,
    new_balance: newBal,
    so_tien: newBal,
    description: desc,
    noi_dung: desc,
    data: {
      transactionId: txnId,
      transaction_id: txnId,
      amount: amount,
      balance: newBal,
      new_balance: newBal,
      so_tien: newBal,
      senderName: senderName,
      sender_name: senderName,
      senderAccount: senderNum,
      sender_account: senderNum,
      receiverName: receiverName,
      receiver_name: receiverName,
      beneficiaryName: receiverName,
      beneficiary_name: receiverName,
      receiverAccount: targetAcc,
      receiver_account: targetAcc,
      customerName: senderName,
      accountName: senderName,
      fullName: senderName,
      full_name: senderName,
      accountNumber: senderNum,
      account_number: senderNum,
      stk: senderNum,
      description: desc
    },
    result: {
      responseCode: '00',
      message: 'Success',
      data: {
        transactionId: txnId,
        balance: newBal,
        amount: amount
      }
    }
  });
}
