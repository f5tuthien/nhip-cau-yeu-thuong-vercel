import { createToken, safeEqual, json, readBody } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Phương thức không hợp lệ' });

  try {
    const expected = process.env.ADMIN_PASSWORD;
    if (!expected) return json(res, 500, { error: 'Máy chủ chưa cấu hình ADMIN_PASSWORD' });

    const { password } = readBody(req);
    if (!password || !safeEqual(password, expected)) {
      // Làm chậm nhẹ để hạn chế dò mật khẩu
      await new Promise((r) => setTimeout(r, 800));
      return json(res, 401, { error: 'Sai mật khẩu' });
    }
    return json(res, 200, { token: createToken(12) });
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: 'Lỗi máy chủ' });
  }
}
