/**
 * MB Bank VietQR Decoder API
 * Decodes EMVCo standard VietQR string or extracts bank, account number, amount, and content
 * SINGLE SOURCE OF TRUTH: Firebase Realtime Database
 */

const BANK_BIN_MAP = {
  '970422': 'MB',
  '970436': 'VCB',
  '970407': 'TCB',
  '970415': 'CTG',
  '970418': 'BIDV',
  '970432': 'VPB',
  '970416': 'ACB',
  '970423': 'TPB',
  '970443': 'SHB',
  '970403': 'STB',
  '970441': 'VIB',
  '970437': 'HDB',
  '970448': 'OCB',
  '970449': 'LPB',
  '970426': 'MSB'
};

const BANK_NAME_MAP = {
  'MB': 'NGAN HANG TMCP QUAN DOI (MB)',
  'VCB': 'NGAN HANG TMCP NGOAI THUONG VIET NAM (VIETCOMBANK)',
  'TCB': 'NGAN HANG TMCP KY THUONG VIET NAM (TECHCOMBANK)',
  'CTG': 'NGAN HANG TMCP CONG THUONG VIET NAM (VIETINBANK)',
  'BIDV': 'NGAN HANG TMCP DAU TU VA PHAT TRIEN VIET NAM',
  'VPB': 'NGAN HANG TMCP VIET NAM THINH VUONG (VPBANK)',
  'ACB': 'NGAN HANG TMCP A CHAU (ACB)',
  'TPB': 'NGAN HANG TMCP TIEN PHONG (TPBANK)',
  'SHB': 'NGAN HANG TMCP SAI GON - HA NOI (SHB)',
  'STB': 'NGAN HANG TMCP SAIGON THUONG TIN (SACOMBANK)',
  'VIB': 'NGAN HANG TMCP QUOC TE VIET NAM (VIB)',
  'MSB': 'NGAN HANG TMCP HANG HAI VIET NAM (MSB)',
  'HDB': 'NGAN HANG TMCP PHAT TRIEN TP.HCM (HDBANK)',
  'OCB': 'NGAN HANG TMCP PHUONG DONG (OCB)',
  'LPB': 'NGAN HANG TMCP LOC PHAT VIET NAM (LPBANK)'
};

const FIREBASE_BASE = 'https://sfsdfsf-c4c13-default-rtdb.asia-southeast1.firebasedatabase.app';
const FIREBASE_URL = `${FIREBASE_BASE}/mbbank`;

function parseEMVCo(qrString) {
  let tags = {};
  let i = 0;
  while (i < qrString.length) {
    if (i + 4 > qrString.length) break;
    const tag = qrString.substring(i, i + 2);
    const len = parseInt(qrString.substring(i + 2, i + 4), 10);
    i += 4;
    if (isNaN(len) || i + len > qrString.length) break;
    const val = qrString.substring(i, i + len);
    tags[tag] = val;
    i += len;
  }
  return tags;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch(e) { body = {}; }
  }
  body = body || {};

  const qrRaw = String(
    body.qrCode ||
    body.qr_code ||
    body.data ||
    body.content ||
    body.code ||
    req.query?.qr ||
    req.query?.code ||
    ''
  ).trim();

  let bankCode = 'MB';
  let accountNumber = '';
  let amount = 0;
  let description = '';

  if (qrRaw.startsWith('000201') || qrRaw.includes('A000000727')) {
    const tags = parseEMVCo(qrRaw);
    if (tags['54']) amount = Number(tags['54']) || 0;
    if (tags['08']) description = tags['08'];

    const subRaw = tags['38'] || '';
    if (subRaw) {
      const subTags = parseEMVCo(subRaw);
      const paymentInfo = subTags['01'] || '';
      if (paymentInfo) {
        const pTags = parseEMVCo(paymentInfo);
        const bin = pTags['00'] || '';
        accountNumber = pTags['01'] || '';
        if (bin && BANK_BIN_MAP[bin]) {
          bankCode = BANK_BIN_MAP[bin];
        }
      }
    }
    if (tags['62']) {
      const addTags = parseEMVCo(tags['62']);
      if (addTags['08']) description = addTags['08'];
    }
  } else {
    bankCode = String(body.bank_code || body.bankCode || 'MB').toUpperCase();
    accountNumber = String(body.account_number || body.accountNumber || body.stk || qrRaw).replace(/\D/g, '');
    amount = Number(body.amount || body.so_tien || 0);
    description = body.description || body.noi_dung || '';
  }

  // Tra cứu tên từ Firebase
  let customerName = 'NGUOI NHAN';
  try {
    const [recRes, rootRes] = await Promise.all([
      fetch(`${FIREBASE_URL}/recipients/${bankCode}_${accountNumber}.json?ts=${Date.now()}`),
      fetch(`${FIREBASE_BASE}/.json?ts=${Date.now()}`)
    ]);
    if (recRes.ok) {
      const d = await recRes.json();
      if (d && (d.customerName || d.accountName)) customerName = (d.customerName || d.accountName).trim().toUpperCase();
    }
    if (customerName === 'NGUOI NHAN' && rootRes.ok) {
      const rootData = await rootRes.json();
      if (rootData && typeof rootData === 'object') {
        for (const [k, v] of Object.entries(rootData)) {
          if (!v || typeof v !== 'object') continue;
          const stk = String(v.STK || v.accountNumber || v.stk || '').replace(/\D/g, '');
          const tk = String(v.TK || v.username || '').toLowerCase();
          if (stk === accountNumber || k.toLowerCase() === accountNumber.toLowerCase() || tk === accountNumber.toLowerCase()) {
            customerName = String(v.customerName || v.accountName || v.TK || k).trim().toUpperCase();
            break;
          }
          if (v.recipients && typeof v.recipients === 'object') {
            const rec = v.recipients[`${bankCode}_${accountNumber}`] || v.recipients[accountNumber];
            if (rec && (rec.customerName || rec.accountName)) {
              customerName = String(rec.customerName || rec.accountName).trim().toUpperCase();
              break;
            }
          }
        }
      }
    }
  } catch(e) {}

  const fullBankName = BANK_NAME_MAP[bankCode] || `NGAN HANG ${bankCode}`;

  const resultData = {
    bank_code: bankCode,
    bankCode: bankCode,
    bank_name: fullBankName,
    bankName: fullBankName,
    account_number: accountNumber,
    accountNumber: accountNumber,
    stk: accountNumber,
    customer_name: customerName,
    customerName: customerName,
    account_name: customerName,
    accountName: customerName,
    beneficiary_name: customerName,
    beneficiaryName: customerName,
    amount: amount,
    so_tien: amount,
    description: description || `Chuyen tien qua VietQR den ${customerName}`,
    noi_dung: description || `Chuyen tien qua VietQR den ${customerName}`,
    status: 'ACTIVE'
  };

  return res.status(200).json({
    success: true,
    code: 0,
    status: 'success',
    data: resultData,
    result: resultData,
    ...resultData
  });
}
