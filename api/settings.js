import { getSql, ensureTables, isAdmin, json, readBody, clip, getPaymentSettings, PAYMENT_KEYS } from './_lib.js';

export default async function handler(req, res) {
  try {
    await ensureTables();
    const sql = getSql();

    // Thông tin thanh toán là thông tin khách cần để chuyển tiền nên công khai
    if (req.method === 'GET') {
      res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=60');
      return res.status(200).json(await getPaymentSettings(sql));
    }

    if (!isAdmin(req)) return json(res, 401, { error: 'Chưa đăng nhập' });

    if (req.method === 'PUT') {
      const b = readBody(req);
      const values = {
        bank_name: clip(b.bank_name, 80),
        bank_code: clip(b.bank_code, 12).toUpperCase(),
        account_number: clip(b.account_number, 30).replace(/\s+/g, ''),
        account_name: clip(b.account_name, 80),
        payment_note: clip(b.payment_note, 400),
      };
      if (values.bank_code && !/^[A-Z0-9]{2,12}$/.test(values.bank_code)) {
        return json(res, 400, { error: 'Mã ngân hàng chỉ gồm chữ và số (ví dụ VCB, MB, ACB)' });
      }
      if (values.account_number && !/^[0-9A-Za-z]{4,30}$/.test(values.account_number)) {
        return json(res, 400, { error: 'Số tài khoản không hợp lệ' });
      }
      for (const k of PAYMENT_KEYS) {
        await sql`
          INSERT INTO settings (key, value) VALUES (${k}, ${values[k]})
          ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
      }
      return json(res, 200, values);
    }

    return json(res, 405, { error: 'Phương thức không hợp lệ' });
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: 'Lỗi máy chủ. Kiểm tra DATABASE_URL.' });
  }
}
