import { APP_CONFIG } from '../config.js';

const SANDBOX_BANKS = [
  { code: 'MB', shortName: 'MB Bank', name: 'Ngân hàng TMCP Quân Đội', bin: '970422' },
  { code: 'VCB', shortName: 'Vietcombank', name: 'Ngân hàng TMCP Ngoại Thương Việt Nam', bin: '970436' },
  { code: 'TCB', shortName: 'Techcombank', name: 'Ngân hàng TMCP Kỹ Thương Việt Nam', bin: '970407' },
  { code: 'ACB', shortName: 'ACB', name: 'Ngân hàng TMCP Á Châu', bin: '970416' },
  { code: 'BIDV', shortName: 'BIDV', name: 'Ngân hàng TMCP Đầu Tư & Phát Triển VN', bin: '970418' },
  { code: 'VPB', shortName: 'VPBank', name: 'Ngân hàng TMCP Việt Nam Thịnh Vượng', bin: '970432' },
];

const SANDBOX_DIRECTORY = {
  'MB:0388123456': { account_number: '0388123456', account_name: 'NGUYEN MINH KHOA', bank_code: 'MB' },
  'MB:0888999888': { account_number: '0888999888', account_name: 'LE VAN TRONG', bank_code: 'MB' },
  'VCB:1029384756': { account_number: '1029384756', account_name: 'TRAN THAO VY', bank_code: 'VCB' },
  'TCB:19034567890': { account_number: '19034567890', account_name: 'LE HOANG NAM', bank_code: 'TCB' },
  'ACB:88291029': { account_number: '88291029', account_name: 'PHAM QUOC BAO', bank_code: 'ACB' },
};

const state = {
  user: {
    id: 'usr_sbx_001',
    username: '1234567890',
    full_name: 'NGUYEN NGOC TRI',
    tier: 'MB Priority Sandbox',
  },
  accounts: [
    {
      id: 100,
      account_number: '1234567890',
      account_name: 'NGUYEN NGOC TRI',
      bank_code: 'MB',
      currency: 'VND',
      balance: 100000000,
      is_default: true,
    },
    {
      id: 101,
      account_number: '0888999888',
      account_name: 'NGUYEN NGOC TRI',
      bank_code: 'MB',
      currency: 'VND',
      balance: 100000000,
      is_default: false,
    },
    {
      id: 102,
      account_number: '090123456789',
      account_name: 'NGUYEN NGOC TRI',
      bank_code: 'MB',
      currency: 'VND',
      balance: 48250000,
      is_default: false,
    },
  ],
  transactions: [
    {
      id: 'TXN-20261125-01',
      user_bank_account_id: 101,
      type: 'IN',
      amount: 15000000,
      balance_after: 48250000,
      counterparty_name: 'CONG TY CO PHAN CONG NGHE HI',
      counterparty_account: '190223344556',
      counterparty_bank: 'TCB',
      description: 'THANH TOAN HOP DONG SANDBOX T11',
      created_at: '2026-11-25T09:15:00+07:00',
    },
    {
      id: 'TXN-20261124-09',
      user_bank_account_id: 101,
      type: 'OUT',
      amount: 450000,
      balance_after: 33250000,
      counterparty_name: 'TRAN THAO VY',
      counterparty_account: '1029384756',
      counterparty_bank: 'VCB',
      description: 'NGUYEN NGOC TRI chuyen tien',
      created_at: '2026-11-24T19:42:00+07:00',
    },
    {
      id: 'TXN-20261123-04',
      user_bank_account_id: 101,
      type: 'OUT',
      amount: 1890000,
      balance_after: 33700000,
      counterparty_name: 'DIEN LUC TP HCM',
      counterparty_account: 'PE010029384',
      counterparty_bank: 'MB',
      description: 'THANH TOAN HOA DON DIEN T11',
      created_at: '2026-11-23T14:10:00+07:00',
    },
    {
      id: 'TXN-20261121-02',
      user_bank_account_id: 102,
      type: 'IN',
      amount: 5000000,
      balance_after: 12400000,
      counterparty_name: 'NGUYEN MINH KHOA',
      counterparty_account: '0388123456',
      counterparty_bank: 'MB',
      description: 'HOAN UNG CHI PHI DU AN',
      created_at: '2026-11-21T11:05:00+07:00',
    },
  ],
  banners: [
    {
      id: 'bn_01',
      title: 'Tài khoản Số đẹp MB Sandbox',
      subtitle: 'Mở tài khoản trùng số điện thoại miễn phí trong môi trường thử nghiệm',
      tag: 'ƯU ĐÃI',
    },
    {
      id: 'bn_02',
      title: 'Chuyển tiền nhanh Napas 24/7',
      subtitle: 'Hỗ trợ quét & giải mã VietQR chuẩn EMVCo ngay trên trình duyệt',
      tag: 'VIETQR',
    },
  ],
};

function delay(ms = 180) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ok(data, path, method) {
  return { ok: true, status: 200, data, error: null, meta: { path, method, mode: 'sandbox' } };
}

function err(status, code, message, path, method) {
  return { ok: false, status, data: null, error: { code, message }, meta: { path, method, mode: 'sandbox' } };
}

export async function handleSandboxRequest({ method, path, params, body, token }) {
  await delay();
  const ep = APP_CONFIG.endpoints;

  if (path === ep.login || path === ep.loginV1) {
    const username = String(body?.username || '').trim();
    const password = String(body?.password || '');
    if (!username || password.length < 4) {
      return err(400, 'INVALID_CREDENTIALS', 'Vui lòng nhập tên đăng nhập và mật khẩu (>= 4 ký tự).', path, method);
    }
    return ok({
      access_token: `sbx_tok_${Date.now()}`,
      token_type: 'Bearer',
      expires_in: 3600,
      user: { ...state.user, username },
    }, path, method);
  }

  if (path === ep.banners) {
    return ok({ items: state.banners }, path, method);
  }

  if (path === ep.banksAll || path === ep.banksMb) {
    const items = path === ep.banksMb
      ? SANDBOX_BANKS.filter((b) => b.code === 'MB')
      : SANDBOX_BANKS;
    return ok({ banks: items }, path, method);
  }

  if (!token) {
    return err(401, 'UNAUTHORIZED', 'Sandbox: Yêu cầu token xác thực hợp lệ.', path, method);
  }

  if (path === ep.accounts) {
    return ok({ accounts: state.accounts, user: state.user }, path, method);
  }

  if (path === ep.transactions || path === ep.transactionsV1) {
    const accountId = Number(params?.user_bank_account_id);
    const typeFilter = params?.type;
    let list = [...state.transactions];
    if (accountId) list = list.filter((t) => t.user_bank_account_id === accountId);
    if (typeFilter === 'IN' || typeFilter === 'OUT') list = list.filter((t) => t.type === typeFilter);
    return ok({ transactions: list }, path, method);
  }

  if (path === ep.findBank || path === ep.lookup) {
    const bankCode = String(body?.bank_code || params?.bank_code || '').toUpperCase();
    const accNum = String(body?.account_number || params?.account_number || '').trim();
    if (!bankCode || !accNum) {
      return err(400, 'MISSING_PARAMS', 'Thiếu mã ngân hàng hoặc số tài khoản.', path, method);
    }
    const found = SANDBOX_DIRECTORY[`${bankCode}:${accNum}`];
    if (!found) {
      return err(404, 'ACCOUNT_NOT_FOUND', 'Không tìm thấy tài khoản trong danh bạ sandbox (thử MB:0388123456 hoặc VCB:1029384756).', path, method);
    }
    return ok(found, path, method);
  }

  if (path === ep.vietQrDecode) {
    const rawQr = String(body?.qr_data || body?.data || '').trim();
    if (!rawQr.startsWith('000201')) {
      return err(400, 'INVALID_VIETQR', 'Chuỗi VietQR sandbox phải bắt đầu bằng 000201 (EMVCo).', path, method);
    }
    return ok({
      bank_code: 'MB',
      account_number: '0388123456',
      account_name: 'NGUYEN MINH KHOA',
      amount: 250000,
      description: 'THANH TOAN VIETQR SANDBOX',
    }, path, method);
  }

  if (path === ep.transfer) {
    const fromId = Number(body?.user_bank_account_id);
    const toAcc = String(body?.receiver_account_number || '').trim();
    const bankCode = String(body?.bank_code || '').toUpperCase();
    const amount = Number(body?.amount);
    const pin = String(body?.pin_code || '').trim();
    const defaultMsg = `${source?.account_name || 'NGUYEN NGOC TRI'} chuyen tien`;
    const description = String(body?.description || defaultMsg).trim();

    if (pin !== '123456') {
      return err(403, 'INVALID_PIN', 'Mã PIN SmartOTP sandbox không đúng (mặc định sandbox: 123456).', path, method);
    }
    const source = state.accounts.find((a) => a.id === fromId);
    if (!source) {
      return err(404, 'SOURCE_NOT_FOUND', 'Không tìm thấy tài khoản nguồn.', path, method);
    }
    if (!toAcc || !bankCode || !Number.isFinite(amount) || amount < 1000) {
      return err(400, 'INVALID_TRANSFER', 'Số tiền tối thiểu 1.000 VND và cần đủ thông tin người nhận.', path, method);
    }
    if (source.balance < amount) {
      return err(422, 'INSUFFICIENT_FUNDS', 'Số dư tài khoản nguồn không đủ.', path, method);
    }

    source.balance -= amount;
    const recipient = SANDBOX_DIRECTORY[`${bankCode}:${toAcc}`];
    const tx = {
      id: `TXN-${Date.now()}`,
      user_bank_account_id: source.id,
      type: 'OUT',
      amount,
      balance_after: source.balance,
      counterparty_name: recipient?.account_name || `TAI KHOAN ${toAcc}`,
      counterparty_account: toAcc,
      counterparty_bank: bankCode,
      description,
      created_at: new Date().toISOString(),
    };
    state.transactions.unshift(tx);
    return ok({ transaction: tx, balance: source.balance }, path, method);
  }

  return err(404, 'ENDPOINT_NOT_FOUND', `Endpoint ${path} chưa được cấu hình trong sandbox.`, path, method);
}
