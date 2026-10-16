import { getSql, ensureTables, isAdmin, json, readBody, clip } from './_lib.js';

const STATUSES = ['done', 'ongoing', 'planned'];

function validDate(v) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(v + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

export default async function handler(req, res) {
  try {
    await ensureTables();
    const sql = getSql();

    // Ai cũng xem được tiến độ dự án
    if (req.method === 'GET') {
      const rows = await sql`
        SELECT id, title, description, to_char(event_date, 'YYYY-MM-DD') AS event_date, status, image_url
        FROM project_updates
        ORDER BY event_date DESC, id DESC`;
      res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=60');
      return res.status(200).json(rows);
    }

    // Từ đây trở xuống chỉ admin được dùng
    if (!isAdmin(req)) return json(res, 401, { error: 'Chưa đăng nhập' });

    if (req.method === 'POST') {
      const b = readBody(req);
      const title = clip(b.title, 160);
      if (!title) return json(res, 400, { error: 'Cần nhập tiêu đề' });

      const date = clip(b.event_date, 10);
      if (!validDate(date)) return json(res, 400, { error: 'Ngày không hợp lệ' });

      const status = STATUSES.includes(b.status) ? b.status : 'done';
      const description = clip(b.description, 1500);

      // Chỉ nhận link ảnh https, tránh các dạng link nguy hiểm như javascript:
      const image = clip(b.image_url, 500);
      if (image && !/^https:\/\/[^\s"'<>]+$/i.test(image)) {
        return json(res, 400, { error: 'Link ảnh phải bắt đầu bằng https:// và không chứa dấu cách' });
      }

      const [row] = await sql`
        INSERT INTO project_updates (title, description, event_date, status, image_url)
        VALUES (${title}, ${description}, ${date}, ${status}, ${image})
        RETURNING id`;
      return json(res, 201, { id: row.id });
    }

    if (req.method === 'PATCH') {
      const b = readBody(req);
      const id = Number(b.id);
      if (!Number.isInteger(id)) return json(res, 400, { error: 'ID không hợp lệ' });
      if (!STATUSES.includes(b.status)) return json(res, 400, { error: 'Trạng thái không hợp lệ' });
      await sql`UPDATE project_updates SET status = ${b.status} WHERE id = ${id}`;
      return json(res, 200, { ok: true });
    }

    if (req.method === 'DELETE') {
      const id = Number(req.query.id);
      if (!Number.isInteger(id)) return json(res, 400, { error: 'ID không hợp lệ' });
      await sql`DELETE FROM project_updates WHERE id = ${id}`;
      return json(res, 200, { ok: true });
    }

    return json(res, 405, { error: 'Phương thức không hợp lệ' });
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: 'Lỗi máy chủ. Kiểm tra DATABASE_URL.' });
  }
}
