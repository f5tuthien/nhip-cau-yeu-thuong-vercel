(function () {
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => Number(n).toLocaleString('vi-VN') + ' ₫';

  let products = [];
  const cart = new Map(); // id -> số lượng

  async function loadMenu() {
    const box = $('#menu-list');
    try {
      const res = await fetch('/api/products');
      if (!res.ok) throw new Error();
      products = await res.json();
      if (!products.length) {
        box.innerHTML = '<p class="empty">Hiện chưa có món nào đang bán.</p>';
        return;
      }
      const groups = {};
      products.forEach((p) => { (groups[p.category || 'Khác'] ||= []).push(p); });
      box.innerHTML = Object.entries(groups).map(([cat, list]) => `
        <div class="menu-cat">
          <h3>${esc(cat)}</h3>
          ${list.map((p) => `
            <div class="menu-item">
              <div>
                <h4>${esc(p.name)}</h4>
                ${p.description ? `<p>${esc(p.description)}</p>` : ''}
                <span class="price">${money(p.price)}</span>
              </div>
              <button class="btn small" type="button" data-add="${p.id}">Thêm</button>
            </div>`).join('')}
        </div>`).join('');
    } catch {
      box.innerHTML = '<p class="empty">Không tải được thực đơn. Vui lòng thử lại sau.</p>';
    }
  }

  function renderCart() {
    const lines = [...cart.entries()]
      .map(([id, qty]) => ({ p: products.find((x) => x.id === id), qty }))
      .filter((l) => l.p);
    const total = lines.reduce((s, l) => s + l.p.price * l.qty, 0);

    $('#cart-items').innerHTML = lines.length
      ? lines.map((l) => `
        <div class="cart-line">
          <span class="nm">${esc(l.p.name)}<br><small>${money(l.p.price)}</small></span>
          <span class="qty">
            <button type="button" data-dec="${l.p.id}" aria-label="Giảm">−</button>
            <b>${l.qty}</b>
            <button type="button" data-inc="${l.p.id}" aria-label="Tăng">+</button>
          </span>
        </div>`).join('')
      : '<p class="empty">Chưa có món nào trong giỏ.</p>';
    $('#cart-total').textContent = money(total);
    $('#order-submit').disabled = lines.length === 0;
  }

  document.addEventListener('click', (ev) => {
    const t = ev.target;
    const add = Number(t.dataset?.add);
    const inc = Number(t.dataset?.inc);
    const dec = Number(t.dataset?.dec);
    if (add) cart.set(add, Math.min(50, (cart.get(add) || 0) + 1));
    else if (inc) cart.set(inc, Math.min(50, (cart.get(inc) || 0) + 1));
    else if (dec) {
      const q = (cart.get(dec) || 0) - 1;
      q > 0 ? cart.set(dec, q) : cart.delete(dec);
    } else return;
    renderCart();
  });

  function renderDone(o) {
    const p = o.payment || {};
    const isBank = o.method === 'bank';
    const hasBank = p.account_number && (p.bank_name || p.bank_code);
    const qr = isBank && p.bank_code && p.account_number
      ? `https://img.vietqr.io/image/${encodeURIComponent(p.bank_code)}-${encodeURIComponent(p.account_number)}-compact2.png` +
        `?amount=${encodeURIComponent(o.total)}&addInfo=${encodeURIComponent(o.code)}` +
        (p.account_name ? `&accountName=${encodeURIComponent(p.account_name)}` : '')
      : '';

    let payHtml;
    if (!isBank) {
      payHtml = '<div class="notice">Bạn chọn <b>thanh toán khi nhận hàng</b>. Vui lòng chuẩn bị đúng số tiền. Chúng mình sẽ gọi xác nhận đơn.</div>';
    } else if (!hasBank) {
      payHtml = '<div class="notice">Chúng mình chưa cập nhật thông tin chuyển khoản. Đội ngũ sẽ liên hệ với bạn qua số điện thoại để hướng dẫn thanh toán.</div>';
    } else {
      payHtml = `
        <div class="pay-grid">
          <div class="pay-info">
            <dl>
              <dt>Ngân hàng</dt><dd>${esc(p.bank_name || p.bank_code)}</dd>
              <dt>Số tài khoản</dt><dd>${esc(p.account_number)}<button class="copy-btn" type="button" data-copy="${esc(p.account_number)}">Sao chép</button></dd>
              <dt>Chủ tài khoản</dt><dd>${esc(p.account_name)}</dd>
              <dt>Số tiền</dt><dd>${money(o.total)}</dd>
              <dt>Nội dung CK</dt><dd>${esc(o.code)}<button class="copy-btn" type="button" data-copy="${esc(o.code)}">Sao chép</button></dd>
            </dl>
            ${p.payment_note ? `<div class="notice">${esc(p.payment_note)}</div>` : ''}
            <div class="notice">Vui lòng ghi đúng <b>nội dung chuyển khoản</b> để chúng mình đối chiếu đơn. Đơn sẽ được xử lý sau khi nhận được tiền.</div>
          </div>
          ${qr ? `<div class="pay-qr"><img src="${qr}" alt="Mã QR chuyển khoản" loading="lazy" /></div>` : ''}
        </div>`;
    }

    const box = $('#order-done');
    box.innerHTML = `
      <h3>Đặt hàng thành công!</h3>
      <p>Mã đơn của bạn: <span class="code">${esc(o.code)}</span></p>
      <ul class="order-items">
        ${o.items.map((i) => `<li>${i.qty} × ${esc(i.name)} — ${money(i.price * i.qty)}</li>`).join('')}
      </ul>
      <p><b>Tổng cộng: ${money(o.total)}</b></p>
      ${payHtml}`;
    box.hidden = false;
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  document.addEventListener('click', async (ev) => {
    const text = ev.target.dataset?.copy;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      ev.target.textContent = 'Đã chép';
      setTimeout(() => { ev.target.textContent = 'Sao chép'; }, 1500);
    } catch { /* trình duyệt không cho sao chép */ }
  });

  $('#order-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const form = ev.target;
    const msg = $('#order-msg');
    const btn = $('#order-submit');
    msg.className = 'msg';

    const data = Object.fromEntries(new FormData(form).entries());
    if (!data.name.trim() || !data.phone.trim() || !data.address.trim()) {
      msg.className = 'msg err';
      msg.textContent = 'Vui lòng nhập họ tên, số điện thoại và địa chỉ nhận hàng.';
      return;
    }
    data.items = [...cart.entries()].map(([id, qty]) => ({ id, qty }));

    btn.disabled = true;
    const label = btn.textContent;
    btn.textContent = 'Đang gửi...';
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || 'Đặt hàng thất bại');
      cart.clear();
      form.reset();
      renderCart();
      renderDone(out);
    } catch (e) {
      msg.className = 'msg err';
      msg.textContent = e.message;
    } finally {
      btn.textContent = label;
      btn.disabled = cart.size === 0;
    }
  });

  renderCart();
  loadMenu();
})();
