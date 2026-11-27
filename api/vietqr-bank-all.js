export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const banks = [
    { code: 'MB', shortName: 'MB Bank', name: 'Ngân hàng TMCP Quân Đội', bin: '970422' },
    { code: 'VCB', shortName: 'Vietcombank', name: 'Ngân hàng TMCP Ngoại Thương VN', bin: '970436' },
    { code: 'TCB', shortName: 'Techcombank', name: 'Ngân hàng TMCP Kỹ Thương VN', bin: '970407' },
    { code: 'ACB', shortName: 'ACB', name: 'Ngân hàng TMCP Á Châu', bin: '970416' },
    { code: 'BIDV', shortName: 'BIDV', name: 'Ngân hàng TMCP Đầu Tư & Phát Triển', bin: '970418' },
    { code: 'VPB', shortName: 'VPBank', name: 'Ngân hàng TMCP VN Thịnh Vượng', bin: '970432' },
  ];

  return res.status(200).json({
    ok: true,
    success: true,
    code: 0,
    banks,
    data: { banks }
  });
}
