/* ══════════════════════════════════════════════════════
   SHOPEE TERMINATE — Warehouse Manager  v4.0
   script.js  —  Full app logic
══════════════════════════════════════════════════════ */

/* ────────────────────────────────────────────────────
   CONFIG & CONSTANTS
──────────────────────────────────────────────────── */
const DEFAULT_SHEET_ID = '1NOBa-cFOiarcPzqe2i9IkpU7IkgV9ndUd6_0jpJdx9w';

// Google Apps Script Web App URL เริ่มต้น
// วิธีใช้: ถ้าอยากให้ทุกเครื่องจำการเชื่อมต่อ Google Sheets ทันที ให้ใส่ URL /exec ตรงนี้
// ตัวอย่าง: const DEFAULT_API_URL = 'https://script.google.com/macros/s/XXXXX/exec';
const DEFAULT_API_URL = 'https://script.google.com/macros/s/AKfycbyEqqioSDfYpM6oMvZXfEzs3-gAmhpqxmiPzqK2qzbaotnEIGdhw5U-gr9aLFAvqHBc/exec';
if (DEFAULT_API_URL) { localStorage.setItem('wm_api_url', DEFAULT_API_URL); }

// Auto-migrate: ถ้า localStorage เก็บ Sheet ID เก่า ให้เปลี่ยนเป็นอันใหม่
(function migrateSheetId() {
  const stored = localStorage.getItem('wm_sheet_id');
  if (!stored || stored === '1Xdz_X4MfyWIhQGnXmmDqqqolbYCFFTQBMac2_y8EqBU') {
    localStorage.setItem('wm_sheet_id', DEFAULT_SHEET_ID);
  }
})();

const CONFIG = {
  // ลำดับการจำค่า: 1) URL ที่เคยกดบันทึกในเครื่อง 2) DEFAULT_API_URL ในไฟล์นี้ 3) Demo Mode
  apiUrl:  localStorage.getItem('wm_api_url')   || DEFAULT_API_URL || '',
  sheetId: localStorage.getItem('wm_sheet_id')  || DEFAULT_SHEET_ID
};

const DUE_SOON_DAYS = 3;

// Status → dot class mapping
const STATUS_CLASS = {
  'Backlog':              'backlog',
  'To Do':               'todo',
  'กำลังดำเนินการ':       'active',
  'รอเอกสาร':            'waiting',
  'รอ Vendor':            'waiting',
  'รอ':                  'waiting',
  'ติดขัด':              'blocked',
  'ปิดแล้ว':             'closed',
  'เสร็จสิ้น':           'closed',
  'Completed':           'closed',
};

// Warehouse status → badge class
const WH_STATUS_CLASS = {
  'วางแผน':              'planning',
  'กำลังดำเนินการ':       'in-progress',
  'พักงาน':              'on-hold',
  'เสร็จสิ้น':           'completed',
  'ปิดงาน':              'closed',
  'Active':              'active',
};

const CLOSED_STATUSES  = ['ปิดแล้ว','เสร็จสิ้น','Completed'];
const CLOSED_CAL       = ['เสร็จสิ้น','เสร็จแล้ว','ยกเลิก'];

/* ────────────────────────────────────────────────────
   AUTH SYSTEM
──────────────────────────────────────────────────── */
function defaultUsers() {
  return [{ username: 'admin', passwordHash: simpleHash('admin'), role: 'admin' }];
}

function normalizeUsers(arr) {
  const src = Array.isArray(arr) ? arr : [];
  const clean = src
    .map(u => ({
      username: String(u.username || u.Username || '').trim(),
      passwordHash: String(u.passwordHash || u['Password Hash'] || '').trim(),
      role: String(u.role || u.Role || 'user').trim() || 'user'
    }))
    .filter(u => u.username && u.passwordHash);

  if (!clean.find(u => u.username === 'admin')) {
    clean.unshift(defaultUsers()[0]);
  }
  return clean;
}

function getUsers() {
  // Live mode: use users already loaded from Google Sheets.
  if (CONFIG.apiUrl && state && Array.isArray(state.users) && state.users.length) {
    return state.users;
  }

  const raw = localStorage.getItem('wm_users');
  if (raw) {
    try { return normalizeUsers(JSON.parse(raw)); } catch (_) {}
  }

  const defaults = defaultUsers();
  localStorage.setItem('wm_users', JSON.stringify(defaults));
  return defaults;
}

async function saveUsers(arr) {
  const clean = normalizeUsers(arr);
  if (state) state.users = clean;
  localStorage.setItem('wm_users', JSON.stringify(clean));

  // Live mode: ต้องบันทึกลง Google Sheets ให้สำเร็จก่อนค่อยบอกว่าสำเร็จ
  if (CONFIG.apiUrl) {
    try {
      await api('saveUsers', { users: clean, user: getCurrentUser()?.username || 'System' });
      try { await getOnlineUsers(); } catch (_) {}
    } catch (err) {
      console.error('[saveUsers online]', err);
      throw new Error('บันทึกผู้ใช้ลงออนไลน์ไม่สำเร็จ: ' + (err.message || err));
    }
  }
  return clean;
}

async function getOnlineUsers() {
  if (!CONFIG.apiUrl) return getUsers();
  const res = await fetch(`${CONFIG.apiUrl}?action=getUsers&sheetId=${encodeURIComponent(CONFIG.sheetId)}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.message || 'โหลด Users ไม่สำเร็จ');
  const users = normalizeUsers(json.users || json.data || json.Users || []);
  state.users = users;
  localStorage.setItem('wm_users', JSON.stringify(users));
  return users;
}

function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = (Math.imul(31, h) + str.charCodeAt(i)) | 0; }
  return String(h);
}

async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errEl = document.getElementById('loginError');
  const btn = document.getElementById('loginBtn');

  // 1) เริ่มจาก user ในเครื่องก่อน เพื่อให้ admin/admin เข้าได้เสมอแม้เน็ตหรือ Apps Script มีปัญหา
  let users = getUsers();

  // 2) ถ้ามี URL ออนไลน์ ค่อยดึง Users จาก Google Sheets มาทับ
  if (CONFIG.apiUrl) {
    try {
      if (btn) { btn.disabled = true; btn.textContent = 'กำลังตรวจสอบ...'; }
      const onlineUsers = await getOnlineUsers();
      if (Array.isArray(onlineUsers) && onlineUsers.length) users = onlineUsers;
    } catch (err) {
      console.warn('[login online users]', err);
      // ไม่บล็อกการ login ถ้าออนไลน์มีปัญหา ให้ใช้ข้อมูล local ต่อ
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'เข้าสู่ระบบ'; }
    }
  }

  let match = users.find(u => u.username === username && u.passwordHash === simpleHash(password));

  // 3) Emergency fallback: กันกรณี Users sheet / localStorage เก็บรหัส admin ผิด ทำให้ล็อกอินไม่ได้
  // ใช้เฉพาะ admin/admin ตาม hint หน้า Login
  if (!match && username === 'admin' && password === 'admin') {
    match = { username: 'admin', passwordHash: simpleHash('admin'), role: 'admin' };

    const fixedUsers = normalizeUsers(users);
    const idx = fixedUsers.findIndex(u => u.username === 'admin');
    if (idx >= 0) fixedUsers[idx] = match;
    else fixedUsers.unshift(match);

    // อัปเดต localStorage และ sync กลับ Google Sheets ถ้ามี API URL
    saveUsers(fixedUsers).catch(err => console.warn('[admin fallback saveUsers]', err));
  }

  if (!match) {
    if (errEl) {
      errEl.textContent = 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';
      errEl.classList.remove('hidden');
    }
    return;
  }

  if (errEl) errEl.classList.add('hidden');
  localStorage.setItem('wm_session', JSON.stringify({ username: match.username, role: match.role }));
  launchApp(match);
}
function handleLogout() {
  localStorage.removeItem('wm_session');
  document.getElementById('appContainer').classList.add('hidden');
  document.getElementById('loginPage').classList.remove('hidden');
  document.getElementById('loginForm').reset();
}

function togglePw(inputId, btn) {
  const el = document.getElementById(inputId);
  el.type = el.type === 'password' ? 'text' : 'password';
  btn.textContent = el.type === 'password' ? '👁' : '🙈';
}

function getCurrentUser() {
  const s = localStorage.getItem('wm_session');
  return s ? JSON.parse(s) : null;
}

function launchApp(user) {
  document.getElementById('loginPage').classList.add('hidden');
  document.getElementById('appContainer').classList.remove('hidden');
  document.getElementById('userAvatar').textContent = (user.username[0] || 'U').toUpperCase();
  document.getElementById('userNameDisplay').textContent = user.username;
  document.getElementById('userRoleDisplay').textContent = user.role;
  initApp();
}

/* ────────────────────────────────────────────────────
   IN-MEMORY STATE
──────────────────────────────────────────────────── */
let state = {
  warehouses: [],
  tasks: [],
  documents: [],
  calendar: [],
  activity: [],
  issues: [],
  checklist: [],    // checklist items (linked to warehouse)
  checklistTemplates: [],
  trash: [],
  users: [],
  settings: {
    'Task Status': ['Backlog','To Do','กำลังดำเนินการ','รอเอกสาร','รอ Vendor','ติดขัด','ปิดแล้ว'],
    'Priority': ['Low','Medium','High','Critical'],
    'Warehouse Status': ['วางแผน','กำลังดำเนินการ','พักงาน','เสร็จสิ้น','ปิดงาน'],
    'Phase': ['Pre-Survey','Setup','Operation','Handover','Closed'],
    'Document Type': ['สัญญา','ใบส่งงาน','รูปถ่าย','รายงาน','อื่นๆ'],
    'Document Status': ['รอตรวจสอบ','อนุมัติแล้ว','ปฏิเสธ'],
    'Event Type': ['ประชุม','Deadline','ตรวจงาน','ส่งมอบ','อื่นๆ'],
    'Calendar Status': ['ยังไม่เตือน','เตือนแล้ว','เสร็จสิ้น','ยกเลิก']
  }
};

// Demo seed data
const DEMO_SEED = {
  warehouses: [
    { 'Warehouse ID':'WH001','Warehouse Name':'คลัง A สุวรรณภูมิ','Location / Zone':'Zone A','Owner':'สมชาย ดีใจ','Owner Phone':'081-234-5678','Start Date':'2026-04-01','Target Handover Date':'2026-06-30','Warehouse Status':'กำลังดำเนินการ','Document Folder Link':'','Notes':'คลังหลัก','Created At':'2026-04-01','Updated At':'2026-05-01' },
    { 'Warehouse ID':'WH002','Warehouse Name':'คลัง B ลาดกระบัง','Location / Zone':'Zone B','Owner':'สมหญิง รักงาน','Owner Phone':'089-876-5432','Start Date':'2026-05-01','Target Handover Date':'2026-07-15','Warehouse Status':'วางแผน','Document Folder Link':'','Notes':'','Created At':'2026-05-01','Updated At':'2026-05-10' }
  ],
  tasks: [
    { 'Task ID':'T001','Created Date':'2026-05-01','Warehouse ID':'WH001','Phase':'Setup','Task Name':'ติดตั้งระบบไฟฟ้า','Assignee':'ช่างไฟ','Status':'กำลังดำเนินการ','Priority':'High','Due Date':'2026-05-26','Closed Date':'','Evidence Link':'','Last Updated':'2026-05-20','Notes':'' },
    { 'Task ID':'T002','Created Date':'2026-05-05','Warehouse ID':'WH001','Phase':'Setup','Task Name':'ตรวจสอบโครงสร้าง','Assignee':'วิศวกร','Status':'To Do','Priority':'Medium','Due Date':'2026-05-28','Closed Date':'','Evidence Link':'','Last Updated':'2026-05-05','Notes':'' },
    { 'Task ID':'T003','Created Date':'2026-05-10','Warehouse ID':'WH002','Phase':'Pre-Survey','Task Name':'วาดแผนผัง','Assignee':'ทีม Survey','Status':'Backlog','Priority':'Low','Due Date':'2026-06-05','Closed Date':'','Evidence Link':'','Last Updated':'2026-05-10','Notes':'' }
  ],
  documents: [],
  calendar: [
    { 'Event ID':'E001','Warehouse ID':'WH001','Task ID':'T001','Event Title':'ประชุมติดตามงาน','Event Type':'ประชุม','Start Date':'2026-05-24','Due Date':'2026-05-24','Start Time':'10:00','End Time':'11:00','Assignee':'ทีมงาน','Reminder Days':'1','Calendar Status':'ยังไม่เตือน','Notes':'' }
  ],
  activity: [],
  issues: [],
  checklist: [],
  checklistTemplates: [],
  trash: []
};

/* ────────────────────────────────────────────────────
   UTILITIES
──────────────────────────────────────────────────── */
function uid(prefix = 'ID') {
  return prefix + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2,5).toUpperCase();
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// Parse any date format → ISO yyyy-mm-dd or ''
function fmtDate(raw) {
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(String(raw))) return String(raw).slice(0,10);
  // Thai format: "25/5/2026" or "25/5/2026, 12:51:48"
  const m = String(raw).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  return '';
}

function displayDate(iso) {
  if (!iso) return '—';
  const [y,m,d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function isOverdue(dueDateRaw) {
  const due = fmtDate(dueDateRaw);
  return due && due < todayISO();
}

function isClosed(t) {
  return CLOSED_STATUSES.includes(t['Status'] || t['Calendar Status'] || '');
}

function isCalClosed(e) {
  return CLOSED_CAL.includes(e['Calendar Status'] || '');
}

function statusDotClass(status) {
  return STATUS_CLASS[status] || 'default';
}

function whStatusBadgeClass(status) {
  return WH_STATUS_CLASS[status] || 'default';
}

function statusDotHtml(status) {
  return `<span class="status-dot ${statusDotClass(status)}" title="${status}"></span>`;
}

function statusPillHtml(status) {
  return `<span class="status-pill ${statusDotClass(status)}">${statusDotHtml(status)} ${status || '—'}</span>`;
}

function priorityPillHtml(priority) {
  const cls = (priority||'').toLowerCase();
  return `<span class="priority-pill ${cls}">${priority || '—'}</span>`;
}

function whBadgeHtml(status) {
  return `<span class="wh-status-badge ${whStatusBadgeClass(status)}">${status || '—'}</span>`;
}

function whName(id) {
  const w = state.warehouses.find(x => x['Warehouse ID'] === id);
  return w ? w['Warehouse Name'] : id || '—';
}

function esc(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function dataFromForm(form) {
  const data = {};
  new FormData(form).forEach((v, k) => {
    if (k !== '') data[k] = v === 'on' ? true : v;
  });
  return data;
}

/* ────────────────────────────────────────────────────
   TOAST
──────────────────────────────────────────────────── */
function toast(msg, type = 'default', duration = 3000) {
  const tc = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  tc.appendChild(el);
  setTimeout(() => {
    el.classList.add('fade-out');
    setTimeout(() => el.remove(), 350);
  }, duration);
}

/* ────────────────────────────────────────────────────
   LOADING
──────────────────────────────────────────────────── */
function showLoading(msg = 'กำลังโหลด...') {
  document.getElementById('loadingText').textContent = msg;
  document.getElementById('loadingOverlay').classList.remove('hidden');
}
function hideLoading() {
  document.getElementById('loadingOverlay').classList.add('hidden');
}

async function withLoading(btn, fn) {
  const orig = btn ? btn.innerHTML : null;
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="loading-spinner" style="width:16px;height:16px;border-width:2px;display:inline-block;"></span>'; }
  try { await fn(); }
  finally { if (btn) { btn.disabled = false; btn.innerHTML = orig; } }
}

/* ────────────────────────────────────────────────────
   API
──────────────────────────────────────────────────── */
async function api(action, payload = {}) {
  if (!CONFIG.apiUrl) {
    return demoApi(action, payload);
  }
  // ใช้ text/plain เพื่อหลีกเลี่ยง CORS Preflight (OPTIONS) ที่ Apps Script ไม่รองรับ
  const res = await fetch(CONFIG.apiUrl, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, sheetId: CONFIG.sheetId, ...payload })
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message || 'API Error');
  return json;
}

async function loadAllData() {
  if (!CONFIG.apiUrl) return; // demo mode: already in state
  showLoading('กำลังโหลดข้อมูล...');
  try {
    // ส่ง sheetId ผ่าน query string ด้วย สำหรับ GET request
    const res = await fetch(`${CONFIG.apiUrl}?action=getAllData&sheetId=${encodeURIComponent(CONFIG.sheetId)}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    const d = json.data;
    state.warehouses          = d.Warehouses            || [];
    state.tasks               = d.Tasks                 || [];
    state.documents           = d.Documents             || [];
    state.calendar            = d.Calendar              || [];
    state.activity            = d.Activity_Log          || [];
    state.issues              = d.Issues                || [];
    state.checklistTemplates  = d.Checklist_Templates   || [];
    state.trash               = d.Trash                 || [];
    state.users               = normalizeUsers(d.Users || []);
    if (state.users.length) localStorage.setItem('wm_users', JSON.stringify(state.users));
    if (d.Settings) mergeSettings(d.Settings);
    renderAll();
  } catch(err) {
    toast('โหลดข้อมูลไม่สำเร็จ: ' + err.message, 'error');
  } finally {
    hideLoading();
  }
}

async function postAndRefresh(action, payload, successMsg, section = '') {
  try {
    await api(action, payload);
    toast(successMsg, 'success');
    if (!CONFIG.apiUrl) {
      renderAll();
    } else {
      await loadAllData();
      renderAll();
    }
    if (section) showSection(section);
  } catch(err) {
    toast('❌ เกิดข้อผิดพลาด: ' + (err.message || String(err)), 'error');
    console.error('[postAndRefresh]', action, err);
  }
}

function mergeSettings(raw) {
  // raw is array-of-objects [{...}, ...]
  // do nothing if not parseable
  if (!Array.isArray(raw)) return;
  const keys = Object.keys(state.settings);
  raw.forEach(row => {
    keys.forEach(k => {
      const val = row[k];
      if (val && !state.settings[k].includes(val)) state.settings[k].push(val);
    });
  });
}

/* ────────────────────────────────────────────────────
   DEMO API (in-memory mutations)
──────────────────────────────────────────────────── */
function demoApi(action, payload) {
  const now = new Date().toLocaleString('th-TH');
  const user = getCurrentUser()?.username || 'System';

  function logActivity(act, sheet, recId, whId, details) {
    state.activity.unshift({ 'Log ID': uid('LOG'), 'Timestamp': now, 'Action': act, 'Sheet': sheet, 'Record ID': recId, 'Warehouse ID': whId, 'User': user, 'Details': details });
  }

  switch (action) {

    case 'addWarehouse': {
      const w = { ...payload, 'Warehouse ID': uid('WH'), 'Created At': now, 'Updated At': now };
      state.warehouses.push(w);
      logActivity('ADD', 'Warehouses', w['Warehouse ID'], w['Warehouse ID'], w['Warehouse Name']);
      return { success: true };
    }

    case 'addTask': {
      delete payload['Progress %'];
      const t = { ...payload, 'Task ID': uid('T'), 'Created Date': now, 'Last Updated': now };
      state.tasks.push(t);
      logActivity('ADD', 'Tasks', t['Task ID'], t['Warehouse ID'], t['Task Name']);
      if (payload.addToCalendar) {
        const ev = { 'Event ID': uid('E'), 'Warehouse ID': t['Warehouse ID'], 'Task ID': t['Task ID'],
                     'Event Title': t['Task Name'], 'Event Type': 'Deadline', 'Start Date': t['Due Date'] || now,
                     'Due Date': t['Due Date'] || now, 'Start Time': '', 'End Time': '',
                     'Assignee': t['Assignee'] || '', 'Reminder Days': '1', 'Calendar Status': 'ยังไม่เตือน', 'Notes': '' };
        state.calendar.push(ev);
      }
      return { success: true };
    }

    case 'addDocument': {
      const d = { ...payload, 'Document ID': uid('D'), 'Uploaded Date': now };
      state.documents.push(d);
      logActivity('ADD', 'Documents', d['Document ID'], d['Warehouse ID'], d['Document Name']);
      return { success: true };
    }

    case 'addCalendarEvent': {
      const ev = { ...payload, 'Event ID': uid('E') };
      state.calendar.push(ev);
      logActivity('ADD', 'Calendar', ev['Event ID'], ev['Warehouse ID'], ev['Event Title']);
      return { success: true };
    }

    case 'addIssue': {
      const iss = { ...payload, 'Issue ID': uid('ISS'), 'Created Date': now };
      state.issues.push(iss);
      logActivity('ADD', 'Issues', iss['Issue ID'], iss['Warehouse ID'], iss['Issue Title']);
      return { success: true };
    }

    case 'updateStatus': {
      const { id, field, value, sheet } = payload;
      const arr = sheet === 'Calendar' ? state.calendar : (sheet === 'Issues' ? state.issues : state.tasks);
      const idField = sheet === 'Calendar' ? 'Event ID' : (sheet === 'Issues' ? 'Issue ID' : 'Task ID');
      const rec = arr.find(x => x[idField] === id);
      if (rec) {
        rec[field] = value;
        rec['Last Updated'] = now;
        if (CLOSED_STATUSES.includes(value)) rec['Closed Date'] = now;
        logActivity('UPDATE_STATUS', sheet, id, rec['Warehouse ID'] || '', `${field} → ${value}`);
      }
      return { success: true };
    }

    case 'updateWarehouse': {
      const { 'Warehouse ID': wid, ...fields } = payload;
      const w = state.warehouses.find(x => x['Warehouse ID'] === wid);
      if (w) { Object.assign(w, fields); w['Updated At'] = now; logActivity('UPDATE', 'Warehouses', wid, wid, w['Warehouse Name']); }
      return { success: true };
    }

    case 'updateTask': {
      const { 'Task ID': tid, ...fields } = payload;
      delete fields['Progress %'];
      const t = state.tasks.find(x => x['Task ID'] === tid);
      if (t) { Object.assign(t, fields); t['Last Updated'] = now; logActivity('UPDATE', 'Tasks', tid, t['Warehouse ID'], t['Task Name']); }
      return { success: true };
    }

    case 'updateCalendarEvent': {
      const { 'Event ID': eid, ...fields } = payload;
      const ev = state.calendar.find(x => x['Event ID'] === eid);
      if (ev) { Object.assign(ev, fields); logActivity('UPDATE', 'Calendar', eid, ev['Warehouse ID'], ev['Event Title']); }
      return { success: true };
    }

    case 'deleteRecord': {
      const { sheet, id, reason } = payload;
      const map = { Warehouses: ['warehouses','Warehouse ID'], Tasks: ['tasks','Task ID'], Documents: ['documents','Document ID'],
                    Calendar: ['calendar','Event ID'], Issues: ['issues','Issue ID'] };
      if (map[sheet]) {
        const [key, idField] = map[sheet];
        const idx = state[key].findIndex(x => x[idField] === id);
        if (idx !== -1) {
          const rec = state[key][idx];
          state.trash.push({ 'Trash ID': uid('TR'), 'Timestamp': now, 'Source Sheet': sheet,
                             'Record ID': id, 'Warehouse ID': rec['Warehouse ID'] || '', 'Deleted By': user,
                             'Reason': reason || '', 'Snapshot JSON': JSON.stringify(rec) });
          state[key].splice(idx, 1);
          logActivity('DELETE', sheet, id, rec['Warehouse ID'] || '', reason || '');
        }
      }
      return { success: true };
    }

    case 'addChecklistItem': {
      const item = { ...payload, 'Item ID': uid('CI'), 'Created Date': now };
      state.checklist.push(item);
      return { success: true };
    }

    case 'updateChecklistItem': {
      const { 'Item ID': iid, ...fields } = payload;
      const item = state.checklist.find(x => x['Item ID'] === iid);
      if (item) Object.assign(item, fields);
      return { success: true };
    }

    case 'addChecklistTemplate': {
      const ct = { ...payload, 'Template ID': uid('CT'), 'Active': true };
      state.checklistTemplates.push(ct);
      return { success: true };
    }

    case 'createChecklist': {
      // Apply templates to a warehouse
      const { warehouseId, templates } = payload;
      templates.forEach(t => {
        state.checklist.push({
          'Item ID': uid('CI'), 'Warehouse ID': warehouseId,
          'Task Name': t['Task Name'], 'Phase': t['Phase'],
          'Assignee': t['Default Assignee'] || '', 'Priority': t['Priority'] || '',
          'Status': 'pending', 'Created Date': now
        });
      });
      return { success: true };
    }

    case 'addSettingOption': {
      const { category, value } = payload;
      if (state.settings[category] && !state.settings[category].includes(value)) {
        state.settings[category].push(value);
      }
      return { success: true };
    }

    case 'deleteSettingOption': {
      const { category, value } = payload;
      if (state.settings[category]) {
        state.settings[category] = state.settings[category].filter(v => v !== value);
      }
      return { success: true };
    }

    default:
      throw new Error('Unknown demo action: ' + action);
  }
}

/* ────────────────────────────────────────────────────
   MODAL SYSTEM
──────────────────────────────────────────────────── */
let _activeModal = null;

function openModal(id) {
  document.getElementById('modalBackdrop').classList.remove('hidden');
  document.getElementById(id).classList.remove('hidden');
  _activeModal = id;
}

function closeModal() {
  if (_activeModal) document.getElementById(_activeModal)?.classList.add('hidden');
  document.getElementById('modalBackdrop').classList.add('hidden');
  _activeModal = null;
}

// Close on Escape
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

/* ────────────────────────────────────────────────────
   NAV & SECTION MANAGEMENT
──────────────────────────────────────────────────── */
function showSection(name, btn) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const sec = document.getElementById('sec-' + name);
  if (sec) sec.classList.add('active');
  if (btn) { btn.classList.add('active'); }
  else {
    const navBtn = document.querySelector(`[data-section="${name}"]`);
    if (navBtn) navBtn.classList.add('active');
  }
  const titles = { dashboard: 'Dashboard', warehouse: 'คลัง', tasks: 'งาน',
                   documents: 'เอกสาร', calendar: 'ปฏิทิน', reports: 'รายงาน', settings: 'ตั้งค่า' };
  document.getElementById('pageTitle').textContent = titles[name] || name;

  // On-show render
  if (name === 'dashboard') renderDashboard();
  if (name === 'warehouse') { closeProfile(); renderWarehouses(); }
  if (name === 'tasks')     renderTasks();
  if (name === 'documents') renderDocuments();
  if (name === 'calendar')  renderCalendar();
  if (name === 'reports')   renderReports();
  if (name === 'settings')  renderSettings();

  // Animate the section entrance
  if (sec) animateSection(sec);
  // Trigger count-ups on any [data-countup] that just rendered
  setTimeout(triggerCountUps, 50);

  // Mobile sidebar close
  document.getElementById('sidebar').classList.remove('mobile-open');
}

function toggleSidebar() {
  const s = document.getElementById('sidebar');
  if (window.innerWidth <= 768) {
    s.classList.toggle('mobile-open');
  } else {
    s.classList.toggle('collapsed');
  }
}

function filterAndGo(section, filter) {
  if (section === 'warehouse') {
    showSection('warehouse');
  } else if (section === 'tasks') {
    if (filter === 'todo') {
      document.getElementById('taskStatusFilter').value = 'To Do';
    } else if (filter === 'waiting') {
      document.getElementById('taskStatusFilter').value = 'รอเอกสาร';
    } else if (filter === 'closed') {
      document.getElementById('taskStatusFilter').value = 'ปิดแล้ว';
    } else {
      document.getElementById('taskStatusFilter').value = '';
    }
    showSection('tasks');
  }
}

function refreshData() {
  if (CONFIG.apiUrl) {
    loadAllData();
  } else {
    renderAll();
    toast('รีเฟรชข้อมูลแล้ว ✓', 'success');
  }
}

/* ────────────────────────────────────────────────────
   RENDER ALL
──────────────────────────────────────────────────── */
function renderAll() {
  renderNavBadges();
  renderDashboard();
  renderWarehouses();
  renderTasks();
  renderDocuments();
  renderCalendar();
  renderReports();
  renderSettings();
  populateAllSelects();
}

/* ────────────────────────────────────────────────────
   NAV BADGES
──────────────────────────────────────────────────── */
function renderNavBadges() {
  const today = todayISO();

  // Tasks overdue / due today
  const urgentTasks = state.tasks.filter(t => {
    if (isClosed(t)) return false;
    const due = fmtDate(t['Due Date']);
    return due && due <= today;
  });
  setBadge('badgeTasks', urgentTasks.length);

  // Warehouses with active tasks
  const activeWH = new Set(state.tasks.filter(t => !isClosed(t)).map(t => t['Warehouse ID']));
  setBadge('badgeWarehouse', activeWH.size);

  // Calendar events today/overdue
  const calUrgent = state.calendar.filter(e => {
    if (isCalClosed(e)) return false;
    const due = fmtDate(e['Due Date']);
    return due && due <= today;
  });
  setBadge('badgeCalendar', calUrgent.length);
}

function setBadge(id, count) {
  const el = document.getElementById(id);
  if (!el) return;
  if (count > 0) {
    el.textContent = count;
    el.classList.remove('hidden');
  } else {
    el.classList.add('hidden');
  }
}

/* ────────────────────────────────────────────────────
   DASHBOARD
──────────────────────────────────────────────────── */
function renderDashboard() {
  renderDashHero();
  const today = todayISO();
  const whFilter = document.getElementById('dashWhFilter')?.value || '';
  const taskFilter = document.getElementById('dashTaskFilter')?.value || '';

  let tasks = state.tasks;
  if (whFilter) tasks = tasks.filter(t => t['Warehouse ID'] === whFilter);

  // KPIs — animated count-up
  const kpiData = {
    kpiWH:      state.warehouses.length,
    kpiTasks:   state.tasks.length,
    kpiTodo:    state.tasks.filter(t => ['To Do','Backlog'].includes(t['Status'])).length,
    kpiWaiting: state.tasks.filter(t => t['Status']?.includes('รอ')).length,
    kpiClosed:  state.tasks.filter(t => isClosed(t)).length,
  };
  Object.entries(kpiData).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) animateCountUp(el, val, 700);
  });

  // Apply task filter for grids
  let filtered = tasks;
  if (taskFilter === 'todo')    filtered = filtered.filter(t => ['To Do','Backlog'].includes(t['Status']));
  if (taskFilter === 'waiting') filtered = filtered.filter(t => t['Status']?.includes('รอ'));
  if (taskFilter === 'active')  filtered = filtered.filter(t => t['Status'] === 'กำลังดำเนินการ');

  // Today's tasks
  const todayTasks = filtered.filter(t => {
    if (isClosed(t)) return false;
    const due = fmtDate(t['Due Date']);
    return due === today;
  });
  const todayEl = document.getElementById('todayTaskGrid');
  if (todayTasks.length === 0) {
    todayEl.innerHTML = '<div class="empty-state-sm">ไม่มีงานวันนี้ 🎉</div>';
  } else {
    todayEl.innerHTML = todayTasks.map(t => taskMiniCard(t, 'today')).join('');
  }

  // Follow-up (overdue, not closed)
  const followUp = filtered.filter(t => {
    if (isClosed(t)) return false;
    const due = fmtDate(t['Due Date']);
    return due && due < today;
  });
  document.getElementById('followUpCount').textContent = followUp.length;
  const fuEl = document.getElementById('followUpGrid');
  if (followUp.length === 0) {
    fuEl.innerHTML = '<div class="empty-state-sm">ไม่มีงานที่ต้องตาม ✓</div>';
  } else {
    fuEl.innerHTML = followUp.map(t => taskMiniCard(t, 'overdue')).join('');
  }

  // Upcoming calendar events (next 7 days)
  const soon = today;
  const week = addDays(today, 7);
  const upcomingCal = state.calendar.filter(e => {
    if (isCalClosed(e)) return false;
    const due = fmtDate(e['Due Date']);
    return due >= soon && due <= week;
  }).sort((a,b) => fmtDate(a['Due Date']).localeCompare(fmtDate(b['Due Date'])));
  const ucEl = document.getElementById('upcomingEvents');
  if (upcomingCal.length === 0) {
    ucEl.innerHTML = '<div class="empty-state-sm">ไม่มีกิจกรรมที่กำลังจะมาถึง</div>';
  } else {
    ucEl.innerHTML = upcomingCal.map(e => calMiniCard(e)).join('');
  }
}

function taskMiniCard(t, cls) {
  const wn = whName(t['Warehouse ID']);
  const due = fmtDate(t['Due Date']);
  return `<div class="today-card ${cls}" onclick="openEditTask('${esc(t['Task ID'])}')">
    <div class="today-card-title">${esc(t['Task Name'])}</div>
    <div class="today-card-meta">
      ${statusPillHtml(t['Status'])}
      <span class="task-meta-chip">🏢 ${esc(wn)}</span>
      ${due ? `<span class="task-meta-chip">📅 ${displayDate(due)}</span>` : ''}
    </div>
  </div>`;
}

function calMiniCard(e) {
  const due = fmtDate(e['Due Date']);
  return `<div class="today-card" onclick="openEditCalendarEvent('${esc(e['Event ID'])}')">
    <div class="today-card-title">${esc(e['Event Title'])}</div>
    <div class="today-card-meta">
      <span class="task-meta-chip">🗓️ ${displayDate(due)}</span>
      ${e['Start Time'] ? `<span class="task-meta-chip">⏰ ${e['Start Time']}</span>` : ''}
      <span class="task-meta-chip">🏢 ${esc(whName(e['Warehouse ID']))}</span>
    </div>
  </div>`;
}

function addDays(iso, n) {
  const d = new Date(iso);
  d.setDate(d.getDate() + n);
  return fmtDate(d.toISOString());
}

/* ────────────────────────────────────────────────────
   WAREHOUSES
──────────────────────────────────────────────────── */
function renderWarehouses() {
  const statusFilter = document.getElementById('whStatusFilter')?.value || '';
  const search = (document.getElementById('whSearch')?.value || '').toLowerCase();

  let list = state.warehouses;
  if (statusFilter) list = list.filter(w => w['Warehouse Status'] === statusFilter);
  if (search) list = list.filter(w => (w['Warehouse Name']||'').toLowerCase().includes(search) ||
                                       (w['Location / Zone']||'').toLowerCase().includes(search));

  const el = document.getElementById('whGrid');
  if (!el) return;
  if (list.length === 0) {
    el.innerHTML = '<div class="empty-state">ยังไม่มีข้อมูลคลัง<br>กด <strong>+ เพิ่มคลัง</strong> เพื่อเริ่มต้น</div>';
    return;
  }
  el.innerHTML = list.map((w, i) => whCard(w, i)).join('');
}

function whCard(w, idx) {
  const wid = w['Warehouse ID'];
  // ถ้าไม่มี Warehouse ID ใช้ index ชั่วคราวเพื่อให้ระบุ warehouse ที่ถูกต้องได้
  const cardKey = wid || ('_idx_' + idx);
  const tasks = state.tasks.filter(t => t['Warehouse ID'] === wid);
  const openTasks = tasks.filter(t => !isClosed(t)).length;
  const closedTasks = tasks.filter(t => isClosed(t)).length;
  return `<div class="wh-card" onclick="openProfile('${esc(cardKey)}')">
    <div class="wh-card-top">
      <div>
        <div class="wh-card-name">${esc(w['Warehouse Name'])}</div>
        <div class="wh-card-zone">📍 ${esc(w['Location / Zone'] || '—')}</div>
      </div>
      ${whBadgeHtml(w['Warehouse Status'])}
    </div>
    <div class="wh-card-body">
      <div class="wh-card-meta">
        ${w['Owner'] ? `<div class="wh-card-meta-item">👤 ${esc(w['Owner'])}</div>` : ''}
        ${w['Target Handover Date'] ? `<div class="wh-card-meta-item">📅 ${displayDate(fmtDate(w['Target Handover Date']))}</div>` : ''}
      </div>
    </div>
    <div class="wh-card-footer">
      <div class="wh-card-stats">
        <div class="wh-stat"><span class="status-dot todo"></span><span class="wh-stat-num">${openTasks}</span> งานเปิด</div>
        <div class="wh-stat"><span class="status-dot closed"></span><span class="wh-stat-num">${closedTasks}</span> ปิดแล้ว</div>
      </div>
      <button class="btn-sm btn-outline" onclick="event.stopPropagation();openEditWarehouseByKey('${esc(cardKey)}')">✏️</button>
    </div>
  </div>`;
}

/* ── Warehouse Profile ── */
let _currentProfileWhId = null;

function resolveWarehouse(key) {
  if (!key) return null;
  if (key.startsWith('_idx_')) {
    return state.warehouses[parseInt(key.replace('_idx_', ''), 10)] || null;
  }
  return state.warehouses.find(x => x['Warehouse ID'] === key) || null;
}

function openProfile(whId) {
  _currentProfileWhId = whId;
  const w = resolveWarehouse(whId);
  if (!w) return;

  document.getElementById('whListView').classList.add('hidden');
  document.getElementById('whProfileView').classList.remove('hidden');

  document.getElementById('profileWhName').textContent = w['Warehouse Name'] || '—';
  document.getElementById('profileWhSub').textContent = `${w['Location / Zone'] || '—'}`;
  document.getElementById('profileWhStatus').className = `wh-status-badge ${whStatusBadgeClass(w['Warehouse Status'])}`;
  document.getElementById('profileWhStatus').textContent = w['Warehouse Status'] || '—';

  document.getElementById('profileMetaRow').innerHTML = [
    w['Owner']               ? `<div class="profile-meta-item">👤 <strong>${esc(w['Owner'])}</strong></div>` : '',
    w['Owner Phone']         ? `<div class="profile-meta-item">📞 <strong>${esc(w['Owner Phone'])}</strong></div>` : '',
    w['Start Date']          ? `<div class="profile-meta-item">🗓️ เริ่ม <strong>${displayDate(fmtDate(w['Start Date']))}</strong></div>` : '',
    w['Target Handover Date']? `<div class="profile-meta-item">🎯 ส่งมอบ <strong>${displayDate(fmtDate(w['Target Handover Date']))}</strong></div>` : '',
    w['Document Folder Link']? `<div class="profile-meta-item"><a href="${esc(w['Document Folder Link'])}" target="_blank" class="btn-sm btn-ghost">📁 เอกสาร</a></div>` : '',
  ].join('');

  // Populate profile filters
  populateSelect('profileTaskStatusFilter', state.settings['Task Status'], '', 'สถานะทั้งหมด');
  populateSelect('profileDocTypeFilter', state.settings['Document Type'], '', 'ประเภทเอกสารทั้งหมด');
  populateSelect('profileIssueStatusFilter', state.settings['Task Status'], '', 'สถานะทั้งหมด');

  // Switch to tasks tab
  switchProfileTab('ptab-tasks', document.querySelector('.ptab[data-tab="ptab-tasks"]'));
  renderProfileTasks();
}

function closeProfile() {
  _currentProfileWhId = null;
  document.getElementById('whListView').classList.remove('hidden');
  document.getElementById('whProfileView').classList.add('hidden');
  renderWarehouses();
}

function switchProfileTab(tabId, btn) {
  document.querySelectorAll('.ptab-content').forEach(t => t.classList.add('hidden'));
  document.querySelectorAll('.ptab').forEach(t => t.classList.remove('active'));
  document.getElementById(tabId)?.classList.remove('hidden');
  document.getElementById(tabId)?.classList.add('active');
  if (btn) btn.classList.add('active');

  if (tabId === 'ptab-tasks')     renderProfileTasks();
  if (tabId === 'ptab-docs')      renderProfileDocs();
  if (tabId === 'ptab-schedule')  renderProfileSchedule();
  if (tabId === 'ptab-issues')    renderProfileIssues();
  if (tabId === 'ptab-checklist') renderProfileChecklist();
}

function renderProfileTasks() {
  const wid = _currentProfileWhId;
  if (!wid) return;
  const sf = document.getElementById('profileTaskStatusFilter')?.value || '';
  let list = state.tasks.filter(t => t['Warehouse ID'] === wid);
  if (sf) list = list.filter(t => t['Status'] === sf);
  const el = document.getElementById('profileTaskList');
  el.innerHTML = list.length === 0 ? '<div class="empty-state-sm">ยังไม่มีงาน</div>' : list.map(t => taskCardHtml(t)).join('');
}

function renderProfileDocs() {
  const wid = _currentProfileWhId;
  if (!wid) return;
  const tf = document.getElementById('profileDocTypeFilter')?.value || '';
  let list = state.documents.filter(d => d['Warehouse ID'] === wid);
  if (tf) list = list.filter(d => d['Document Type'] === tf);
  const el = document.getElementById('profileDocList');
  el.innerHTML = list.length === 0 ? '<div class="empty-state-sm">ยังไม่มีเอกสาร</div>' : list.map(d => docCardHtml(d)).join('');
}

function renderProfileSchedule() {
  const wid = _currentProfileWhId;
  if (!wid) return;
  const list = state.calendar.filter(e => e['Warehouse ID'] === wid && !isCalClosed(e))
    .sort((a,b) => fmtDate(a['Due Date']).localeCompare(fmtDate(b['Due Date'])));
  const el = document.getElementById('profileScheduleList');
  el.innerHTML = list.length === 0 ? '<div class="empty-state-sm">ยังไม่มีกิจกรรม</div>' : list.map(e => scheduleItemHtml(e)).join('');
}

function renderProfileIssues() {
  const wid = _currentProfileWhId;
  if (!wid) return;
  const sf = document.getElementById('profileIssueStatusFilter')?.value || '';
  let list = state.issues.filter(i => i['Warehouse ID'] === wid);
  if (sf) list = list.filter(i => i['Status'] === sf);
  const el = document.getElementById('profileIssueList');
  el.innerHTML = list.length === 0 ? '<div class="empty-state-sm">ยังไม่มี Issues</div>' : list.map(i => issueCardHtml(i)).join('');
}

function renderProfileChecklist() {
  const wid = _currentProfileWhId;
  if (!wid) return;
  const list = state.checklist.filter(c => c['Warehouse ID'] === wid);
  const el = document.getElementById('profileChecklistList');
  el.innerHTML = list.length === 0
    ? '<div class="empty-state-sm">ยังไม่มีรายการ checklist</div>'
    : list.map(c => checklistItemHtml(c)).join('');
}

function scheduleItemHtml(e) {
  const due = fmtDate(e['Due Date']);
  return `<div class="schedule-item">
    <div class="schedule-item-time">${e['Start Time']||'—'}</div>
    <div class="schedule-item-body">
      <div class="schedule-item-title">${esc(e['Event Title'])}</div>
      <div class="schedule-item-meta">📅 ${displayDate(due)} · ${esc(e['Event Type']||'—')} · ${esc(e['Assignee']||'—')}</div>
    </div>
    <button class="task-action-btn" onclick="openEditCalendarEvent('${esc(e['Event ID'])}')">✏️</button>
    <button class="task-action-btn danger" onclick="confirmDelete('Calendar','${esc(e['Event ID'])}','ลบกิจกรรม: ${esc(e['Event Title'])}')">🗑️</button>
  </div>`;
}

function issueCardHtml(i) {
  const cls = isClosed(i) ? 'closed' : (i['Status'] === 'กำลังดำเนินการ' ? 'in-progress' : 'open');
  return `<div class="issue-card ${cls}">
    ${statusDotHtml(i['Status'])}
    <div class="task-card-body">
      <div class="task-card-name">${esc(i['Issue Title'])}</div>
      <div class="task-card-meta">
        ${priorityPillHtml(i['Priority'])}
        ${i['Impact'] ? `<span class="task-meta-chip">⚡ ${esc(i['Impact'])}</span>` : ''}
        ${i['Due Date'] ? `<span class="task-meta-chip">📅 ${displayDate(fmtDate(i['Due Date']))}</span>` : ''}
      </div>
    </div>
    <div class="task-card-actions">
      <button class="task-action-btn danger" onclick="confirmDelete('Issues','${esc(i['Issue ID'])}','ลบ issue: ${esc(i['Issue Title'])}')">🗑️</button>
    </div>
  </div>`;
}

function checklistItemHtml(c) {
  const checked = c['Status'] === 'done';
  return `<div class="checklist-item ${checked ? 'checked' : ''}">
    <input type="checkbox" ${checked ? 'checked' : ''} onchange="toggleChecklistItem('${esc(c['Item ID'])}', this)" />
    <span class="checklist-item-label">${esc(c['Task Name'])}</span>
    <span class="task-meta-chip" style="font-size:.72rem">${esc(c['Phase']||'—')}</span>
    <button class="task-action-btn danger" onclick="confirmDelete('Checklist','${esc(c['Item ID'])}','')">🗑️</button>
  </div>`;
}

async function toggleChecklistItem(itemId, cb) {
  const status = cb.checked ? 'done' : 'pending';
  await api('updateChecklistItem', { 'Item ID': itemId, Status: status });
  const item = state.checklist.find(c => c['Item ID'] === itemId);
  if (item) item['Status'] = status;
  renderProfileChecklist();
}

/* ────────────────────────────────────────────────────
   TASKS
──────────────────────────────────────────────────── */
function renderTasks() {
  const whF = document.getElementById('taskWhFilter')?.value || '';
  const stF = document.getElementById('taskStatusFilter')?.value || '';
  const prF = document.getElementById('taskPriorityFilter')?.value || '';
  const srch = (document.getElementById('taskSearch')?.value || '').toLowerCase();

  let list = state.tasks;
  if (whF) list = list.filter(t => t['Warehouse ID'] === whF);
  if (stF) list = list.filter(t => t['Status'] === stF);
  if (prF) list = list.filter(t => t['Priority'] === prF);
  if (srch) list = list.filter(t => (t['Task Name']||'').toLowerCase().includes(srch));

  const el = document.getElementById('taskList');
  if (!el) return;
  el.innerHTML = list.length === 0 ? '<div class="empty-state">ไม่พบงาน</div>' : list.map(t => taskCardHtml(t)).join('');
}

function taskCardHtml(t) {
  const tid = t['Task ID'];
  const due = fmtDate(t['Due Date']);
  const overdue = due && due < todayISO() && !isClosed(t);
  return `<div class="task-card ${isClosed(t) ? 'closed' : ''}">
    <div class="task-card-left">
      ${statusDotHtml(t['Status'])}
    </div>
    <div class="task-card-body">
      <div class="task-card-name">${esc(t['Task Name'])}</div>
      <div class="task-card-meta">
        ${statusPillHtml(t['Status'])}
        ${priorityPillHtml(t['Priority'])}
        <span class="task-meta-chip">🏢 ${esc(whName(t['Warehouse ID']))}</span>
        ${t['Phase'] ? `<span class="task-meta-chip">${esc(t['Phase'])}</span>` : ''}
        ${due ? `<span class="task-meta-chip ${overdue ? 'text-red' : ''}">📅 ${displayDate(due)}</span>` : ''}
        ${t['Assignee'] ? `<span class="task-meta-chip">👤 ${esc(t['Assignee'])}</span>` : ''}
      </div>
    </div>
    <div class="task-card-actions">
      <button class="task-action-btn" onclick="openQuickStatus('${esc(tid)}')" title="เปลี่ยนสถานะ">🔄</button>
      <button class="task-action-btn" onclick="openEditTask('${esc(tid)}')" title="แก้ไข">✏️</button>
      <button class="task-action-btn danger" onclick="confirmDelete('Tasks','${esc(tid)}','ลบงาน: ${esc(t['Task Name'])}')" title="ลบ">🗑️</button>
    </div>
  </div>`;
}

/* ────────────────────────────────────────────────────
   DOCUMENTS
──────────────────────────────────────────────────── */
let _docFilterMode = 'wh'; // 'wh' or 'type'

function switchDocFilter(mode, btn) {
  _docFilterMode = mode;
  document.querySelectorAll('.ftoggle').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  populateDocFilterSelect();
  renderDocuments();
}

function populateDocFilterSelect() {
  const sel = document.getElementById('docFilterSelect');
  if (!sel) return;
  if (_docFilterMode === 'wh') {
    sel.innerHTML = '<option value="">คลังทั้งหมด</option>' +
      state.warehouses.map(w => `<option value="${esc(w['Warehouse ID'])}">${esc(w['Warehouse Name'])}</option>`).join('');
  } else {
    const types = state.settings['Document Type'] || [];
    sel.innerHTML = '<option value="">ประเภทเอกสารทั้งหมด</option>' +
      types.map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join('');
  }
}

function renderDocuments() {
  const filterVal = document.getElementById('docFilterSelect')?.value || '';
  const statusFilter = document.getElementById('docStatusFilter')?.value || '';

  let list = state.documents;
  if (filterVal) {
    if (_docFilterMode === 'wh') list = list.filter(d => d['Warehouse ID'] === filterVal);
    else list = list.filter(d => d['Document Type'] === filterVal);
  }
  if (statusFilter) list = list.filter(d => d['Document Status'] === statusFilter);

  const el = document.getElementById('docList');
  if (!el) return;
  el.innerHTML = list.length === 0 ? '<div class="empty-state">ยังไม่มีเอกสาร</div>' : list.map(d => docCardHtml(d)).join('');
}

function docCardHtml(d) {
  const did = d['Document ID'];
  return `<div class="doc-card">
    <div class="doc-icon">📄</div>
    <div class="doc-body">
      <div class="doc-name">${esc(d['Document Name'])}</div>
      <div class="doc-meta">
        <span class="task-meta-chip">${esc(d['Document Type']||'—')}</span>
        <span class="task-meta-chip">🏢 ${esc(whName(d['Warehouse ID']))}</span>
        ${d['Document Status'] ? `<span class="task-meta-chip">${esc(d['Document Status'])}</span>` : ''}
        ${d['Uploaded Date'] ? `<span class="task-meta-chip">📅 ${esc(d['Uploaded Date'])}</span>` : ''}
      </div>
    </div>
    <div class="doc-actions">
      ${d['File Link'] ? `<a href="${esc(d['File Link'])}" target="_blank" class="task-action-btn">🔗</a>` : ''}
      <button class="task-action-btn danger" onclick="confirmDelete('Documents','${esc(did)}','ลบเอกสาร: ${esc(d['Document Name'])}')">🗑️</button>
    </div>
  </div>`;
}

/* ────────────────────────────────────────────────────
   CALENDAR
──────────────────────────────────────────────────── */
let _calYear  = new Date().getFullYear();
let _calMonth = new Date().getMonth(); // 0-based
let _selectedDay = null;

function renderCalendar() {
  const year = _calYear, month = _calMonth;
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const today = todayISO();

  const monthNames = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
                      'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  document.getElementById('calMonthLabel').textContent = `${monthNames[month]} ${year + 543}`;

  const grid = document.getElementById('calGrid');
  let html = '';

  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) {
    html += '<div class="cal-cell other-month"></div>';
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isToday = iso === today;
    const isSel = iso === _selectedDay;

    // Count events/tasks
    const dayTasks = state.tasks.filter(t => !isClosed(t) && fmtDate(t['Due Date']) === iso);
    const dayEvents = state.calendar.filter(e => !isCalClosed(e) && (fmtDate(e['Due Date']) === iso || fmtDate(e['Start Date']) === iso));
    const hasOverdue = dayTasks.some(t => iso < today);

    let dots = '';
    if (dayTasks.length)  dots += `<div class="cal-dot task"></div>`;
    if (dayEvents.length) dots += `<div class="cal-dot event"></div>`;
    if (hasOverdue)       dots += `<div class="cal-dot overdue"></div>`;

    html += `<div class="cal-cell ${isToday?'today':''} ${isSel?'selected':''}" onclick="selectDay('${iso}')">
      <div class="cal-date-num">${d}</div>
      <div class="cal-dots">${dots}</div>
    </div>`;
  }

  grid.innerHTML = html;
}

function calNav(dir) {
  _calMonth += dir;
  if (_calMonth < 0)  { _calMonth = 11; _calYear--; }
  if (_calMonth > 11) { _calMonth = 0;  _calYear++; }
  renderCalendar();
}

function calGoToday() {
  const now = new Date();
  _calYear = now.getFullYear();
  _calMonth = now.getMonth();
  _selectedDay = todayISO();
  renderCalendar();
  renderSelectedDay();
}

function selectDay(iso) {
  _selectedDay = iso;
  renderCalendar(); // re-render to show selected
  renderSelectedDay();
}

function renderSelectedDay() {
  if (!_selectedDay) return;
  const [y,m,d] = _selectedDay.split('-');
  const thMonths = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  document.getElementById('selectedDayTitle').textContent = `${parseInt(d)} ${thMonths[parseInt(m)-1]} ${parseInt(y)+543}`;
  document.getElementById('addFromCalBtn').style.display = 'inline-flex';

  // Tasks
  const tasks = state.tasks.filter(t => !isClosed(t) && fmtDate(t['Due Date']) === _selectedDay);
  const tasksEl = document.getElementById('dayTasks');
  tasksEl.innerHTML = tasks.length === 0 ? '<div class="day-empty">ไม่มีงาน</div>' :
    tasks.map(t => `<div class="day-item" onclick="openQuickStatus('${esc(t['Task ID'])}')">
      <div class="day-item-title">${statusDotHtml(t['Status'])} ${esc(t['Task Name'])}</div>
      <div class="day-item-meta">
        ${statusPillHtml(t['Status'])}
        <span class="task-meta-chip">🏢 ${esc(whName(t['Warehouse ID']))}</span>
      </div>
    </div>`).join('');

  // Events (time-sorted)
  const events = state.calendar
    .filter(e => !isCalClosed(e) && (fmtDate(e['Due Date']) === _selectedDay || fmtDate(e['Start Date']) === _selectedDay))
    .sort((a,b) => (a['Start Time']||'99:99').localeCompare(b['Start Time']||'99:99'));
  const eventsEl = document.getElementById('dayEvents');
  eventsEl.innerHTML = events.length === 0 ? '<div class="day-empty">ไม่มีกิจกรรม</div>' :
    events.map(e => `<div class="day-item has-time" onclick="openEditCalendarEvent('${esc(e['Event ID'])}')">
      <div class="day-item-time">${e['Start Time'] ? e['Start Time'] + (e['End Time'] ? ' – ' + e['End Time'] : '') : 'ไม่ระบุเวลา'}</div>
      <div class="day-item-title">${esc(e['Event Title'])}</div>
      <div class="day-item-meta">
        <span class="task-meta-chip">${esc(e['Event Type']||'—')}</span>
        <span class="task-meta-chip">🏢 ${esc(whName(e['Warehouse ID']))}</span>
      </div>
    </div>`).join('');
}

function quickAddFromCalendar() {
  if (!_selectedDay) return;
  document.getElementById('calStartDateNew').value = _selectedDay;
  document.getElementById('calDueDateNew').value = _selectedDay;
  openModal('addCalEventModal');
}

/* ────────────────────────────────────────────────────
   REPORTS
──────────────────────────────────────────────────── */
let _reportRange = 'today';

function setDateRange(range, btn) {
  _reportRange = range;
  document.querySelectorAll('.drange-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const customEl = document.getElementById('customRangeInputs');
  if (range === 'custom') customEl.classList.remove('hidden');
  else customEl.classList.add('hidden');
  renderReports();
}

function getReportDates() {
  const today = todayISO();
  if (_reportRange === 'today') return { start: today, end: today };
  if (_reportRange === '7')  return { start: addDays(today, -7),  end: today };
  if (_reportRange === '30') return { start: addDays(today, -30), end: today };
  if (_reportRange === 'custom') {
    const s = document.getElementById('reportStartDate')?.value || today;
    const e = document.getElementById('reportEndDate')?.value   || today;
    return { start: s, end: e };
  }
  return { start: today, end: today };
}

function renderReports() {
  const { start, end } = getReportDates();
  const whF = document.getElementById('reportWhFilter')?.value || '';

  let tasks = state.tasks.filter(t => {
    const cr = fmtDate(t['Created Date']);
    return cr >= start && cr <= end;
  });
  let closedTasks = state.tasks.filter(t => {
    const cl = fmtDate(t['Closed Date']);
    return cl >= start && cl <= end && isClosed(t);
  });
  if (whF) {
    tasks = tasks.filter(t => t['Warehouse ID'] === whF);
    closedTasks = closedTasks.filter(t => t['Warehouse ID'] === whF);
  }

  const newTasks = tasks.length;
  const closedCount = closedTasks.length;
  const openCount = state.tasks.filter(t => !isClosed(t) && (!whF || t['Warehouse ID'] === whF)).length;

  // KPI cards
  const kpiEl = document.getElementById('reportKpiGrid');
  kpiEl.innerHTML = [
    { label: 'งานใหม่ (ในช่วง)', val: newTasks },
    { label: 'ปิดงาน (ในช่วง)', val: closedCount },
    { label: 'งานค้าง', val: openCount },
    { label: 'คลังทั้งหมด', val: state.warehouses.length },
  ].map(k => `<div class="report-kpi-card"><div class="report-kpi-val">${k.val}</div><div class="report-kpi-label">${k.label}</div></div>`).join('');

  // Warehouse breakdown
  const whsToShow = whF ? state.warehouses.filter(w => w['Warehouse ID'] === whF) : state.warehouses;
  let content = '';
  whsToShow.forEach(w => {
    const wid = w['Warehouse ID'];
    const wTasks = state.tasks.filter(t => t['Warehouse ID'] === wid);
    const wOpen = wTasks.filter(t => !isClosed(t)).length;
    const wClosed = wTasks.filter(t => isClosed(t)).length;
    content += `<div class="report-section">
      <div class="report-section-title">🏢 ${esc(w['Warehouse Name'])} — ${whBadgeHtml(w['Warehouse Status'])}</div>
      <div class="report-section-body">
        <div style="display:flex;gap:16px;flex-wrap:wrap;">
          <span><strong>${wTasks.length}</strong> งานทั้งหมด</span>
          <span><strong style="color:#3b82f6">${wOpen}</strong> เปิดอยู่</span>
          <span><strong style="color:#22c55e">${wClosed}</strong> ปิดแล้ว</span>
        </div>
      </div>
    </div>`;
  });
  document.getElementById('reportContent').innerHTML = content || '<div class="empty-state">ไม่มีข้อมูลในช่วงที่เลือก</div>';

  // Copyable text
  generateReportText(start, end, whF);
}

function generateReportText(start, end, whF) {
  const { start: s, end: e } = { start, end };
  const lines = [
    `📊 รายงานสรุป Warehouse Manager`,
    `📅 ช่วงเวลา: ${displayDate(s)} – ${displayDate(e)}`,
    `🕐 สร้างเมื่อ: ${new Date().toLocaleString('th-TH')}`,
    '',
  ];
  const whs = whF ? state.warehouses.filter(w => w['Warehouse ID'] === whF) : state.warehouses;
  whs.forEach(w => {
    const wTasks = state.tasks.filter(t => t['Warehouse ID'] === w['Warehouse ID']);
    lines.push(`🏢 ${w['Warehouse Name']} [${w['Warehouse Status']}]`);
    lines.push(`   งานทั้งหมด: ${wTasks.length} | เปิด: ${wTasks.filter(t=>!isClosed(t)).length} | ปิด: ${wTasks.filter(t=>isClosed(t)).length}`);
    wTasks.filter(t => !isClosed(t)).forEach(t => {
      lines.push(`   • [${t['Status']}] ${t['Task Name']} — ${displayDate(fmtDate(t['Due Date']))}`);
    });
    lines.push('');
  });
  document.getElementById('reportText').value = lines.join('\n');
}

function copyReport() {
  const ta = document.getElementById('reportText');
  ta.select();
  document.execCommand('copy');
  toast('คัดลอกรายงานแล้ว ✓', 'success');
}

/* ────────────────────────────────────────────────────
   SETTINGS
──────────────────────────────────────────────────── */
function renderSettings() {
  // Force-show the currently active stab, hide others (fix hidden class issue)
  document.querySelectorAll('.stab-content').forEach(t => {
    t.style.display = t.classList.contains('active') ? 'block' : 'none';
  });
  // If none active, activate API tab
  const hasActive = document.querySelector('.stab-content.active');
  if (!hasActive) {
    const first = document.getElementById('stab-api');
    if (first) { first.classList.add('active'); first.style.display = 'block'; }
    const firstBtn = document.querySelector('.stab[data-tab="stab-api"]');
    if (firstBtn) firstBtn.classList.add('active');
  }
  renderModeIndicator();
  document.getElementById('apiUrlInput').value = CONFIG.apiUrl || '';
  renderSheetCurrentDisplay();
  renderUserList();
  renderOptionsGrid();
  renderChecklistTemplates();
  renderActivityLog();
  renderTrashList();
  // Render stats banner
  renderSettingsStats();
}

function renderSettingsStats() {
  const el = document.getElementById('settingsStatsBanner');
  if (!el) return;
  el.innerHTML = `
    <div class="sstat-item">
      <div class="sstat-val">${state.warehouses.length}</div>
      <div class="sstat-label">คลัง</div>
    </div>
    <div class="sstat-divider"></div>
    <div class="sstat-item">
      <div class="sstat-val">${state.tasks.length}</div>
      <div class="sstat-label">งาน</div>
    </div>
    <div class="sstat-divider"></div>
    <div class="sstat-item">
      <div class="sstat-val">${getUsers().length}</div>
      <div class="sstat-label">ผู้ใช้</div>
    </div>
    <div class="sstat-divider"></div>
    <div class="sstat-item">
      <div class="sstat-val">${state.activity.length}</div>
      <div class="sstat-label">กิจกรรม</div>
    </div>
    <div class="sstat-divider"></div>
    <div class="sstat-item">
      <div class="sstat-val">${state.trash.length}</div>
      <div class="sstat-label">ในถังขยะ</div>
    </div>
  `;
}

function switchSettingsTab(tabId, btn) {
  document.querySelectorAll('.stab-content').forEach(t => {
    t.classList.remove('active');
    t.style.display = 'none';
  });
  document.querySelectorAll('.stab').forEach(t => t.classList.remove('active'));
  const target = document.getElementById(tabId);
  if (target) { target.classList.add('active'); target.style.display = 'block'; }
  if (btn) btn.classList.add('active');
  // Re-render content for the selected tab
  const renders = {
    'stab-api':       () => { renderModeIndicator(); document.getElementById('apiUrlInput').value = CONFIG.apiUrl || ''; renderSheetCurrentDisplay(); },
    'stab-users':     renderUserList,
    'stab-options':   renderOptionsGrid,
    'stab-checklist': renderChecklistTemplates,
    'stab-activity':  renderActivityLog,
    'stab-trash':     renderTrashList,
  };
  if (renders[tabId]) renders[tabId]();
}

function renderModeIndicator() {
  const el = document.getElementById('modeIndicator');
  if (!el) return;
  const dotEl   = el.querySelector('.mode-dot');
  const ringEl  = el.querySelector('.mode-dot-ring');
  const labelEl = el.querySelector('.mode-label');
  const subEl   = el.querySelector('.mode-sub');

  if (!CONFIG.apiUrl) {
    // Demo Mode — ไม่ต้อง ping
    el.classList.add('demo'); el.classList.remove('live','checking','error-mode');
    if (dotEl)   dotEl.style.background  = '#f59e0b';
    if (ringEl)  { ringEl.className = 'mode-dot-ring demo'; }
    if (labelEl) labelEl.textContent = 'Demo Mode';
    if (subEl)   subEl.textContent   = 'ข้อมูลในหน่วยความจำ — จะหายเมื่อปิดแท็บ';
    return;
  }

  // Live Mode — แสดง "กำลังตรวจสอบ..." แล้ว ping จริง
  el.classList.remove('demo','live','error-mode'); el.classList.add('checking');
  if (dotEl)   dotEl.style.background  = '#94a3b8';
  if (ringEl)  ringEl.className = 'mode-dot-ring';
  if (labelEl) labelEl.textContent = 'Live Mode — กำลังตรวจสอบ...';
  if (subEl)   subEl.textContent   = 'กำลัง ping Apps Script...';

  fetch(`${CONFIG.apiUrl}?action=ping&sheetId=${encodeURIComponent(CONFIG.sheetId)}`)
    .then(r => r.json())
    .then(json => {
      if (json.success) {
        el.classList.add('live'); el.classList.remove('checking','error-mode');
        if (dotEl)   dotEl.style.background = '#22c55e';
        if (ringEl)  ringEl.className = 'mode-dot-ring live';
        if (labelEl) labelEl.textContent = '✅ Live Mode — เชื่อมต่อสำเร็จ';
        if (subEl)   subEl.textContent   = 'บันทึกลง Google Sheets แบบ Real-time';
      } else {
        throw new Error(json.message || 'ไม่สำเร็จ');
      }
    })
    .catch(err => {
      el.classList.add('error-mode'); el.classList.remove('checking','live');
      if (dotEl)   dotEl.style.background = '#ef4444';
      if (ringEl)  ringEl.className = 'mode-dot-ring';
      if (labelEl) labelEl.textContent = '❌ เชื่อมต่อไม่ได้';
      if (subEl)   subEl.textContent   = 'ตรวจสอบ URL / Deploy / Access';
    });
}

function saveApiUrl() {
  const url = document.getElementById('apiUrlInput').value.trim();
  CONFIG.apiUrl = url;
  localStorage.setItem('wm_api_url', url);
  renderModeIndicator();
  toast(url ? 'บันทึก API URL แล้ว — เครื่องนี้จะจำการเชื่อมต่อไว้' : 'ล้าง URL แล้ว (Demo Mode)', 'success');
  if (url) loadAllData();
}

async function testApiConnection() {
  const url = document.getElementById('apiUrlInput').value.trim();
  if (!url) { toast('กรุณาใส่ URL ก่อนทดสอบ', 'error'); return; }
  const statusEl = document.getElementById('apiStatus');
  // แสดง element และ reset state
  statusEl.style.display = 'flex';
  statusEl.className = 'api-status-bar testing';
  statusEl.innerHTML = '<span class="api-status-spinner"></span> กำลังทดสอบการเชื่อมต่อ...';
  try {
    const res  = await fetch(`${url}?action=ping&sheetId=${encodeURIComponent(CONFIG.sheetId)}`);
    const json = await res.json();
    if (json.success) {
      // ทดสอบผ่านแล้วให้จำ URL อัตโนมัติ ไม่ต้องกดบันทึกซ้ำ
      CONFIG.apiUrl = url;
      localStorage.setItem('wm_api_url', url);
      statusEl.className = 'api-status-bar success';
      statusEl.innerHTML = '✅ เชื่อมต่อสำเร็จ — บันทึก URL แล้ว ออกจากเว็บกลับเข้ามาก็ยังจำได้';
      renderModeIndicator();
      loadAllData();
    } else {
      statusEl.className = 'api-status-bar error';
      statusEl.innerHTML = '❌ ผิดพลาด: ' + (json.message || 'ไม่ทราบสาเหตุ');
    }
  } catch(err) {
    statusEl.className = 'api-status-bar error';
    statusEl.innerHTML = '❌ ไม่สามารถเชื่อมต่อได้ — ' + err.message + '<br><small>ตรวจสอบ: URL ถูกต้อง / Deploy แล้ว / Who has access: Anyone</small>';
  }
}

function clearApiUrl() {
  document.getElementById('apiUrlInput').value = '';
  CONFIG.apiUrl = '';
  localStorage.removeItem('wm_api_url');
  renderModeIndicator();
  toast('ล้าง URL แล้ว — อยู่ในโหมด Demo', 'warning');
}

/* ── Sheet ID management ── */
function extractSheetId(raw) {
  raw = raw.trim();
  // Full URL: extract the /d/SHEET_ID/ part
  const m = raw.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  // Plain ID (alphanumeric, dashes, underscores, 30+ chars)
  if (/^[a-zA-Z0-9_-]{20,}$/.test(raw)) return raw;
  return null;
}

function detectSheetId() {
  const raw   = (document.getElementById('sheetIdInput').value || '').trim();
  const id    = extractSheetId(raw);
  const prev  = document.getElementById('sheetIdPreview');
  if (!raw) { prev.innerHTML = ''; return; }
  if (id) {
    prev.innerHTML = `<div class="sheet-detect-ok">✅ ตรวจพบ ID: <code>${id}</code></div>`;
    document.getElementById('sheetIdInput').value = id;
  } else {
    prev.innerHTML = `<div class="sheet-detect-err">⚠️ ไม่พบ Sheet ID — กรุณาวาง URL หรือ ID ให้ถูกต้อง</div>`;
  }
}

function saveSheetId() {
  const raw = (document.getElementById('sheetIdInput').value || '').trim();
  const id  = extractSheetId(raw) || raw;
  if (!id) return toast('กรุณากรอก Sheet ID หรือ URL ก่อน', 'error');
  CONFIG.sheetId = id;
  localStorage.setItem('wm_sheet_id', id);
  renderSheetCurrentDisplay();
  toast(`บันทึก Sheet ID แล้ว ✓`, 'success');
  if (CONFIG.apiUrl) loadAllData();
}

function resetSheetId() {
  CONFIG.sheetId = DEFAULT_SHEET_ID;
  localStorage.removeItem('wm_sheet_id');
  document.getElementById('sheetIdInput').value = '';
  document.getElementById('sheetIdPreview').innerHTML = '';
  renderSheetCurrentDisplay();
  toast('รีเซ็ต Sheet ID เป็นค่าเริ่มต้นแล้ว', 'info');
}

function openCurrentSheet() {
  const id = CONFIG.sheetId;
  if (id) window.open(`https://docs.google.com/spreadsheets/d/${id}`, '_blank');
}

function renderSheetCurrentDisplay() {
  const el = document.getElementById('sheetCurrentDisplay');
  if (!el) return;
  const id   = CONFIG.sheetId;
  const isDefault = (id === DEFAULT_SHEET_ID);
  el.innerHTML = `
    <div class="sheet-current-inner">
      <div class="sheet-current-row">
        <span class="sheet-current-label">🔗 Sheet ที่ใช้งานอยู่${isDefault ? ' <span class="sheet-default-badge">ค่าเริ่มต้น</span>' : ' <span class="sheet-custom-badge">กำหนดเอง</span>'}</span>
      </div>
      <code class="sheet-current-id">${esc(id)}</code>
      <a href="https://docs.google.com/spreadsheets/d/${esc(id)}" target="_blank" class="sheet-open-link">เปิดใน Google Sheets ↗</a>
    </div>`;
  // enable open button
  const openBtn = document.getElementById('sheetOpenBtn');
  if (openBtn) openBtn.disabled = false;
  // pre-fill input
  const inp = document.getElementById('sheetIdInput');
  if (inp && !inp.value) inp.placeholder = id;
}

/* User management */
const ROLE_META = {
  admin:  { label: 'Admin',  color: '#dc2626', bg: '#fef2f2', icon: '👑' },
  user:   { label: 'User',   color: '#2563eb', bg: '#eff6ff', icon: '👤' },
  viewer: { label: 'Viewer', color: '#7c3aed', bg: '#f5f3ff', icon: '👁️' },
};
const AVATAR_COLORS = ['#ff6b2b','#3b82f6','#22c55e','#f59e0b','#a855f7','#ef4444','#14b8a6'];

function renderUserList() {
  const el = document.getElementById('userList');
  if (!el) return;
  const users = getUsers();
  const current = getCurrentUser();
  el.innerHTML = users.map((u, idx) => {
    const rm = ROLE_META[u.role] || ROLE_META.user;
    const avatarColor = AVATAR_COLORS[idx % AVATAR_COLORS.length];
    const isMe = u.username === current?.username;
    return `<div class="user-card ${isMe ? 'user-card-me' : ''}">
      <div class="user-card-avatar" style="background:${avatarColor}">
        ${(u.username[0]||'U').toUpperCase()}
        ${isMe ? '<div class="user-card-me-dot"></div>' : ''}
      </div>
      <div class="user-card-body">
        <div class="user-card-name">
          ${esc(u.username)}
          ${isMe ? '<span class="user-me-badge">ฉัน</span>' : ''}
        </div>
        <div class="user-card-role-row">
          <span class="user-role-badge" style="color:${rm.color};background:${rm.bg}">
            ${rm.icon} ${rm.label}
          </span>
          <span class="user-card-lastlogin">ID: ${esc(u.username.toLowerCase())}</span>
        </div>
      </div>
      <div class="user-card-actions">
        <button class="uact-btn uact-pw" onclick="openChangePassword('${esc(u.username)}')" title="เปลี่ยนรหัสผ่าน">🔑</button>
        <button class="uact-btn uact-role" onclick="cycleRole('${esc(u.username)}')" title="เปลี่ยน Role">${rm.icon}</button>
        ${u.username !== 'admin' ? `<button class="uact-btn uact-del" onclick="deleteUser('${esc(u.username)}')" title="ลบผู้ใช้">🗑️</button>` : '<button class="uact-btn" disabled title="ไม่สามารถลบ admin">🔒</button>'}
      </div>
    </div>`;
  }).join('') || '<div class="empty-state-sm">ยังไม่มีผู้ใช้</div>';
}

async function cycleRole(username) {
  const roles = ['user','admin','viewer'];
  const users = getUsers();
  const u = users.find(x => x.username === username);
  if (!u) return;
  const nextRole = roles[(roles.indexOf(u.role) + 1) % roles.length];
  u.role = nextRole;
  try {
    await saveUsers(users);
    renderUserList();
    toast(`เปลี่ยน role "${username}" เป็น ${nextRole} ✓`, 'success');
  } catch (err) {
    toast(err.message || String(err), 'error');
  }
}

function togglePwVis(inputId, btn) {
  const el = document.getElementById(inputId);
  if (!el) return;
  if (el.type === 'password') { el.type = 'text';     btn.textContent = '🙈'; }
  else                        { el.type = 'password'; btn.textContent = '👁️'; }
}

function openChangePassword(username) {
  const labelEl = document.getElementById('cpwTargetLabel');
  const userEl  = document.getElementById('cpwTargetUsername');
  const newEl   = document.getElementById('cpwNew');
  const confEl  = document.getElementById('cpwConfirm');
  const errEl   = document.getElementById('cpwError');
  const strEl   = document.getElementById('cpwStrength');
  if (labelEl) labelEl.textContent = `🔑 เปลี่ยนรหัสผ่านของ: ${username}`;
  if (userEl)  userEl.value = username;
  if (newEl)   { newEl.value = ''; newEl.type = 'password'; }
  if (confEl)  { confEl.value = ''; confEl.type = 'password'; }
  if (errEl)   { errEl.textContent = ''; errEl.classList.add('hidden'); }
  if (strEl)   strEl.innerHTML = '';
  // strength meter on new password
  if (newEl) newEl.oninput = () => {
    const v = newEl.value;
    let strength = 0;
    if (v.length >= 4) strength++;
    if (v.length >= 8) strength++;
    if (/[A-Z]/.test(v) || /[0-9]/.test(v)) strength++;
    if (/[^a-zA-Z0-9]/.test(v)) strength++;
    const colors = ['#ef4444','#f59e0b','#22c55e','#16a34a'];
    const widths  = ['25%','50%','75%','100%'];
    strEl.innerHTML = `<div class="cpw-strength-bar" style="width:${widths[strength-1]||'0%'};background:${colors[strength-1]||'transparent'}"></div>`;
  };
  openModal('changePasswordModal');
}

async function submitChangePassword(e) {
  e.preventDefault();
  const username = document.getElementById('cpwTargetUsername').value;
  const newPw    = document.getElementById('cpwNew').value;
  const confirm  = document.getElementById('cpwConfirm').value;
  const errEl    = document.getElementById('cpwError');
  const showErr  = msg => { if(errEl){ errEl.textContent = msg; errEl.classList.remove('hidden'); } };
  if (newPw.length < 4) return showErr('รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร');
  if (newPw !== confirm) return showErr('รหัสผ่านไม่ตรงกัน กรุณาตรวจสอบอีกครั้ง');
  const users = getUsers();
  const u = users.find(x => x.username === username);
  if (!u) return showErr('ไม่พบผู้ใช้');
  u.passwordHash = simpleHash(newPw);
  try {
    await saveUsers(users);
    closeModal();
    renderUserList();
    toast(`เปลี่ยนรหัสผ่านของ "${username}" แล้ว ✓`, 'success');
  } catch (err) {
    showErr(err.message || String(err));
  }
}

async function submitAddUser(e) {
  e.preventDefault();
  const username = document.getElementById('newUsername').value.trim();
  const password = document.getElementById('newUserPassword').value;
  const role     = document.getElementById('newUserRole').value;
  const errEl    = document.getElementById('addUserError');
  const showErr  = msg => { if(errEl){ errEl.textContent = msg; errEl.classList.remove('hidden'); } };
  if (!username) return showErr('กรุณากรอกชื่อผู้ใช้');
  if (!/^[a-zA-Z0-9_]+$/.test(username)) return showErr('ชื่อผู้ใช้ใช้ได้เฉพาะ A-Z, 0-9, _ เท่านั้น');
  if (password.length < 4) return showErr('รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร');
  const users = getUsers();
  if (users.find(u => u.username === username)) return showErr('ชื่อผู้ใช้นี้มีอยู่แล้ว');
  users.push({ username, passwordHash: simpleHash(password), role });
  try {
    await saveUsers(users);
    closeModal();
    renderUserList();
    toast(`เพิ่มผู้ใช้ "${username}" (${role}) แล้ว ✓`, 'success');
    // reset form fields manually
    ['newUsername','newUserPassword'].forEach(id => { const el = document.getElementById(id); if(el) el.value=''; });
    const roleEl = document.getElementById('newUserRole'); if(roleEl) roleEl.value = 'user';
  } catch (err) {
    showErr(err.message || String(err));
  }
}

async function deleteUser(username) {
  if (username === 'admin') return toast('ไม่สามารถลบ admin ได้', 'error');
  const users = getUsers().filter(u => u.username !== username);
  try {
    await saveUsers(users);
    renderUserList();
    toast(`ลบผู้ใช้ "${username}" แล้ว`, 'success');
  } catch (err) {
    toast(err.message || String(err), 'error');
  }
}

/* Options grid */
const CAT_META = {
  'Task Status':      { icon: '🔵', desc: 'สถานะของงาน' },
  'Priority':         { icon: '🔴', desc: 'ระดับความสำคัญ' },
  'Warehouse Status': { icon: '🏢', desc: 'สถานะของคลัง' },
  'Phase':            { icon: '📍', desc: 'ขั้นตอนการทำงาน' },
  'Document Type':    { icon: '📄', desc: 'ประเภทเอกสาร' },
  'Document Status':  { icon: '📋', desc: 'สถานะเอกสาร' },
  'Event Type':       { icon: '🗓️', desc: 'ประเภทกิจกรรม' },
  'Calendar Status':  { icon: '✅', desc: 'สถานะกิจกรรม' },
};

function renderOptionsGrid() {
  const el = document.getElementById('optionsGrid');
  if (!el) return;
  el.innerHTML = Object.entries(state.settings).map(([cat, vals]) => {
    const meta = CAT_META[cat] || { icon: '⚙️', desc: '' };
    const safeId = cat.replace(/[^a-zA-Z0-9]/g,'_');
    return `<div class="opt-card">
      <div class="opt-card-head">
        <span class="opt-card-icon">${meta.icon}</span>
        <div>
          <div class="opt-card-title">${esc(cat)}</div>
          <div class="opt-card-desc">${meta.desc}</div>
        </div>
        <span class="opt-card-count">${vals.length}</span>
      </div>
      <div class="opt-pills">
        ${vals.map(v => `<div class="opt-pill">
          <span class="opt-pill-dot ${statusDotClass(v)}"></span>
          <span class="opt-pill-text">${esc(v)}</span>
          <button class="opt-pill-del" onclick="removeOption('${esc(cat)}','${esc(v)}')" title="ลบ">✕</button>
        </div>`).join('')}
      </div>
      <div class="opt-add-row">
        <input type="text" class="field-input" id="optIn_${safeId}" placeholder="เพิ่มตัวเลือกใหม่..." onkeydown="if(event.key==='Enter'){addOption('${esc(cat)}','${safeId}')}" />
        <button class="btn-sm btn-primary" onclick="addOption('${esc(cat)}','${safeId}')">+ เพิ่ม</button>
      </div>
    </div>`;
  }).join('');
}

async function addOption(cat, safeId) {
  const id = safeId || cat.replace(/[^a-zA-Z0-9]/g,'_');
  const inp = document.getElementById(`optIn_${id}`);
  const val = inp?.value.trim();
  if (!val) return;
  await postAndRefresh('addSettingOption', { category: cat, value: val }, `เพิ่ม "${val}" ใน ${cat} แล้ว ✓`);
  populateAllSelects();
  renderOptionsGrid();
}

async function removeOption(cat, val) {
  await postAndRefresh('deleteSettingOption', { category: cat, value: val }, `ลบ "${val}" แล้ว`);
  populateAllSelects();
  renderOptionsGrid();
}

/* Checklist templates */
function renderChecklistTemplates() {
  const el = document.getElementById('checklistTemplateList');
  if (!el) return;
  if (state.checklistTemplates.length === 0) {
    el.innerHTML = `<div class="ct-empty">
      <div class="ct-empty-icon">📋</div>
      <div class="ct-empty-title">ยังไม่มี Template</div>
      <div class="ct-empty-sub">เพิ่ม Template เพื่อสร้าง Checklist ให้คลังได้เร็วขึ้น</div>
    </div>`;
    return;
  }
  // Group by phase
  const grouped = {};
  state.checklistTemplates.forEach(t => {
    const ph = t['Phase'] || 'อื่นๆ';
    if (!grouped[ph]) grouped[ph] = [];
    grouped[ph].push(t);
  });
  el.innerHTML = Object.entries(grouped).map(([phase, items]) => `
    <div class="ct-group">
      <div class="ct-group-header">
        <span class="ct-group-phase">${esc(phase)}</span>
        <span class="ct-group-count">${items.length} รายการ</span>
      </div>
      ${items.map(t => `<div class="ct-row">
        <div class="ct-row-icon">✅</div>
        <div class="ct-row-body">
          <div class="ct-row-name">${esc(t['Task Name'])}</div>
          <div class="ct-row-meta">
            ${t['Default Assignee'] ? `<span>👤 ${esc(t['Default Assignee'])}</span>` : ''}
            ${t['Default Due Offset Days'] ? `<span>📅 +${esc(t['Default Due Offset Days'])} วัน</span>` : ''}
            ${t['Document Required']==='TRUE'||t['Document Required']===true ? `<span class="ct-doc-req">📎 ต้องการเอกสาร</span>` : ''}
          </div>
        </div>
        <span class="priority-pill ${(t['Priority']||'').toLowerCase()}">${esc(t['Priority']||'—')}</span>
        <button class="task-action-btn danger" onclick="confirmDelete('ChecklistTemplates','${esc(t['Template ID'])}','ลบ Template: ${esc(t['Task Name'])}')">🗑️</button>
      </div>`).join('')}
    </div>`).join('');
}

const ACTION_META = {
  ADD:           { icon: '➕', color: '#22c55e', bg: '#f0fdf4' },
  UPDATE:        { icon: '✏️', color: '#3b82f6', bg: '#eff6ff' },
  UPDATE_STATUS: { icon: '🔄', color: '#f59e0b', bg: '#fffbeb' },
  DELETE:        { icon: '🗑️', color: '#ef4444', bg: '#fef2f2' },
};

function renderActivityLog() {
  const el = document.getElementById('activityLog');
  if (!el) return;
  const list = state.activity.slice(0, 100);
  if (list.length === 0) {
    el.innerHTML = `<div class="act-empty">
      <div style="font-size:2rem">📜</div>
      <div style="font-weight:600;margin-top:8px">ยังไม่มีกิจกรรม</div>
      <div style="font-size:.8rem;color:var(--text-3);margin-top:4px">การเพิ่ม/แก้ไข/ลบข้อมูลจะบันทึกที่นี่</div>
    </div>`;
    return;
  }
  el.innerHTML = list.map((a, idx) => {
    const am = ACTION_META[a['Action']] || { icon: '📌', color: '#6b7280', bg: '#f3f4f6' };
    return `<div class="act-item">
      <div class="act-item-icon" style="background:${am.bg};color:${am.color}">${am.icon}</div>
      <div class="act-item-body">
        <div class="act-item-title">
          <strong>${esc(a['Sheet']||'—')}</strong>
          ${a['Details'] ? ` — ${esc(a['Details'])}` : ''}
        </div>
        <div class="act-item-meta">
          <span>👤 ${esc(a['User']||'System')}</span>
          <span>🕐 ${esc(a['Timestamp']||'—')}</span>
          ${a['Warehouse ID'] ? `<span>🏢 ${esc(a['Warehouse ID'])}</span>` : ''}
        </div>
      </div>
      <span class="act-badge" style="background:${am.bg};color:${am.color}">${esc(a['Action']||'—')}</span>
    </div>`;
  }).join('');
}

function clearActivity() {
  state.activity = [];
  renderActivityLog();
  toast('ล้าง Activity Log แล้ว');
}

function renderTrashList() {
  const el = document.getElementById('trashList');
  if (!el) return;
  if (state.trash.length === 0) {
    el.innerHTML = `<div class="trash-empty">
      <div class="trash-empty-icon">🗑️</div>
      <div class="trash-empty-title">ถังขยะว่างเปล่า</div>
      <div class="trash-empty-sub">รายการที่ถูกลบจะปรากฏที่นี่ และสามารถกู้คืนได้</div>
    </div>`;
    return;
  }
  const sheetIcon = { Warehouses:'🏢', Tasks:'📋', Documents:'📎', Calendar:'🗓️', Issues:'⚠️' };
  el.innerHTML = state.trash.map(t => {
    let snap = {};
    try { snap = JSON.parse(t['Snapshot JSON']||'{}'); } catch{}
    const snapLabel = snap['Warehouse Name'] || snap['Task Name'] || snap['Event Title'] || snap['Issue Title'] || snap['Document Name'] || t['Record ID'];
    return `<div class="trash-card">
      <div class="trash-card-icon">${sheetIcon[t['Source Sheet']] || '📦'}</div>
      <div class="trash-card-body">
        <div class="trash-card-title">${esc(snapLabel)}</div>
        <div class="trash-card-meta">
          <span class="trash-sheet-badge">${esc(t['Source Sheet']||'—')}</span>
          <span>ลบโดย ${esc(t['Deleted By']||'—')}</span>
          <span>🕐 ${esc(t['Timestamp']||'—')}</span>
          ${t['Reason'] ? `<span>💬 ${esc(t['Reason'])}</span>` : ''}
        </div>
      </div>
      <button class="btn-sm btn-outline" onclick="restoreFromTrash('${esc(t['Trash ID'])}')">↩️ กู้คืน</button>
    </div>`;
  }).join('');
}

function emptyTrash() {
  state.trash = [];
  renderTrashList();
  toast('ล้างถังขยะแล้ว');
}

function restoreFromTrash(trashId) {
  const item = state.trash.find(t => t['Trash ID'] === trashId);
  if (!item) return;
  try {
    const rec = JSON.parse(item['Snapshot JSON']);
    const map = { Warehouses: 'warehouses', Tasks: 'tasks', Documents: 'documents', Calendar: 'calendar', Issues: 'issues' };
    if (map[item['Source Sheet']]) state[map[item['Source Sheet']]].push(rec);
    state.trash = state.trash.filter(t => t['Trash ID'] !== trashId);
    renderTrashList();
    renderAll();
    toast('กู้คืนรายการแล้ว ✓', 'success');
  } catch { toast('กู้คืนไม่สำเร็จ', 'error'); }
}

/* ────────────────────────────────────────────────────
   FORM SUBMISSIONS
──────────────────────────────────────────────────── */
async function submitWarehouse(e) {
  e.preventDefault();
  const btn = document.getElementById('addWhBtn');
  const data = dataFromForm(e.target);
  await withLoading(btn, async () => {
    await postAndRefresh('addWarehouse', data, 'เพิ่มคลังแล้ว ✓');
    closeModal();
    e.target.reset();
  });
}

async function submitEditWarehouse(e) {
  e.preventDefault();
  const btn = document.getElementById('editWhBtn');
  const data = dataFromForm(e.target);
  // ส่งทั้ง 2 รูปแบบ — ทำงานได้กับ Apps Script ทั้งเก่าและใหม่
  data.warehouseId = data['Warehouse ID'];
  await withLoading(btn, async () => {
    await postAndRefresh('updateWarehouse', data, 'บันทึกการแก้ไขแล้ว ✓');
    closeModal();
    if (_currentProfileWhId) openProfile(_currentProfileWhId);
  });
}

async function submitTask(e) {
  e.preventDefault();
  const btn = document.getElementById('addTaskBtn');
  const data = dataFromForm(e.target);
  delete data['Progress %'];
  await withLoading(btn, async () => {
    await postAndRefresh('addTask', data, 'เพิ่มงานแล้ว ✓');
    closeModal();
    e.target.reset();
    if (_currentProfileWhId) renderProfileTasks();
  });
}

async function submitEditTask(e) {
  e.preventDefault();
  const btn = document.getElementById('editTaskBtn');
  const data = dataFromForm(e.target);
  delete data['Progress %'];
  // ส่งทั้ง 2 รูปแบบ — ทำงานได้กับ Apps Script ทั้งเก่าและใหม่
  data.taskId = data['Task ID'];
  await withLoading(btn, async () => {
    await postAndRefresh('updateTask', data, 'บันทึกการแก้ไขแล้ว ✓');
    closeModal();
  });
}

async function submitDocument(e) {
  e.preventDefault();
  const btn = document.getElementById('addDocBtn');
  const data = dataFromForm(e.target);
  await withLoading(btn, async () => {
    await postAndRefresh('addDocument', data, 'เพิ่มเอกสารแล้ว ✓');
    closeModal();
    e.target.reset();
  });
}

async function submitCalendarEvent(e) {
  e.preventDefault();
  const btn = document.getElementById('addCalBtn');
  const data = dataFromForm(e.target);
  await withLoading(btn, async () => {
    await postAndRefresh('addCalendarEvent', data, 'เพิ่มกิจกรรมแล้ว ✓');
    closeModal();
    e.target.reset();
    renderSelectedDay();
  });
}

async function submitEditCalendarEvent(e) {
  e.preventDefault();
  const btn = document.getElementById('editCalBtn');
  const data = dataFromForm(e.target);
  // ส่งทั้ง 2 รูปแบบ — ทำงานได้กับ Apps Script ทั้งเก่าและใหม่
  data.eventId = data['Event ID'];
  await withLoading(btn, async () => {
    await postAndRefresh('updateCalendarEvent', data, 'บันทึกกิจกรรมแล้ว ✓');
    closeModal();
    renderSelectedDay();
  });
}

async function submitIssue(e) {
  e.preventDefault();
  const btn = document.getElementById('addIssueBtn');
  const data = dataFromForm(e.target);
  await withLoading(btn, async () => {
    await postAndRefresh('addIssue', data, 'เพิ่ม Issue แล้ว ✓');
    closeModal();
    e.target.reset();
    if (_currentProfileWhId) renderProfileIssues();
  });
}

async function submitChecklistTemplate(e) {
  e.preventDefault();
  const data = dataFromForm(e.target);
  await postAndRefresh('addChecklistTemplate', data, 'เพิ่ม Template แล้ว ✓');
  closeModal();
  e.target.reset();
}

/* ────────────────────────────────────────────────────
   OPEN EDIT MODALS
──────────────────────────────────────────────────── */
function openEditWarehouseById(whId) {
  const w = state.warehouses.find(x => x['Warehouse ID'] === whId);
  if (!w) return;
  populateSelect('editWhStatus', state.settings['Warehouse Status'], w['Warehouse Status']);
  document.getElementById('editWhId').value         = w['Warehouse ID'];
  document.getElementById('editWhName').value        = w['Warehouse Name'] || '';
  document.getElementById('editWhZone').value        = w['Location / Zone'] || '';
  document.getElementById('editWhOwner').value       = w['Owner'] || '';
  document.getElementById('editWhPhone').value       = w['Owner Phone'] || '';
  document.getElementById('editWhStart').value       = fmtDate(w['Start Date']) || '';
  document.getElementById('editWhHandover').value    = fmtDate(w['Target Handover Date']) || '';
  document.getElementById('editWhDocLink').value     = w['Document Folder Link'] || '';
  document.getElementById('editWhNotes').value       = w['Notes'] || '';
  openModal('editWarehouseModal');
}

function openEditWarehouse() {
  if (_currentProfileWhId) openEditWarehouseByKey(_currentProfileWhId);
}

// รองรับทั้ง Warehouse ID จริง และ _idx_N (คลังที่ไม่มี ID ใน Sheet)
function openEditWarehouseByKey(key) {
  let w;
  if (key && key.startsWith('_idx_')) {
    const idx = parseInt(key.replace('_idx_', ''), 10);
    w = state.warehouses[idx];
  } else {
    w = state.warehouses.find(x => x['Warehouse ID'] === key);
  }
  if (!w) return;
  populateSelect('editWhStatus', state.settings['Warehouse Status'], w['Warehouse Status']);
  document.getElementById('editWhId').value         = w['Warehouse ID'] || '';
  document.getElementById('editWhName').value        = w['Warehouse Name'] || '';
  document.getElementById('editWhZone').value        = w['Location / Zone'] || '';
  document.getElementById('editWhOwner').value       = w['Owner'] || '';
  document.getElementById('editWhPhone').value       = w['Owner Phone'] || '';
  document.getElementById('editWhStart').value       = fmtDate(w['Start Date']) || '';
  document.getElementById('editWhHandover').value    = fmtDate(w['Target Handover Date']) || '';
  document.getElementById('editWhDocLink').value     = w['Document Folder Link'] || '';
  document.getElementById('editWhNotes').value       = w['Notes'] || '';
  openModal('editWarehouseModal');
}

function openEditTask(taskId) {
  const t = state.tasks.find(x => x['Task ID'] === taskId);
  if (!t) return;
  populateSelect('editTaskWhSelect', state.warehouses.map(w => ({ value: w['Warehouse ID'], label: w['Warehouse Name'] })), t['Warehouse ID']);
  populateSelect('editTaskPhaseSelect', state.settings['Phase'], t['Phase']);
  populateSelect('editTaskStatus', state.settings['Task Status'], t['Status']);
  populateSelect('editTaskPriority', state.settings['Priority'], t['Priority']);
  document.getElementById('editTaskId').value        = t['Task ID'];
  document.getElementById('editTaskName').value      = t['Task Name'] || '';
  document.getElementById('editTaskAssignee').value  = t['Assignee'] || '';
  document.getElementById('editTaskDue').value       = fmtDate(t['Due Date']) || '';
  document.getElementById('editTaskEvidence').value  = t['Evidence Link'] || '';
  document.getElementById('editTaskNotes').value     = t['Notes'] || '';
  openModal('editTaskModal');
}

function openEditCalendarEvent(eventId) {
  const e = state.calendar.find(x => x['Event ID'] === eventId);
  if (!e) return;
  populateSelect('editCalType', state.settings['Event Type'], e['Event Type']);
  populateSelect('editCalStatus', state.settings['Calendar Status'], e['Calendar Status']);
  document.getElementById('editCalEventId').value    = e['Event ID'];
  document.getElementById('editCalTitle').value      = e['Event Title'] || '';
  document.getElementById('editCalStart').value      = fmtDate(e['Start Date']) || '';
  document.getElementById('editCalDue').value        = fmtDate(e['Due Date']) || '';
  document.getElementById('editCalStartTime').value  = e['Start Time'] || '';
  document.getElementById('editCalEndTime').value    = e['End Time'] || '';
  document.getElementById('editCalAssignee').value   = e['Assignee'] || '';
  document.getElementById('editCalReminder').value   = e['Reminder Days'] || '1';
  document.getElementById('editCalNotes').value      = e['Notes'] || '';
  openModal('editCalEventModal');
}

/* Open add-task prefilled with warehouse from profile */
function openAddTaskInProfile() {
  populateSelect('taskWhSelectNew', state.warehouses.map(w => ({ value: w['Warehouse ID'], label: w['Warehouse Name'] })), _currentProfileWhId || '');
  populateSelect('taskPhaseSelectNew', state.settings['Phase']);
  populateSelect('taskStatusSelectNew', state.settings['Task Status'], 'To Do');
  populateSelect('taskPrioritySelectNew', state.settings['Priority'], 'Medium');
  openModal('addTaskModal');
}

function openAddDocInProfile() {
  populateSelect('docWhSelectNew', state.warehouses.map(w => ({ value: w['Warehouse ID'], label: w['Warehouse Name'] })), _currentProfileWhId || '');
  populateSelect('docTypeSelectNew', state.settings['Document Type']);
  populateSelect('docStatusSelectNew', state.settings['Document Status']);
  openModal('addDocModal');
}

function openAddEventInProfile() {
  populateSelect('calWhSelectNew', state.warehouses.map(w => ({ value: w['Warehouse ID'], label: w['Warehouse Name'] })), _currentProfileWhId || '');
  populateSelect('calEventTypeNew', state.settings['Event Type']);
  populateSelect('calStatusNew', state.settings['Calendar Status'], 'ยังไม่เตือน');
  openModal('addCalEventModal');
}

function openAddIssueInProfile() {
  if (_currentProfileWhId) document.getElementById('issueWhId').value = _currentProfileWhId;
  populateSelect('issuePriorityNew', state.settings['Priority'], 'Medium');
  populateSelect('issueStatusNew', state.settings['Task Status'], 'To Do');
  populateSelect('issueTaskNew', [{ value:'', label:'— ไม่ระบุ —' }, ...state.tasks.filter(t=>t['Warehouse ID']===_currentProfileWhId).map(t=>({ value: t['Task ID'], label: t['Task Name'] }))]);
  openModal('addIssueModal');
}

function openAddChecklistItem() {
  if (!_currentProfileWhId) return;
  const name = prompt('ชื่อรายการ Checklist:');
  if (!name) return;
  api('addChecklistItem', { 'Warehouse ID': _currentProfileWhId, 'Task Name': name, 'Phase': '', Status: 'pending' })
    .then(() => { toast('เพิ่มรายการแล้ว ✓', 'success'); renderProfileChecklist(); });
}

async function applyChecklistTemplate() {
  if (!_currentProfileWhId) return;
  if (!state.checklistTemplates.length) {
    toast('ยังไม่มี Template กรุณาเพิ่มใน ตั้งค่า → Checklist', 'warning');
    return;
  }
  if (!confirm(`ใช้ ${state.checklistTemplates.length} templates กับคลังนี้ใช่หรือไม่?`)) return;
  await postAndRefresh('createChecklist', { warehouseId: _currentProfileWhId, templates: state.checklistTemplates }, 'สร้าง Checklist แล้ว ✓');
  renderProfileChecklist();
}

/* ────────────────────────────────────────────────────
   QUICK STATUS MODAL
──────────────────────────────────────────────────── */
function openQuickStatus(taskId, sheet = 'Tasks') {
  const t = state.tasks.find(x => x['Task ID'] === taskId);
  if (!t) return;
  const statuses = state.settings['Task Status'] || [];
  document.getElementById('quickStatusBody').innerHTML = statuses.map(s => `
    <button class="qstatus-btn ${t['Status']===s?'active':''}" onclick="applyQuickStatus('${esc(taskId)}','${esc(s)}','${esc(sheet)}')">
      ${statusDotHtml(s)} ${esc(s)}
    </button>`).join('');
  openModal('quickStatusModal');
}

async function applyQuickStatus(taskId, status, sheet) {
  await postAndRefresh('updateStatus', { id: taskId, field: 'Status', value: status, sheet }, `อัปเดตสถานะ: ${status} ✓`);
  closeModal();
}

/* ────────────────────────────────────────────────────
   DELETE
──────────────────────────────────────────────────── */
let _deletePayload = null;

function confirmDelete(sheet, id, label) {
  _deletePayload = { sheet, id };
  document.getElementById('confirmDeleteMsg').textContent = label || `ยืนยันการลบรายการนี้?`;
  document.getElementById('deleteReason').value = '';
  openModal('confirmDeleteModal');
}

async function executeDelete() {
  if (!_deletePayload) return;
  const { sheet, id } = _deletePayload;
  const reason = document.getElementById('deleteReason').value;
  await postAndRefresh('deleteRecord', { sheet, id, reason }, 'ลบรายการแล้ว ✓');
  closeModal();
  _deletePayload = null;
  if (_currentProfileWhId) {
    renderProfileTasks();
    renderProfileDocs();
    renderProfileIssues();
  }
}

/* ────────────────────────────────────────────────────
   SELECT POPULATION
──────────────────────────────────────────────────── */
function populateSelect(id, options, selected = '', placeholder = '') {
  const el = document.getElementById(id);
  if (!el) return;
  const items = Array.isArray(options) ? options : [];
  const optHtml = items.map(o => {
    const val = (typeof o === 'object') ? o.value : o;
    const label = (typeof o === 'object') ? o.label : o;
    const sel = val === selected ? 'selected' : '';
    return `<option value="${esc(val)}" ${sel}>${esc(label)}</option>`;
  });
  if (placeholder) optHtml.unshift(`<option value="">${placeholder}</option>`);
  el.innerHTML = optHtml.join('');
}

function populateAllSelects() {
  const whs = state.warehouses.map(w => ({ value: w['Warehouse ID'], label: w['Warehouse Name'] }));
  const s = state.settings;

  // Warehouse filter dropdowns
  const whOpts = '<option value="">คลังทั้งหมด</option>' + whs.map(w => `<option value="${esc(w.value)}">${esc(w.label)}</option>`).join('');
  ['dashWhFilter','taskWhFilter','reportWhFilter'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { const cur = el.value; el.innerHTML = whOpts; el.value = cur; }
  });

  // Task status filters
  const stOpts = '<option value="">สถานะทั้งหมด</option>' + (s['Task Status']||[]).map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
  ['taskStatusFilter'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = stOpts; });

  // Task priority filters
  const prOpts = '<option value="">Priority ทั้งหมด</option>' + (s['Priority']||[]).map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
  ['taskPriorityFilter'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = prOpts; });

  // Warehouse status filter
  const whStOpts = '<option value="">ทั้งหมด</option>' + (s['Warehouse Status']||[]).map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
  const whStEl = document.getElementById('whStatusFilter'); if (whStEl) whStEl.innerHTML = whStOpts;

  // Add warehouse modal
  populateSelect('whStatusSelectNew', s['Warehouse Status'] || [], '');

  // Add task modal
  populateSelect('taskWhSelectNew', whs, '');
  populateSelect('taskPhaseSelectNew', s['Phase'] || [], '');
  populateSelect('taskStatusSelectNew', s['Task Status'] || [], 'To Do');
  populateSelect('taskPrioritySelectNew', s['Priority'] || [], 'Medium');

  // Add doc modal
  populateSelect('docWhSelectNew', whs, '');
  populateSelect('docTypeSelectNew', s['Document Type'] || []);
  populateSelect('docStatusSelectNew', s['Document Status'] || []);
  const docStEl = document.getElementById('docStatusFilter');
  if (docStEl) docStEl.innerHTML = '<option value="">สถานะทั้งหมด</option>' + (s['Document Status']||[]).map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');

  // Add calendar modal
  populateSelect('calWhSelectNew', whs, '');
  populateSelect('calEventTypeNew', s['Event Type'] || []);
  populateSelect('calStatusNew', s['Calendar Status'] || [], 'ยังไม่เตือน');

  // Doc filter select
  populateDocFilterSelect();

  // Checklist template phase
  populateSelect('ctPhaseNew', s['Phase'] || []);
  populateSelect('ctPriorityNew', s['Priority'] || [], 'Medium');

  // Edit modals (populate but keep current)
  populateSelect('editWhStatus', s['Warehouse Status'] || []);
  populateSelect('editTaskWhSelect', whs);
  populateSelect('editTaskPhaseSelect', s['Phase'] || []);
  populateSelect('editTaskStatus', s['Task Status'] || []);
  populateSelect('editTaskPriority', s['Priority'] || []);
  populateSelect('editCalType', s['Event Type'] || []);
  populateSelect('editCalStatus', s['Calendar Status'] || []);
  populateSelect('issuePriorityNew', s['Priority'] || [], 'Medium');
  populateSelect('issueStatusNew', s['Task Status'] || [], 'To Do');

  // Profile selects
  populateSelect('profileTaskStatusFilter', s['Task Status'] || [], '', 'สถานะทั้งหมด');
  populateSelect('profileDocTypeFilter', s['Document Type'] || [], '', 'ประเภทเอกสารทั้งหมด');
  populateSelect('profileIssueStatusFilter', s['Task Status'] || [], '', 'สถานะทั้งหมด');

  // Doc task link
  const docTaskEl = document.getElementById('docTaskSelectNew');
  if (docTaskEl) {
    docTaskEl.innerHTML = '<option value="">— ไม่ระบุ —</option>' + state.tasks.map(t => `<option value="${esc(t['Task ID'])}">${esc(t['Task Name'])}</option>`).join('');
  }
}

/* ────────────────────────────────────────────────────
   TOP DATE
──────────────────────────────────────────────────── */
function updateTopDate() {
  const el = document.getElementById('topDate');
  if (!el) return;
  const now = new Date();
  const thDays = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];
  const thMonths = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  el.textContent = `${thDays[now.getDay()]} ${now.getDate()} ${thMonths[now.getMonth()]} ${now.getFullYear()+543}`;
}

/* ────────────────────────────────────────────────────
   INIT
──────────────────────────────────────────────────── */
function initApp() {
  // Load seed in demo mode
  if (!CONFIG.apiUrl) {
    Object.assign(state, JSON.parse(JSON.stringify(DEMO_SEED)));
  }

  updateTopDate();
  setInterval(updateTopDate, 60000);

  if (CONFIG.apiUrl) {
    loadAllData();
  } else {
    populateAllSelects();
    renderAll();
  }

  // Set default assignee in forms to current user
  const user = getCurrentUser()?.username || '';
  ['taskAssigneeNew','docUploadedBy','calAssigneeNew'].forEach(id => {
    const el = document.getElementById(id);
    if (el && !el.value) el.value = user;
  });

  // Update settings UI
  renderModeIndicator();
}

/* ════════════════════════════════════════════════════
   PREMIUM ANIMATIONS ENGINE
════════════════════════════════════════════════════ */

/* ── Count-up Animation ── */
function animateCountUp(el, target, duration = 700) {
  if (!el) return;
  const start    = parseInt(el.textContent) || 0;
  const delta    = target - start;
  const startTs  = performance.now();
  function step(ts) {
    const elapsed = ts - startTs;
    const progress = Math.min(elapsed / duration, 1);
    // ease-out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(start + delta * eased);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/* ── Trigger count-up on all [data-countup] elements ── */
function triggerCountUps() {
  document.querySelectorAll('[data-countup]').forEach(el => {
    const target = parseInt(el.getAttribute('data-countup'));
    if (!isNaN(target)) animateCountUp(el, target, 800);
  });
}

/* ── Button Ripple Effect ── */
function addRipple(e) {
  const btn  = e.currentTarget;
  const rect = btn.getBoundingClientRect();
  const ripple = document.createElement('span');
  ripple.className = 'btn-ripple';
  ripple.style.left = `${e.clientX - rect.left}px`;
  ripple.style.top  = `${e.clientY - rect.top}px`;
  btn.appendChild(ripple);
  ripple.addEventListener('animationend', () => ripple.remove());
}

function attachRipples() {
  document.querySelectorAll('.btn-primary, .btn-danger, .btn-outline').forEach(btn => {
    if (!btn.dataset.ripple) {
      btn.dataset.ripple = '1';
      btn.addEventListener('click', addRipple);
    }
  });
}

/* ── Section Slide-in on nav switch ── */
function animateSection(sectionEl) {
  if (!sectionEl) return;
  sectionEl.classList.remove('section-animate');
  // force reflow
  void sectionEl.offsetWidth;
  sectionEl.classList.add('section-animate');
  // stagger children (cards, rows)
  const items = sectionEl.querySelectorAll('.kpi-card, .wh-card, .task-card, .doc-card, .settings-card');
  items.forEach((item, i) => {
    item.style.animationDelay = `${i * 0.06}s`;
    item.style.animation = 'none';
    void item.offsetWidth;
    item.style.animation = '';
  });
}

/* ── KPI Card Mouse Parallax ── */
function attachKpiParallax() {
  document.querySelectorAll('.kpi-card').forEach(card => {
    card.addEventListener('mousemove', e => {
      const r = card.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width  * 100).toFixed(1);
      const y = ((e.clientY - r.top)  / r.height * 100).toFixed(1);
      card.style.setProperty('--mx', `${x}%`);
      card.style.setProperty('--my', `${y}%`);
    });
  });
}

/* ── Live Clock in Dashboard Hero ── */
function startDashClock() {
  const el = document.getElementById('dashHeroTime');
  if (!el) return;
  function tick() {
    const now = new Date();
    el.textContent = now.toLocaleTimeString('th-TH', { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12: false });
  }
  tick();
  setInterval(tick, 1000);
}

/* ── Dashboard Hero Date ── */
function renderDashHero() {
  const greetEl = document.getElementById('dashHeroGreeting');
  const dateEl  = document.getElementById('dashHeroDate');
  if (!greetEl && !dateEl) return;
  const user = getCurrentUser();
  const name = user?.username || 'ผู้ใช้';
  const now  = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? '☀️ สวัสดีตอนเช้า' : hour < 17 ? '🌤️ สวัสดีตอนบ่าย' : '🌙 สวัสดีตอนเย็น';
  if (greetEl) greetEl.textContent = `${greeting}, ${name}!`;
  const thDays = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];
  const thMonths = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  if (dateEl) dateEl.textContent = `วัน${thDays[now.getDay()]} ${now.getDate()} ${thMonths[now.getMonth()]} ${now.getFullYear() + 543}`;
  startDashClock();
}

/* ── Attach all animation hooks ── */
function initAnimations() {
  attachRipples();
  attachKpiParallax();
  // re-attach on dynamic renders via MutationObserver
  const obs = new MutationObserver(() => { attachRipples(); attachKpiParallax(); });
  obs.observe(document.body, { childList: true, subtree: true });
}

/* ── App Bootstrap ── */
window.addEventListener('DOMContentLoaded', () => {
  const session = localStorage.getItem('wm_session');
  if (session) {
    const user = JSON.parse(session);
    launchApp(user);
  }
  initAnimations();
  // Otherwise login page shown by default
});
