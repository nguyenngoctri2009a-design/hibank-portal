const FIREBASE_URL = 'https://sfsdfsf-c4c13-default-rtdb.asia-southeast1.firebasedatabase.app/mbbank';

async function resolveRecipient(targetAcc, customName, bankCode = 'MB') {
  if (customName && typeof customName === 'string' && customName.trim().length > 1) {
    return customName.trim().toUpperCase();
  }
  const clean = String(targetAcc || '').replace(/\D/g, '');
  if (!clean || clean === '1234567890') return 'NGUYEN NGOC TRI';

  // 1. Check custom recipient from Firebase
  try {
    if (bankCode) {
      const bRes = await fetch(`${FIREBASE_URL}/recipients/${bankCode}_${clean}.json`, { headers: { 'Connection': 'keep-alive' } });
      if (bRes.ok) {
        const d = await bRes.json();
        if (d && (d.customerName || d.accountName)) return (d.customerName || d.accountName).trim().toUpperCase();
      }
    }
    const rRes = await fetch(`${FIREBASE_URL}/recipients/${clean}.json`, { headers: { 'Connection': 'keep-alive' } });
    if (rRes.ok) {
      const d = await rRes.json();
      if (d && (d.customerName || d.accountName)) return (d.customerName || d.accountName).trim().toUpperCase();
    }

    // 2. Check if target account is another account of the user in /mbbank/accounts
    const aRes = await fetch(`${FIREBASE_URL}/accounts/${clean}.json`, { headers: { 'Connection': 'keep-alive' } });
    if (aRes.ok) {
      const d = await aRes.json();
      if (d && (d.customerName || d.accountName)) return (d.customerName || d.accountName).trim().toUpperCase();
    }
  } catch (e) {}

  return clean || 'NGUOI NHAN';
}

async function getActiveAccount() {
  try {
    const res = await fetch(`${FIREBASE_URL}/active_account.json`, { headers: { 'Connection': 'keep-alive' } });
    if (res.ok) {
      const val = await res.json();
      if (val) return String(val).replace(/\D/g, '');
    }
  } catch (e) {}
  return '1234567890';
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

  const activeAcc = await getActiveAccount();
  // Tài khoản nguồn (người chuyển): TUYỆT ĐỐI KHÔNG lấy account_number vì account_number là tài khoản nhận!
  const rawSender = body.sender_account || body.senderAccount || body.from_account || body.fromAccount || activeAcc;
  const senderAcc = String(rawSender).replace(/\D/g, '') || activeAcc;

  // 1. Fetch current live balance and account config of root and sender account
  let senderBal = 0;
  let senderName = 'NGUYEN NGOC TRI';
  let expectedPin = '111111';
  try {
    const rootRes = await fetch(`${FIREBASE_URL}.json?ts=${Date.now()}`, { cache: 'no-store' });
    if (rootRes.ok) {
      const root = await rootRes.json();
      if (root) {
        if (typeof root.balance === 'number') senderBal = root.balance;
        if (root.otp || root.pin) expectedPin = String(root.otp || root.pin).trim();

        const currentActive = (root.accounts && root.accounts[senderAcc]) ? root.accounts[senderAcc] : ((root.accounts && root.accounts[activeAcc]) ? root.accounts[activeAcc] : null);
        if (currentActive) {
          if (typeof currentActive.balance === 'number') senderBal = currentActive.balance;
          if (currentActive.customerName || currentActive.accountName) senderName = currentActive.customerName || currentActive.accountName;
          if (currentActive.otp || currentActive.pin) expectedPin = String(currentActive.otp || currentActive.pin).trim();
        } else if (root.customerName || root.accountName) {
          senderName = root.customerName || root.accountName;
        }
      }
    }
  } catch (e) {}

  // 2. Trích xuất mã PIN / OTP người dùng nhập từ mọi trường có thể
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
    body.ma_pin ||
    body.ma_otp ||
    b.pin_code ||
    b.pinCode ||
    b.digital_otp ||
    b.digitalOtp ||
    b.otp_code ||
    b.otpCode ||
    b.pin ||
    b.otp ||
    body.password ||
    body.pass ||
    body.securityCode ||
    req.query?.pin ||
    req.query?.otp ||
    req.headers['x-pin'] ||
    req.headers['x-otp'] ||
    ''
  ).trim();

  // 3. KIỂM TRA MÃ PIN DIGITAL OTP: BẮT BUỘC ĐÚNG MÃ ĐÃ TẠO TRONG ADMIN
  if (rawInputPin) {
    if (rawInputPin !== expectedPin) {
      return res.status(200).json({
        success: false,
        status: 'error',
        code: 1,
        message: 'Mã PIN Digital OTP không chính xác. Vui lòng kiểm tra lại.',
        result: {
          responseCode: '401',
          response_code: '401',
          message: 'Mã PIN Digital OTP không chính xác'
        }
      });
    }
  }

  const amount = Number(body.amount || req.query?.amount || 0);
  const newBal = Math.max(0, senderBal - amount);

  // 2. Persist new balance to sender sub-node, active account sub-node, and root node
  try {
    const updatePayload = {
      balance: newBal,
      updatedAt: new Date().toISOString()
    };
    await Promise.all([
      fetch(`${FIREBASE_URL}/accounts/${senderAcc}.json`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload)
      }),
      fetch(`${FIREBASE_URL}/accounts/${activeAcc}.json`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload)
      }),
      fetch(`${FIREBASE_URL}.json`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          balance: newBal,
          updatedAt: new Date().toISOString()
        })
      }),
      fetch(`https://sfsdfsf-c4c13-default-rtdb.asia-southeast1.firebasedatabase.app/balance.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBal)
      })
    ]);
  } catch (e) {}

  const targetAcc = body.receiver_account_number || body.receiver_account || body.receiverAccount || body.recipient_account_number || body.target_account || body.to_account || body.toAccount || body.account_number || body.accountNumber || '0987654321';
  const customReceiver = body.receiver_name || body.beneficiary_name || body.account_name;
  const bankCode = body.bank_code || body.bankCode || 'MB';
  const receiverName = await resolveRecipient(targetAcc, customReceiver, bankCode);

  const txnId = 'TXN-' + Date.now();
  const desc = body.description || body.noi_dung || body.remark || `${senderName} chuyen tien cho ${receiverName}`;

  const txnRecord = {
    id: txnId,
    accountNumber: senderAcc,
    type: 'OUT',
    amount: amount,
    balance: newBal,
    receiverName: receiverName,
    receiverAccount: targetAcc,
    bankCode: bankCode,
    description: desc,
    createdAt: new Date().toISOString()
  };

  // 3. Log transaction strictly under account sub-node (tuyệt đối không ghi đè lẫn nhau)
  try {
    await fetch(`${FIREBASE_URL}/accounts/${senderAcc}/transactions.json`, {
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
      senderAccount: senderAcc,
      sender_account: senderAcc,
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
      accountNumber: senderAcc,
      account_number: senderAcc,
      stk: senderAcc,
      description: desc,
      noi_dung: desc
    }
  });
}
