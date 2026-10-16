const $ = (sel) => document.querySelector(sel);

// Mở file trực tiếp trên máy thì không có máy chủ, nên báo rõ cho người xem
if (location.protocol === 'file:') {
  document.body.insertAdjacentHTML(
    'afterbegin',
    '<div style="background:#fde8e6;color:#a23226;padding:10px 16px;font-weight:600;text-align:center">' +
      'Bạn đang mở file trực tiếp trên máy. Danh sách, thực đơn, đặt hàng và trang admin chỉ hoạt động khi website đã được deploy lên Vercel.' +
    '</div>'
  );
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function loadCamps() {
  const list = $('#camp-list');
  const select = $('#camp');
  try {
    const res = await fetch('/api/camps');
    if (!res.ok) throw new Error('Lỗi tải dữ liệu');
    const camps = await res.json();
    $('#stat-camps').textContent = camps.length;

    if (!camps.length) {
      list.innerHTML = '<p class="empty">Chưa có trại cứu hộ nào được đăng.</p>';
      return;
    }
    list.innerHTML = camps.map((c) => `
      <article class="card">
        <h3>${esc(c.name)}</h3>
        <div class="place">📍 ${esc(c.location || 'Đang cập nhật')}</div>
        <p>${esc(c.description || '')}</p>
        ${c.activities ? `<span class="tag">${esc(c.activities)}</span>` : ''}
      </article>`).join('');

    camps.forEach((c) => {
      const o = document.createElement('option');
      o.value = c.name;
      o.textContent = c.name;
      select.appendChild(o);
    });
  } catch (e) {
    list.innerHTML = '<p class="empty">Không tải được danh sách. Vui lòng thử lại sau.</p>';
  }
}

$('#volunteer-form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const form = ev.target;
  const msg = $('#form-msg');
  const btn = form.querySelector('button[type=submit]');
  msg.className = 'msg';

  const data = Object.fromEntries(new FormData(form).entries());
  if (!data.name.trim() || !data.phone.trim()) {
    msg.className = 'msg err';
    msg.textContent = 'Vui lòng nhập họ tên và số điện thoại.';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Đang gửi...';
  try {
    const res = await fetch('/api/volunteers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error || 'Gửi thất bại');
    form.reset();
    msg.className = 'msg ok';
    msg.textContent = 'Cảm ơn bạn! Chúng mình đã nhận được đăng ký và sẽ liên hệ sớm.';
  } catch (e) {
    msg.className = 'msg err';
    msg.textContent = e.message;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Gửi đăng ký';
  }
});

$('#year').textContent = new Date().getFullYear();
loadCamps();
