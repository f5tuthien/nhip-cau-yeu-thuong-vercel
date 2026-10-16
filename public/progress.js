(function () {
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const LABEL = { done: 'Đã hoàn thành', ongoing: 'Đang thực hiện', planned: 'Sắp tới' };

  function fmtDate(s) {
    const [y, m, d] = String(s).split('-');
    return y && m && d ? `${d}/${m}/${y}` : s;
  }

  async function load() {
    try {
      const res = await fetch('/api/updates');
      if (!res.ok) throw new Error();
      const rows = await res.json();
      if (!rows.length) return; // chưa có mốc nào thì giữ mục này ẩn

      const done = rows.filter((r) => r.status === 'done').length;
      const pct = Math.round((done / rows.length) * 100);
      $('#progress-fill').style.width = pct + '%';
      $('#progress-text').textContent = `Đã hoàn thành ${done}/${rows.length} mốc (${pct}%)`;

      $('#progress-list').innerHTML = rows.map((r) => {
        const status = LABEL[r.status] ? r.status : 'done';
        const photo = r.image_url && /^https:\/\//i.test(r.image_url)
          ? `<img class="tl-photo" src="${esc(r.image_url)}" alt="${esc(r.title)}" loading="lazy" referrerpolicy="no-referrer" />`
          : '';
        return `
          <li class="tl-item ${status}">
            <div class="card">
              <div class="tl-meta">
                <span>${esc(fmtDate(r.event_date))}</span>
                <span class="badge ${status}">${LABEL[status]}</span>
              </div>
              <h3>${esc(r.title)}</h3>
              ${r.description ? `<p>${esc(r.description)}</p>` : ''}
              ${photo}
            </div>
          </li>`;
      }).join('');

      $('#tien-do').hidden = false;
      $('#nav-progress').hidden = false;
    } catch {
      /* không tải được thì để mục này ẩn, không ảnh hưởng phần còn lại */
    }
  }

  load();
})();
