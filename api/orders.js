import { getSql, ensureTables, isAdmin, json, readBody, clip, getPaymentSettings } from './_lib.js';

const STATUSES = ['pending', 'paid', 'done', 'cancelled'];

export default async function handler(req, res) {
  try {
    await ensureTables();
    const sql = getSql();

    // Khách đặt hàng (công khai)
    if (req.method === 'POST') {
      const b = readBody(req);

      // Ô bẫy spam
      if (b.website) return json(res, 200, { ok: true });

      const name = clip(b.name, 120);
      const phone = clip(b.phone, 30);
      const address = clip(b.address, 300);
      const note = clip(b.note, 500);
      const method = b.method === 'cod' ? 'cod' : 'bank';

      if (!name || !phone || !address) {
        return json(res, 400, { error: 'Cần nhập họ tên, số điện thoại và địa chỉ nhận hàng' });
      }
      if (!/^[0-9+\-\s().]{6,30}$/.test(phone)) return json(res, 400, { error: 'Số điện thoại không hợp lệ' });

      // Gom số lượng theo món. Giá luôn lấy từ database, không tin giá từ trình duyệt.
      const qtyById = new Map();
      const raw = Array.isArray(b.items) ? b.items.slice(0, 40) : [];
      for (const it of raw) {
        const id = Number(it?.id);
        const qty = Math.floor(Number(it?.qty));
        if (!Number.isInteger(id) || !(qty >= 1)) continue;
        qtyById.set(id, Math.min(50, (qtyById.get(id) || 0) + qty));
      }
      if (qtyById.size === 0) return json(res, 400, { error: 'Giỏ hàng đang trống' });

      const ids = [...qtyById.keys()];
      const prods = await sql`SELECT id, name, price FROM products WHERE id = ANY(${ids}) AND available = true`;
      if (prods.length !== ids.length) {
        return json(res, 400, { error: 'Một số món không còn bán. Vui lòng tải lại trang và chọn lại.' });
      }

      const items = prods.map((p) => ({ id: p.id, name: p.name, price: p.price, qty: qtyById.get(p.id) }));
      const total = items.reduce((s, i) => s + i.price * i.qty, 0);

      const [row] = await sql`
        INSERT INTO orders (customer_name, phone, address, note, method, items, total)
        VALUES (${name}, ${phone}, ${address}, ${note}, ${method}, ${JSON.stringify(items)}::jsonb, ${total})
        RETURNING id`;
      const code = 'NC' + String(row.id).padStart(4, '0');
      await sql`UPDATE orders SET code = ${code} WHERE id = ${row.id}`;

      const payment = await getPaymentSettings(sql);
      return json(res, 201, { code, total, method, items, payment });
    }

    // Xem / đổi trạng thái / xóa đơn: chỉ admin
    if (!isAdmin(req)) return json(res, 401, { error: 'Chưa đăng nhập' });

    if (req.method === 'GET') {
      const rows = await sql`
        SELECT id, code, customer_name, phone, address, note, method, status, items, total, created_at
        FROM orders ORDER BY id DESC LIMIT 300`;
      return json(res, 200, rows);
    }

    if (req.method === 'PATCH') {
      const b = readBody(req);
      const id = Number(b.id);
      if (!Number.isInteger(id)) return json(res, 400, { error: 'ID không hợp lệ' });
      if (!STATUSES.includes(b.status)) return json(res, 400, { error: 'Trạng thái không hợp lệ' });
      await sql`UPDATE orders SET status = ${b.status} WHERE id = ${id}`;
      return json(res, 200, { ok: true });
    }

    if (req.method === 'DELETE') {
      const id = Number(req.query.id);
      if (!Number.isInteger(id)) return json(res, 400, { error: 'ID không hợp lệ' });
      await sql`DELETE FROM orders WHERE id = ${id}`;
      return json(res, 200, { ok: true });
    }

    return json(res, 405, { error: 'Phương thức không hợp lệ' });
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: 'Lỗi máy chủ. Kiểm tra DATABASE_URL.' });
  }
}
