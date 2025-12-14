const API = 'http://localhost:4000';
let token = '';
let todayCompleted = false;

// ==== LEVEL POPUP ====
function openLevelPopup() { document.getElementById('levelModal').classList.add('show'); }
function closeLevelPopup() { document.getElementById('levelModal').classList.remove('show'); }

// ==== MESSAGE POPUP ====
function showMessage(msg, showLogin = false) {
  document.getElementById('messageText').innerText = msg;
  document.getElementById('loginBtn').style.display = showLogin ? 'inline-block' : 'none';
  document.getElementById('messageModal').style.display = 'flex';
}
function closeMessagePopup() { document.getElementById('messageModal').style.display = 'none'; }
function openLogin() {
  closeMessagePopup();
  document.getElementById('levelModal').style.display = 'none';
  document.getElementById('auth').style.display = 'block';
}
function logout() {
  token = ''; // xóa token
  document.getElementById('app').style.display = 'none';
  document.getElementById('auth').style.display = 'block';
  // Reset các input và hiển thị mặc định
  document.getElementById('username').value = '';
  document.getElementById('password').value = '';
}


// ==== SIGNUP ====
async function confirmSignup() {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const level = document.getElementById('signup-level').value;

  if (!username || !password || !level) {
    showMessage('Vui lòng điền đầy đủ thông tin đăng ký.');
    return;
  }

  try {
    const res = await fetch(`${API}/auth/signup`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ username, password, level })
    });
    const data = await res.json();
    if (!res.ok) {
      if (data.error.includes('tồn tại')) showMessage(data.error, true);
      else showMessage(data.error || 'Đăng ký thất bại');
      return;
    }
    showMessage('Đăng ký thành công! Hãy đăng nhập.', true);
    closeLevelPopup();
  } catch (err) {
    console.error(err);
    showMessage('Không thể kết nối tới server');
  }
}

// ==== LOGIN ====
async function login() {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  if (!username || !password) { showMessage('Vui lòng nhập tên đăng nhập và mật khẩu'); return; }

  try {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) { showMessage(data.error || 'Đăng nhập thất bại'); return; }

    token = data.token;
    document.getElementById('auth').style.display = 'none';
    document.getElementById('app').style.display = 'block';

    loadWorkout();
    loadUserInfo();
    loadCalendar();
  } catch (err) {
    console.error(err);
    showMessage('Không thể kết nối tới server');
  }
}

// ==== LOAD WORKOUT ====
async function loadWorkout() {
  try {
    const res = await fetch(`${API}/workout/today`, {
      headers: {'Authorization':'Bearer '+token}
    });
    const data = await res.json();
    document.getElementById('user-level').innerText = 'Cấp độ: ' + data.level;
    document.getElementById('routine').innerText = data.routine || 'Chưa có bài tập hôm nay';
    todayCompleted = data.completed || false;

    const btn = document.getElementById('completeBtn');
    if (todayCompleted) {
      btn.innerText = 'Đã hoàn thành bài hôm nay';
      btn.classList.add('disabled-btn');
      btn.disabled = true;
    } else {
      btn.innerText = 'Hoàn thành bài hôm nay';
      btn.classList.remove('disabled-btn');
      btn.disabled = false;
    }
  } catch (err) {
    console.error(err);
    showMessage('Không thể tải bài tập hôm nay');
  }
}

// ==== COMPLETE WORKOUT ====
async function complete() {
  if (todayCompleted) return;
  try {
    const res = await fetch(`${API}/workout/complete`, {
      method:'POST',
      headers:{'Authorization':'Bearer '+token}
    });
    const data = await res.json();
    if (data.success) {
      todayCompleted = true;
      loadWorkout();
      loadUserInfo();
      loadCalendar();
      showMessage('Chúc mừng! Bạn đã hoàn thành bài tập hôm nay.');
    } else {
      showMessage(data.error || 'Không thể hoàn thành bài tập');
    }
  } catch (err) {
    console.error(err);
    showMessage('Không thể hoàn thành bài tập hôm nay');
  }
}

// ==== LOAD USER INFO ====
async function loadUserInfo() {
  try {
    const res = await fetch(`${API}/user/me`, {
      headers: { 'Authorization': 'Bearer ' + token }
    });

    const data = await res.json();
    if (!res.ok) {
      showMessage(data.error || 'Không thể tải thông tin');
      return;
    }

    document.getElementById('info-username').innerText = data.username;
    document.getElementById('info-level').innerText = data.level;

    const d = new Date(data.startedAt);
    document.getElementById('info-startedAt').innerText =
      `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;

    document.getElementById('info-monthlyDays').innerText =
      data.monthlyCompleted + ' ngày';

    document.getElementById('info-totalDays').innerText =
      data.totalCompleted + ' ngày';

  } catch (err) {
    console.error(err);
    showMessage('Không thể tải thông tin tài khoản');
  }
}

async function loadCalendar() {
  try {
    const res = await fetch(`${API}/workout/calendar`, {
      headers: { 'Authorization': 'Bearer ' + token }
    });

    const completedDays = await res.json(); // ["YYYY-MM-DD"]

    const calendar = document.getElementById('calendar');
    calendar.innerHTML = '';

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-based
    const todayStr = new Date().toISOString().slice(0, 10);

    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

      const div = document.createElement('div');
      div.className = 'day';
      div.innerText = d;

      if (completedDays.includes(dateStr)) {
        div.classList.add('done');
      }

      if (dateStr === todayStr) {
        div.classList.add('today');
      }

      calendar.appendChild(div);
    }

  } catch (err) {
    console.error(err);
    showMessage('Không thể tải lịch luyện tập');
  }
}