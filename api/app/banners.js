/**
 * MB Bank Banners API
 * Returns active promotional campaigns, cards, and banking feature banners for App MB
 */

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Cache-Control', 'public, max-age=3600');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const banners = [
    {
      id: 'banner-01',
      title: 'MB Priority Digital',
      subtitle: 'Đặc quyền chuyên biệt cho khách hàng ưu tiên',
      imageUrl: 'https://mbbank.com.vn/images/banner-priority.png',
      bannerUrl: 'https://mbbank.com.vn/images/banner-priority.png',
      actionUrl: 'mbapp://priority',
      type: 'PRIORITY',
      active: true,
      order: 1
    },
    {
      id: 'banner-02',
      title: 'Chuyển Tiền Miễn Phí Trọn Đời',
      subtitle: 'Giao dịch 24/7 tức thì đến 50+ ngân hàng Napas',
      imageUrl: 'https://mbbank.com.vn/images/banner-transfer.png',
      bannerUrl: 'https://mbbank.com.vn/images/banner-transfer.png',
      actionUrl: 'mbapp://transfer',
      type: 'PROMO',
      active: true,
      order: 2
    },
    {
      id: 'banner-03',
      title: 'Mở Thẻ Tín Dụng Online',
      subtitle: 'Phê duyệt tự động hạn mức tới 100.000.000 VND',
      imageUrl: 'https://mbbank.com.vn/images/banner-card.png',
      bannerUrl: 'https://mbbank.com.vn/images/banner-card.png',
      actionUrl: 'mbapp://cards',
      type: 'CARD',
      active: true,
      order: 3
    }
  ];

  return res.status(200).json({
    success: true,
    code: 0,
    status: 'success',
    banners: banners,
    data: banners,
    result: {
      banners: banners
    }
  });
}
