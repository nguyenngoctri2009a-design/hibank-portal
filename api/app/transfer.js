const FIREBASE_URL = 'https://sfsdfsf-c4c13-default-rtdb.asia-southeast1.firebasedatabase.app/mbbank';

async function resolveRecipient(targetAcc, customName, bankCode = 'MB') {
  if (customName && typeof customName === 'string' && customName.trim().length > 1) {
    return customName.trim().toUpperCase();
  }
  const clean = String(targetAcc || '').replace(/\D/g, '');
  if (!clean) return 'NGUOI NHAN';

  try {
    if (bankCode) {
      const bRes = await fetch(`${FIREBASE_URL}/recipients/${bankCode}_${clean}.json`);
      if (bRes.ok) {
        const d = await bRes.json();
        if (d && (d.customerName || d.accountName)) return (d.customerName || d.accountName).trim().toUpperCase();
      }
    }
    const rRes = await fetch(`${FIREBASE_URL}/recipients/${clean}.json`);
    if (rRes.ok) {
      const d = await rRes.json();
      if (d && (d.customerName || d.accountName)) return (d.customerName || d.accountName).trim().toUpperCase();
    }

    const aRes = await fetch(`${FIREBASE_URL}/accounts/${clean}.json`);
    if (aRes.ok) {
      const d = await aRes.json();
      if (d && (d.customerName || d.accountName)) return (d.customerName || d.accountName).trim().toUpperCase();
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

  // 1. Fetch live active account and all accounts from Firebase
  let activeAccKey = '1800123123';
  let allAccounts = {};
  try {
    const [actRes, accsRes] = await Promise.all([
      fetch(`${FIREBASE_URL}/active_account.json?ts=${Date.now()}`, { cache: 'no-store' }),
      fetch(`${FIREBASE_URL}/accounts.json?ts=${Date.now()}`, { cache: 'no-store' })
    ]);
    if (actRes.ok) {
      const val = await actRes.json();
      if (val) activeAccKey = String(val).trim();
    }
    if (accsRes.ok) {
      allAccounts = (await accsRes.json()) || {};
    }
  } catch (e) {}

  // Xác định tài khoản người chuyển:
  // Nếu client gửi sender_account / from_account và có trong allAccounts thì dùng, ngược lại dùng activeAccKey
  const rawSender = String(body.sender_account || body.senderAccount || body.from_account || body.fromAccount || '').trim();
  const senderKey = (rawSender && allAccounts[rawSender]) ? rawSender : activeAccKey;

  const senderData = allAccounts[senderKey] || allAccounts[activeAccKey] || {};
  let senderBal = typeof senderData.balance === 'number' ? senderData.balance : 0;
  const senderName = String(senderData.customerName || senderData.accountName || 'NGUYEN NGOC TRI').trim().toUpperCase();
  const expectedPin = String(senderData.otp || senderData.pin || '111111').trim();
  const senderNum = senderData.accountNumber || senderData.stk || senderKey;

  // 2. Kiểm tra mã PIN / OTP người dùng nhập
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

  // TRỪ THẲNG VÀO TIỀN GỐC CỦA CHÍNH TÀI KHOẢN ĐÓ
  const newBal = Math.max(0, senderBal - amount);

  try {
    await fetch(`${FIREBASE_URL}/accounts/${senderKey}.json`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        balance: newBal,
        updatedAt: new Date().toISOString()
      })
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

  // GHI THÔNG BÁO CHUYỂN TIỀN VÀO ĐÚNG MỤC TRANSACTIONS CỦA TÀI KHOẢN ĐÓ
  try {
    await fetch(`${FIREBASE_URL}/accounts/${senderKey}/transactions.json`, {
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
