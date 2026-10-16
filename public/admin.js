const $ = (s) => document.querySelector(s);
const KEY = 'ncyt_admin_token';

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function getToken() {
  try { return sessionStorage.getItem(KEY) || ''; } catch { return ''; }
}
function setToken(t) {
  try { t ? sessionStorage.setItem(KEY, t) : sessionStorage.removeItem(KEY); } catch {}
}

async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + getToken(),
      ...(opts.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && getToken()) {
    setToken('');
    showLogin();
  }
  if (!res.ok) throw new Error(data.error || 'Có lỗi xảy ra');
  return data;
}

function showLogin() {
  $('#login-box').hidden = false;
  $('#dashboard').hidden = true;
  $('#logout').hidden = true;
}

function showDashboard() {
  $('#login-box').hidden = true;
  $('#dashboard').hidden = false;
  $('#logout').hidden = false;
  loadCamps();
  loadVolunteers();
  // admin-shop.js được nạp sau file này; lần tải trang đầu nó tự gọi loadShop
  if (typeof loadShop === 'function') loadShop();
}

async function loadCamps() {
  const rows = await fetch('/api/camps').then((r) => r.json());
  $('#camp-rows').innerHTML = rows.length
    ? rows.map((c) => `
      <tr>
        <td><b>${esc(c.name)}</b><br><small>${esc(c.description)}</small></td>
        <td>${esc(c.location)}</td>
        <td>${esc(c.activities)}</td>
        <td><button class="btn danger" data-del-camp="${c.id}">Xóa</button></td>
      </tr>`).join('')
    : '<tr><td colspan="4" class="empty">Chưa có trại nào.</td></tr>';
}

async function loadVolunteers() {
  try {
    const rows = await api('/api/volunteers');
    $('#vol-rows').innerHTML = rows.length
      ? rows.map((v) => `
        <tr>
          <td>${esc(new Date(v.created_at).toLocaleString('vi-VN'))}</td>
          <td>${esc(v.name)}</td>
          <td>${esc(v.phone)}<br><small>${esc(v.email)}</small></td>
          <td>${esc(v.camp)}</td>
          <td>${esc(v.message)}</td>
          <td><button class="btn danger" data-del-vol="${v.id}">Xóa</button></td>
        </tr>`).join('')
      : '<tr><td colspan="6" class="empty">Chưa có đơn đăng ký nào.</td></tr>';
  } catch (e) { /* đã xử lý trong api() */ }
}

$('#login-form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const msg = $('#login-msg');
  msg.className = 'msg';
  try {
    const { token } = await api('/api/login', {
      method: 'POST',
      body: JSON.stringify({ password: $('#password').value }),
    });
    setToken(token);
    $('#password').value = '';
    showDashboard();
  } catch (e) {
    msg.className = 'msg err';
    msg.textContent = e.message;
  }
});

$('#camp-form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const msg = $('#camp-msg');
  msg.className = 'msg';
  try {
    await api('/api/camps', {
      method: 'POST',
      body: JSON.stringify({
        name: $('#c-name').value,
        location: $('#c-location').value,
        description: $('#c-desc').value,
        activities: $('#c-act').value,
      }),
    });
    ev.target.reset();
    msg.className = 'msg ok';
    msg.textContent = 'Đã thêm trại cứu hộ.';
    loadCamps();
  } catch (e) {
    msg.className = 'msg err';
    msg.textContent = e.message;
  }
});

document.addEventListener('click', async (ev) => {
  const camp = ev.target.dataset?.delCamp;
  const vol = ev.target.dataset?.delVol;
  try {
    if (camp && confirm('Xóa trại này?')) {
      await api('/api/camps?id=' + camp, { method: 'DELETE' });
      loadCamps();
    }
    if (vol && confirm('Xóa đơn đăng ký này?')) {
      await api('/api/volunteers?id=' + vol, { method: 'DELETE' });
      loadVolunteers();
    }
  } catch (e) {
    alert(e.message);
  }
});

$('#logout').addEventListener('click', (ev) => {
  ev.preventDefault();
  setToken('');
  showLogin();
});

getToken() ? showDashboard() : showLogin();
