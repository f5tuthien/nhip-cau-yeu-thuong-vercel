// Dùng lại $, esc, api, getToken từ admin.js (nạp trước file này)

const money = (n) => Number(n).toLocaleString('vi-VN') + ' ₫';

const STATUS_LABELS = {
  pending: 'Chờ xử lý',
  paid: 'Đã thanh toán',
  done: 'Đã giao',
  cancelled: 'Đã hủy',
};

function loadShop() {
  loadPayment();
  loadProducts();
  loadOrders();
}

/* ---------- Thông tin thanh toán ---------- */

async function loadPayment() {
  try {
    const p = await api('/api/settings');
    $('#p-bank').value = p.bank_name || '';
    $('#p-code').value = p.bank_code || '';
    $('#p-acc').value = p.account_number || '';
    $('#p-name').value = p.account_name || '';
    $('#p-note').value = p.payment_note || '';
  } catch (e) { /* lỗi 401 đã xử lý trong api() */ }
}

$('#pay-form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const msg = $('#pay-msg');
  msg.className = 'msg';
  try {
    await api('/api/settings', {
      method: 'PUT',
      body: JSON.stringify({
        bank_name: $('#p-bank').value,
        bank_code: $('#p-code').value,
        account_number: $('#p-acc').value,
        account_name: $('#p-name').value,
        payment_note: $('#p-note').value,
      }),
    });
    msg.className = 'msg ok';
    msg.textContent = 'Đã lưu thông tin thanh toán.';
    loadPayment();
  } catch (e) {
    msg.className = 'msg err';
    msg.textContent = e.message;
  }
});

/* ---------- Thực đơn ---------- */

async function loadProducts() {
  try {
    const rows = await api('/api/products?all=1');
    $('#prod-rows').innerHTML = rows.length
      ? rows.map((p) => `
        <tr>
          <td><b>${esc(p.name)}</b><br><small>${esc(p.description)}</small></td>
          <td>${esc(p.category)}</td>
          <td>
            <input type="number" min="0" max="10000000" step="1000" value="${Number(p.price)}"
              data-price-id="${p.id}" style="width:120px" aria-label="Giá" />
          </td>
          <td><input type="checkbox" data-avail-id="${p.id}" ${p.available ? 'checked' : ''} aria-label="Đang bán" style="width:auto" /></td>
          <td><button class="btn danger" data-del-prod="${p.id}">Xóa</button></td>
        </tr>`).join('')
      : '<tr><td colspan="5" class="empty">Chưa có món nào.</td></tr>';
  } catch (e) { /* đã xử lý */ }
}

$('#prod-form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const msg = $('#prod-msg');
  msg.className = 'msg';
  try {
    await api('/api/products', {
      method: 'POST',
      body: JSON.stringify({
        name: $('#pr-name').value,
        price: $('#pr-price').value,
        category: $('#pr-cat').value,
        description: $('#pr-desc').value,
      }),
    });
    ev.target.reset();
    msg.className = 'msg ok';
    msg.textContent = 'Đã thêm món.';
    loadProducts();
  } catch (e) {
    msg.className = 'msg err';
    msg.textContent = e.message;
  }
});

document.addEventListener('change', async (ev) => {
  const t = ev.target;
  try {
    if (t.dataset?.availId) {
      await api('/api/products', {
        method: 'PATCH',
        body: JSON.stringify({ id: Number(t.dataset.availId), available: t.checked }),
      });
    } else if (t.dataset?.priceId) {
      await api('/api/products', {
        method: 'PATCH',
        body: JSON.stringify({ id: Number(t.dataset.priceId), price: t.value }),
      });
    } else if (t.dataset?.statusId) {
      await api('/api/orders', {
        method: 'PATCH',
        body: JSON.stringify({ id: Number(t.dataset.statusId), status: t.value }),
      });
    }
  } catch (e) {
    alert(e.message);
    loadProducts();
    loadOrders();
  }
});

/* ---------- Đơn hàng ---------- */

async function loadOrders() {
  try {
    const rows = await api('/api/orders');
    $('#order-rows').innerHTML = rows.length
      ? rows.map((o) => `
        <tr>
          <td><b>${esc(o.code)}</b><br><small>${esc(new Date(o.created_at).toLocaleString('vi-VN'))}</small></td>
          <td>${esc(o.customer_name)}<br>${esc(o.phone)}<br><small>${esc(o.address)}</small>
            ${o.note ? `<br><small><i>Ghi chú: ${esc(o.note)}</i></small>` : ''}</td>
          <td>${(o.items || []).map((i) => `${i.qty} × ${esc(i.name)}`).join('<br>')}
            <br><b>${money(o.total)}</b></td>
          <td>${o.method === 'cod' ? 'Khi nhận hàng' : 'Chuyển khoản'}</td>
          <td>
            <select data-status-id="${o.id}" aria-label="Trạng thái">
              ${Object.entries(STATUS_LABELS).map(([v, l]) =>
                `<option value="${v}" ${o.status === v ? 'selected' : ''}>${l}</option>`).join('')}
            </select>
          </td>
          <td><button class="btn danger" data-del-order="${o.id}">Xóa</button></td>
        </tr>`).join('')
      : '<tr><td colspan="6" class="empty">Chưa có đơn hàng nào.</td></tr>';
  } catch (e) { /* đã xử lý */ }
}

document.addEventListener('click', async (ev) => {
  const prod = ev.target.dataset?.delProd;
  const order = ev.target.dataset?.delOrder;
  try {
    if (prod && confirm('Xóa món này khỏi thực đơn?')) {
      await api('/api/products?id=' + prod, { method: 'DELETE' });
      loadProducts();
    }
    if (order && confirm('Xóa đơn hàng này? Không thể hoàn tác.')) {
      await api('/api/orders?id=' + order, { method: 'DELETE' });
      loadOrders();
    }
  } catch (e) {
    alert(e.message);
  }
});

// Lần tải trang đầu: nếu đã đăng nhập thì nạp dữ liệu cửa hàng
if (getToken()) loadShop();
