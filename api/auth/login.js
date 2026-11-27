const FIREBASE_URL = 'https://sfsdfsf-c4c13-default-rtdb.asia-southeast1.firebasedatabase.app/mbbank';

async function getActiveAccountDetails() {
  let accKey = '1800123123';
  try {
    const rootRes = await fetch(`${FIREBASE_URL}.json?ts=${Date.now()}`, { cache: 'no-store' });
    if (rootRes.ok) {
      const root = await rootRes.json();
      if (root) {
        if (root.active_account) accKey = String(root.active_account).replace(/\D/g, '');
        else if (root.accountNumber) accKey = String(root.accountNumber).replace(/\D/g, '');
        else if (root.accounts && Object.keys(root.accounts).length > 0) accKey = String(Object.keys(root.accounts)[0]).replace(/\D/g, '');

        const accData = (root.accounts && root.accounts[accKey]) ? root.accounts[accKey] : null;
        const rootName = String(accData?.customerName || accData?.accountName || root.customerName || root.accountName || 'NGUYEN NGOC TRI').trim().toUpperCase();
        const rootBal = typeof accData?.balance === 'number' 
          ? accData.balance 
          : (typeof root.balance === 'number' ? root.balance : 200000);

        return {
          accountNumber: accData?.accountNumber || root.accountNumber || accKey,
          accountName: rootName,
          customerName: rootName,
          balance: rootBal,
          password: accData?.password || root.password || '123456',
          phone: accData?.phone || root.phone || accKey,
          otp: accData?.otp || root.otp || '111111',
          tier: accData?.tier || root.tier || 'MB Private Banking VIP'
        };
      }
    }
  } catch (e) {}

  return {
    accountNumber: accKey,
    accountName: 'NGUYEN NGOC TRI',
    customerName: 'NGUYEN NGOC TRI',
    balance: 200000,
    password: '123456',
    phone: accKey,
    otp: '111111',
    tier: 'MB Private Banking VIP'
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch(e) { body = {}; }
  }
  body = body || {};

  // Trích xuất tài khoản & mật khẩu từ mọi trường người dùng / App gửi lên
  const userParam = String(
    body.username ||
    body.accountNumber ||
    body.account_number ||
    body.stk ||
    body.phone ||
    body.sdt ||
    body.userId ||
    body.user ||
    body.custName ||
    req.query?.username ||
    req.query?.account_number ||
    req.query?.stk ||
    req.query?.phone ||
    ''
  ).trim();

  const passParam = String(
    body.password ||
    body.mat_khau ||
    body.pass ||
    body.pin ||
    body.passwd ||
    req.query?.password ||
    ''
  ).trim();

  // =========================================================================
  // XỬ LÝ ĐĂNG NHẬP: BẮT BUỘC ĐÚNG TÀI KHOẢN VÀ MẬT KHẨU TẠO BÊN ADMIN
  // =========================================================================
  if (userParam || passParam) {
    if (!userParam) {
      return res.status(200).json({
        success: false,
        code: 1,
        status: 'error',
        message: 'Vui lòng nhập số tài khoản hoặc số điện thoại',
        result: { responseCode: '400', message: 'Vui lòng nhập số tài khoản hoặc số điện thoại' }
      });
    }

    if (!passParam) {
      return res.status(200).json({
        success: false,
        code: 1,
        status: 'error',
        message: 'Vui lòng nhập mật khẩu đăng nhập',
        result: { responseCode: '400', message: 'Vui lòng nhập mật khẩu đăng nhập' }
      });
    }

    try {
      const rootRes = await fetch(`${FIREBASE_URL}.json`);
      if (!rootRes.ok) {
        return res.status(500).json({ success: false, message: 'Lỗi kết nối Firebase' });
      }

      const root = (await rootRes.json()) || {};
      const accounts = root.accounts || {};
      const cleanUser = userParam ? userParam.replace(/\D/g, '') : '';
      const lowerUser = userParam ? userParam.toLowerCase() : '';

      // 1. Tìm tài khoản trong danh sách do Admin tạo
      let matched = null;
      for (const [key, item] of Object.entries(accounts)) {
        if (!item) continue;
        const accNum = String(item.accountNumber || key).replace(/\D/g, '');
        const phone = String(item.phone || item.sdt || '').replace(/\D/g, '');
        const uname = String(item.username || '').toLowerCase();

        if (
          (cleanUser && (accNum === cleanUser || phone === cleanUser)) ||
          (lowerUser && (uname === lowerUser || String(key).toLowerCase() === lowerUser))
        ) {
          matched = item;
          break;
        }
      }

      // 2. Tìm thêm ở root nếu tài khoản tạo ở root
      if (!matched && root && (cleanUser || lowerUser)) {
        const rootNum = String(root.accountNumber || '').replace(/\D/g, '');
        const rootPhone = String(root.phone || root.sdt || '').replace(/\D/g, '');
        const rootUname = String(root.username || '').toLowerCase();

        if (
          (cleanUser && (rootNum === cleanUser || rootPhone === cleanUser)) ||
          (lowerUser && rootUname === lowerUser)
        ) {
          matched = {
            accountNumber: root.accountNumber || cleanUser,
            username: root.username || cleanUser,
            password: root.password || '123456',
            phone: root.phone || root.sdt || cleanUser,
            customerName: root.customerName || root.accountName || 'THÀNH VIÊN MB',
            accountName: root.accountName || root.customerName || 'THÀNH VIÊN MB',
            balance: typeof root.balance === 'number' ? root.balance : 0,
            otp: root.otp || '111111',
            tier: root.tier || 'MB Priority Digital'
          };
        }
      }

      // 3. NẾU TÀI KHOẢN KHÔNG TỒN TẠI TRONG ADMIN: BÁO LỖI NGAY LẬP TỨC
      if (!matched) {
        return res.status(200).json({
          success: false,
          code: 1,
          status: 'error',
          message: 'Tài khoản không tồn tại trên hệ thống. Vui lòng kiểm tra lại.',
          result: {
            responseCode: '404',
            message: 'Tài khoản không tồn tại trên hệ thống'
          }
        });
      }

      // 4. KIỂM TRA MẬT KHẨU: BẮT BUỘC ĐÚNG MẬT KHẨU ĐÃ TẠO BÊN ADMIN
      const expectedPass = String(matched.password || '123456').trim();
      if (expectedPass !== passParam) {
        return res.status(200).json({
          success: false,
          code: 1,
          status: 'error',
          message: 'Mật khẩu không chính xác. Vui lòng kiểm tra lại mật khẩu do Admin cấp.',
          result: {
            responseCode: '401',
            message: 'Mật khẩu không chính xác'
          }
        });
      }

      // =======================================================================
      // ĐĂNG NHẬP THÀNH CÔNG: LẤY ĐÚNG SỐ DƯ, OTP & STK CỦA TÀI KHOẢN ĐÓ
      // =======================================================================
      const accNum = String(matched.accountNumber || cleanUser || '1234567890').replace(/\D/g, '');
      const name = (matched.customerName || matched.accountName || 'THÀNH VIÊN MB').toUpperCase();
      const bal = typeof matched.balance === 'number' ? matched.balance : 0;
      const otp = matched.otp || '111111';
      const phone = matched.phone || matched.sdt || accNum;
      const pass = matched.password || '123456';
      const tier = matched.tier || 'MB Priority Digital';
      const token = `tok_mb_${accNum}_${Date.now()}`;

      // Kích hoạt ngay lập tức tài khoản này trên Firebase để App MB lấy đúng số dư và STK
      await Promise.all([
        fetch(`${FIREBASE_URL}/active_account.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(accNum)
        }),
        fetch(`${FIREBASE_URL}.json`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accountNumber: accNum,
            username: accNum,
            accountName: name,
            customerName: name,
            balance: bal,
            phone: phone,
            sdt: phone,
            otp: otp,
            password: pass,
            tier: tier,
            active_account: accNum,
            activeAccount: accNum,
            updatedAt: new Date().toISOString()
          })
        }),
        fetch(`https://sfsdfsf-c4c13-default-rtdb.asia-southeast1.firebasedatabase.app/balance.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bal)
        })
      ]).catch(() => {});

      const userAccount = {
        id: 1,
        username: accNum,
        accountNumber: accNum,
        account_number: accNum,
        stk: accNum,
        so_tai_khoan: accNum,
        accountName: name,
        account_name: name,
        customerName: name,
        customer_name: name,
        fullName: name,
        full_name: name,
        custName: name,
        phone: phone,
        sdt: phone,
        balance: bal,
        account_balance: bal,
        available_balance: bal,
        current_balance: bal,
        new_balance: bal,
        so_tien: bal,
        currency: 'VND',
        otp: otp,
        pin: otp,
        password: pass,
        tier: tier,
        bankCode: 'MB',
        bank_code: 'MB',
        token: token
      };

      return res.status(200).json({
        success: true,
        status: 'success',
        code: 0,
        message: 'Đăng nhập thành công',
        token: token,
        access_token: token,
        data: userAccount,
        user: userAccount,
        account: userAccount,
        accounts: [ userAccount ],
        result: {
          responseCode: '00',
          message: 'Success',
          data: userAccount,
          user: userAccount
        }
      });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  }

  // =========================================================================
  // NẾU APP GỌI LẤY TOKEN MẶC ĐỊNH (KHI MỞ APP KHÔNG GỬI CREDENTIALS)
  // =========================================================================
  const token = `autotok_mb_${Date.now()}`;
  const acc = await getActiveAccountDetails();
  const num = acc.accountNumber || '1234567890';
  const name = acc.customerName || acc.accountName || 'THÀNH VIÊN MB';
  const bal = typeof acc.balance === 'number' ? acc.balance : 0;

  const defaultAccount = {
    id: 1,
    username: num,
    accountName: name,
    account_name: name,
    fullName: name,
    full_name: name,
    customerName: name,
    customer_name: name,
    custName: name,
    accountNumber: num,
    account_number: num,
    stk: num,
    so_tai_khoan: num,
    phone: acc.phone || num,
    sdt: acc.phone || num,
    password: acc.password || '123456',
    balance: bal,
    account_balance: bal,
    available_balance: bal,
    current_balance: bal,
    new_balance: bal,
    so_tien: bal,
    currency: 'VND',
    bankCode: 'MB',
    bank_code: 'MB',
    otp: acc.otp || '111111',
    pin: acc.otp || '111111',
    tier: acc.tier || 'MB Priority Digital',
    token: token
  };

  return res.status(200).json({
    success: true,
    status: 'success',
    code: 0,
    message: 'Đăng nhập thành công',
    token: token,
    access_token: token,
    data: defaultAccount,
    user: defaultAccount,
    account: defaultAccount,
    accounts: [ defaultAccount ],
    result: {
      responseCode: '00',
      message: 'Success',
      data: defaultAccount,
      user: defaultAccount
    }
  });
}
