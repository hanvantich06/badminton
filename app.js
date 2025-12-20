const API = 'https://badminton-backend-9d2n.onrender.com';
let token = '';
let todayCompleted = false;

// Current logged in username (used for scoping local completion)
let currentUser = '';

function getLocalDateStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function getLocalKey() {
  if (!currentUser) return null; // don't fall back to global key to avoid cross-user leakage
  return `completedDate_${currentUser}`;
}

function getLocalCompletedDate() {
  try {
    const key = getLocalKey();
    if (!key) return null;
    return localStorage.getItem(key);
  } catch (e) { return null; }
}

function setLocalCompletedDate(dateStr) {
  try {
    const key = getLocalKey();
    if (!key) return; // cannot set when username unknown
    localStorage.setItem(key, dateStr);
  } catch (e) { }
}

function clearLocalCompletedDate() {
  try {
    const key = getLocalKey();
    if (!key) return;
    localStorage.removeItem(key);
  } catch (e) { }
}

/* ===== STREAK / COMPLETION HELPERS ===== */
// compute streak ending at a specific date (YYYY-MM-DD). If endDateStr omitted, defaults to today.
function computeStreakFromArray(completedDaysArr, endDateStr) {
  const set = new Set(completedDaysArr || []);
  // include local completion for today if present
  const todayStr = getLocalDateStr();
  const localDate = getLocalCompletedDate();
  if (localDate === todayStr) set.add(todayStr);

  // determine start date for checking
  let d;
  if (endDateStr) {
    const parts = endDateStr.split('-').map(Number);
    d = new Date(parts[0], parts[1] - 1, parts[2]);
  } else {
    d = new Date();
  }

  let streak = 0;
  while (true) {
    const s = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    if (set.has(s)) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else break;
  }
  return streak;
}

function renderStreak(count) {
  const el = document.getElementById('streak');
  if (el) el.innerText = count;
}

function renderCompletionRate(monthlyCompleted) {
  const daysSoFar = new Date().getDate();
  const rate = daysSoFar ? Math.round((monthlyCompleted / daysSoFar) * 100) : 0;
  const el = document.getElementById('completionRate');
  if (el) el.innerText = rate + '%';
  const bar = document.getElementById('completionBar');
  if (bar) bar.style.width = Math.min(rate, 100) + '%';
}

/* ===== LOADING HELPERS ===== */
function setButtonLoading(btn, isLoading, text) {
  if (!btn) return;
  if (isLoading) {
    btn.dataset.origHtml = btn.innerHTML;
    const spinner = '<span class="btn-spinner"><span class="spinner"></span></span>';
    btn.innerHTML = spinner + (text || btn.dataset.loadingText || btn.dataset.origHtml || 'Đang xử lý...');
    btn.classList.add('disabled-btn');
    btn.disabled = true;
  } else {
    if (btn.dataset.origHtml) {
      btn.innerHTML = btn.dataset.origHtml;
      delete btn.dataset.origHtml;
    }
    btn.classList.remove('disabled-btn');
    btn.disabled = false;
  }
}

function showGlobalLoading(isLoading, msg) {
  const el = document.getElementById('globalLoading');
  if (!el) return;
  el.style.display = isLoading ? 'flex' : 'none';
  const t = el.querySelector('.loader-text');
  if (t && msg !== undefined) t.innerText = msg;
}

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
  currentUser = '';
  document.getElementById('app').style.display = 'none';
  document.getElementById('auth').style.display = 'block';
  // Reset các input và hiển thị mặc định
  document.getElementById('username').value = '';
  document.getElementById('password').value = '';
  // Reset app UI
  const btn = document.getElementById('completeBtn');
  if (btn) {
    btn.innerText = 'Hoàn thành bài hôm nay';
    btn.classList.remove('disabled-btn');
    btn.disabled = false;
  }
  renderStreak(0);
  renderCompletionRate(0);
}


// ==== SIGNUP ====
async function confirmSignup() {
  const btn = document.getElementById('signupConfirmBtn');
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const level = document.getElementById('signup-level').value;

  if (!username || !password || !level) {
    showMessage('Vui lòng điền đầy đủ thông tin đăng ký.');
    return;
  }

  try {
    setButtonLoading(btn, true, 'Đang đăng ký...');
    showGlobalLoading(true, 'Đang đăng ký...');
    const res = await fetch(`${API}/auth/signup`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ username, password, level })
    });
    const data = await res.json();
    if (!res.ok) {
      if (data.error && data.error.includes('tồn tại')) showMessage(data.error, true);
      else showMessage(data.error || 'Đăng ký thất bại');
      return;
    }
    showMessage('Đăng ký thành công! Hãy đăng nhập.', true);
    closeLevelPopup();
  } catch (err) {
    console.error(err);
    showMessage('Không thể kết nối tới server');
  } finally {
    setButtonLoading(btn, false);
    showGlobalLoading(false);
  }
} 

// ==== LOGIN ====
async function login() {
  const btn = document.getElementById('loginSubmitBtn');
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  if (!username || !password) { showMessage('Vui lòng nhập tên đăng nhập và mật khẩu'); return; }

  try {
    setButtonLoading(btn, true, 'Đang đăng nhập...');
    showGlobalLoading(true, 'Đang đăng nhập...');
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

    await loadUserInfo();
    await loadWorkout();
    await loadCalendar();
  } catch (err) {
    console.error(err);
    showMessage('Không thể kết nối tới server');
  } finally {
    setButtonLoading(btn, false);
    showGlobalLoading(false);
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

    // Also respect a local completion record so the button stays disabled until tomorrow
    const todayStr = getLocalDateStr();
    const localDate = getLocalCompletedDate();
    if (localDate === todayStr) {
      todayCompleted = true;
    } else if (localDate && localDate !== todayStr) {
      // old entry - clear it
      clearLocalCompletedDate();
    }

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
  const btn = document.getElementById('completeBtn');
  try {
    setButtonLoading(btn, true, 'Đang cập nhật...');
    const res = await fetch(`${API}/workout/complete`, {
      method:'POST',
      headers:{'Authorization':'Bearer '+token}
    });
    const data = await res.json();
    if (data.success) {
      todayCompleted = true;
      // ensure we have user info before persisting local completion
      await loadUserInfo();
      // persist locally so the button remains disabled until tomorrow even across reloads
      setLocalCompletedDate(getLocalDateStr());
      await loadWorkout();
      await loadCalendar();
      showMessage('Chúc mừng! Bạn đã hoàn thành bài tập hôm nay.');
    } else {
      showMessage(data.error || 'Không thể hoàn thành bài tập');
    }
  } catch (err) {
    console.error(err);
    showMessage('Không thể hoàn thành bài tập hôm nay');
  } finally {
    setButtonLoading(btn, false);
  }
} 

// ==== LOAD USER INFO ====
async function loadUserInfo() {
  const updateBtn = document.getElementById('updateInfoBtn');
  try {
    if (updateBtn) setButtonLoading(updateBtn, true, 'Đang tải...');
    const res = await fetch(`${API}/user/me`, {
      headers: { 'Authorization': 'Bearer ' + token }
    });

    const data = await res.json();
    if (!res.ok) {
      showMessage(data.error || 'Không thể tải thông tin');
      return;
    }

    // set currentUser so local completion checks are scoped to this user
    currentUser = data.username || '';

    document.getElementById('info-username').innerText = data.username;
    document.getElementById('info-level').innerText = data.level;

    const d = new Date(data.startedAt);
    document.getElementById('info-startedAt').innerText =
      `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;

    document.getElementById('info-monthlyDays').innerText =
      data.monthlyCompleted + ' ngày';

    // show official completion rate from server
    renderCompletionRate(data.monthlyCompleted || 0);

    document.getElementById('info-totalDays').innerText =
      data.totalCompleted + ' ngày';

  } catch (err) {
    console.error(err);
    showMessage('Không thể tải thông tin tài khoản');
  } finally {
    if (updateBtn) setButtonLoading(updateBtn, false);
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

      if (completedDays.includes(dateStr) || (dateStr === todayStr && getLocalCompletedDate() === todayStr)) {
        div.classList.add('done');
      }

      if (dateStr === todayStr) {
        div.classList.add('today');
      }

      calendar.appendChild(div);
    }

    // compute and render streak
    // If today is completed (server or local), count streak up to today; otherwise count up to yesterday
    const localDate = getLocalCompletedDate();
    const completedToday = completedDays.includes(todayStr) || localDate === todayStr;
    let streakEnd = todayStr;
    if (!completedToday) {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      streakEnd = `${y.getFullYear()}-${String(y.getMonth()+1).padStart(2,'0')}-${String(y.getDate()).padStart(2,'0')}`;
    }
    const streak = computeStreakFromArray(completedDays, streakEnd);
    renderStreak(streak);

    // derive monthly completed from calendar and render completion rate (this will be overridden by server value when available)
    const monthPrefix = `${year}-${String(month + 1).padStart(2,'0')}`;
    const monthlyCompletedFromCalendar = completedDays.filter(d => d.startsWith(monthPrefix)).length + (getLocalCompletedDate() === todayStr && !completedDays.includes(todayStr) ? 1 : 0);
    renderCompletionRate(monthlyCompletedFromCalendar);

  } catch (err) {
    console.error(err);
    showMessage('Không thể tải lịch luyện tập');
  }
}