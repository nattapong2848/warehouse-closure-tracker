/* =============================================================
   SPX Closure Control Tower — script.js  V3.4.6 (FULL BUILD)
   ============================================================= */

// ─── CONFIG & STATE ──────────────────────────────────────────
const CONFIG = {
  spreadsheetId: localStorage.getItem("spx_sheet_id") || "1gNnjKeqxaE6TtCOOXOqnaG_E0v5dQtUmE_KfLgoo6hI",
  apiUrl:        localStorage.getItem("spx_api_url")   || "",
  defaultUser:   localStorage.getItem("spx_default_user") || "System",
  dueSoonDays:   Number(localStorage.getItem("spx_due_soon_days") || 3)
};

const state = {
  warehouses: [], tasks: [], documents: [], calendar: [],
  activity: [], settings: {}, issues: [], checklistTemplates: [], trash: [],
  selectedWarehouseId: localStorage.getItem("spx_selected_wh") || "",
  currentView: "dashboard",
  selectedCalendarDate: "",
  calendarCursor: ""
};

// initialise date-dependent state after helpers are loaded
function initState(){
  state.selectedCalendarDate = state.selectedCalendarDate || todayISO();
  state.calendarCursor       = state.calendarCursor       || todayISO().slice(0,7);
}

const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];

document.addEventListener("DOMContentLoaded", init);


// ─── INIT ────────────────────────────────────────────────────
function init(){
  initState();
  bindNavigation();
  bindForms();
  bindButtons();
  startClock();
  initSettingsFields();
  loadMemoryIntoForms();
  renderAll();
  loadAllData();
}

function bindNavigation(){
  $$(".nav-btn").forEach(btn => btn.addEventListener("click", () => showView(btn.dataset.view)));
  $$("[data-goto]").forEach(btn => btn.addEventListener("click", () => showView(btn.dataset.goto)));
}

function showView(name){
  state.currentView = name;
  $$(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.view === name));
  $$(".view").forEach(v => v.classList.remove("active"));
  const view = $("#" + name + "View");
  if(view) view.classList.add("active");
  const map = {
    dashboard:"⚡ Dashboard", warehouseStatus:"🏢 สถานะคลัง", profiles:"🗂️ โปรไฟล์คลัง",
    addWarehouse:"+ เพิ่มคลัง", addTask:"📦 เพิ่มงาน", tasks:"📋 รายการงาน",
    documents:"📎 เอกสาร", calendar:"🗓️ ปฏิทิน", issues:"🚨 Risks / Issues",
    checklist:"✅ Checklist", reports:"📣 รายงาน", activity:"🛰️ Activity Log",
    trash:"🗑️ ถังขยะ", settings:"⚙️ ตั้งค่า"
  };
  $("#pageTitle").textContent = map[name] || name;
  if(name === "reports") renderDailyReport();
}

function bindButtons(){
  $("#refreshBtn")?.addEventListener("click", loadAllData);
  $("#saveSettingsBtn")?.addEventListener("click", saveSettings);
  $("#testApiBtn")?.addEventListener("click", testApi);
  $("#settingCategorySelect")?.addEventListener("change", renderSettingOptionList);
  $("#addSettingOptionBtn")?.addEventListener("click", addSettingOptionFromUI);
  $("#copyReportBtn")?.addEventListener("click", () =>
    navigator.clipboard.writeText($("#dailyReport").textContent).then(() => toast("คัดลอกรายงานแล้ว"))
  );
  $("#prevMonth")?.addEventListener("click", () => changeMonth(-1));
  $("#nextMonth")?.addEventListener("click", () => changeMonth(1));
  $("#calendarMonth")?.addEventListener("change", e => { state.calendarCursor = e.target.value; renderCalendar(); });
  $("#createChecklistBtn")?.addEventListener("click", createChecklistForWarehouse);
  $("#checklistCaseFilter")?.addEventListener("change", renderChecklist);
  $("#newChecklistTemplateBtn")?.addEventListener("click", openNewChecklistTemplateForm);
  $("#cancelChecklistTemplateBtn")?.addEventListener("click", closeChecklistTemplateForm);
  $("#profileSearch")?.addEventListener("input", renderProfiles);
  $("#warehouseStatusSearch")?.addEventListener("input", renderWarehouseStatus);
  $("#warehouseStatusFilter")?.addEventListener("change", renderWarehouseStatus);
  $("#taskSearch")?.addEventListener("input", renderTasks);
  $("#taskWarehouseFilter")?.addEventListener("change", renderTasks);
  $("#taskStatusFilter")?.addEventListener("change", renderTasks);
  $("#documentSearch")?.addEventListener("input", renderDocuments);
  $("#documentWarehouseFilter")?.addEventListener("change", renderDocuments);
  $("#documentTypeFilter")?.addEventListener("change", renderDocuments);
  $("#modalClose")?.addEventListener("click", closeModal);
}

function bindForms(){
  $("#warehouseForm")?.addEventListener("submit", submitWarehouse);
  $("#taskForm")?.addEventListener("submit", submitTask);
  $("#documentForm")?.addEventListener("submit", submitDocument);
  $("#calendarForm")?.addEventListener("submit", submitCalendarEvent);
  $("#issueForm")?.addEventListener("submit", submitIssue);
  $("#checklistTemplateForm")?.addEventListener("submit", submitChecklistTemplate);
}


// ─── CLOCK ───────────────────────────────────────────────────
function startClock(){
  const tick = () => {
    const el = $("#clock");
    if(el) el.textContent = new Intl.DateTimeFormat("th-TH", {
      timeZone:"Asia/Bangkok", hour:"2-digit", minute:"2-digit", second:"2-digit", hour12:false
    }).format(new Date());
  };
  tick(); setInterval(tick, 1000);
}


// ─── UTILITY HELPERS ─────────────────────────────────────────
function todayISO(){
  return new Intl.DateTimeFormat("en-CA", {
    timeZone:"Asia/Bangkok", year:"numeric", month:"2-digit", day:"2-digit"
  }).format(new Date());
}

function parseDate(v){
  if(!v) return null;
  if(v instanceof Date) return isNaN(v) ? null : v;
  const s = String(v).trim();
  // ISO: 2026-05-22 or 2026-05-22T…
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if(iso){
    const y=iso[1], m=String(iso[2]).padStart(2,"0"), d=String(iso[3]).padStart(2,"0");
    return new Date(`${y}-${m}-${d}T00:00:00`);
  }
  // Thai/Google display: 22/5/2026 or 22/05/2026
  const th = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if(th){
    const d=String(th[1]).padStart(2,"0"), m=String(th[2]).padStart(2,"0"), y=th[3];
    return new Date(`${y}-${m}-${d}T00:00:00`);
  }
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

function fmtDate(v){ const d=parseDate(v); return d ? d.toISOString().slice(0,10) : ""; }
function daysDiff(dateStr){ const d=parseDate(dateStr); if(!d) return null; return Math.floor((d - parseDate(todayISO())) / 86400000); }
function addDays(iso,n){ const d=parseDate(iso); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10); }
function uid(prefix){ return prefix + "-" + Math.floor(1000 + Math.random()*9000) + Date.now().toString().slice(-3); }

function toast(msg){
  const t=$("#toast");
  if(!t) return;
  t.textContent=msg; t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2600);
}

function openModal(html){ $("#modalBody").innerHTML=html; $("#modal").classList.remove("hidden"); }
function closeModal(){ $("#modal").classList.add("hidden"); }

/** ดึงค่าจาก form ทุก element เป็น object */
function dataFromForm(form){
  const data = {};
  [...form.elements].forEach(el => {
    if(!el.name) return;
    if(el.type === "checkbox"){ data[el.name] = el.checked; return; }
    data[el.name] = el.value;
  });
  return data;
}

function escapeAttr(value){
  return String(value || "")
    .replace(/&/g,"&amp;").replace(/'/g,"&#39;").replace(/"/g,"&quot;")
    .replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

function escapeHTML(value){
  return String(value || "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}


// ─── API ─────────────────────────────────────────────────────
async function api(action, payload={}, method="POST"){
  if(!CONFIG.apiUrl) return demoApi(action, payload);
  const url = method === "GET"
    ? `${CONFIG.apiUrl}?action=${encodeURIComponent(action)}`
    : CONFIG.apiUrl;
  const res = await fetch(url, method === "GET"
    ? { method:"GET" }
    : { method:"POST", body: JSON.stringify({ action, ...payload }) }
  );
  const json = await res.json();
  if(!json.success) throw new Error(json.message || "API error");
  return json;
}

/** เรียก API แล้ว toast + โหลดข้อมูลใหม่ */
async function postAndRefresh(action, payload, successMsg){
  try{
    await api(action, payload);
    toast(successMsg || "บันทึกแล้ว");
    await loadAllData();
  } catch(err){
    console.error(err);
    toast("เกิดข้อผิดพลาด: " + err.message);
  }
}


// ─── LOAD DATA ───────────────────────────────────────────────
async function loadAllData(){
  setSync(false, "Syncing...");
  try{
    const res  = await api("getAllData", {}, "GET");
    const data = res.data || {};
    state.warehouses        = data.Warehouses        || data.warehouses        || [];
    state.tasks             = data.Tasks             || data.tasks             || [];
    state.documents         = data.Documents         || data.documents         || [];
    state.calendar          = data.Calendar          || data.calendar          || [];
    state.activity          = data.Activity_Log      || data.activity          || [];
    state.settings          = normalizeSettings(data.Settings || data.settings || []);
    state.issues            = data.Issues            || data.issues            || [];
    state.checklistTemplates= data.Checklist_Templates || data.checklistTemplates || [];
    state.trash             = data.Trash             || data.trash             || [];
    setSync(true, CONFIG.apiUrl ? "เชื่อมต่อแล้ว" : "Demo Mode");
  } catch(err){
    console.error(err);
    setSync(false, "ออฟไลน์ / ไม่ได้เชื่อมต่อ");
    if(!state.warehouses.length) seedDemo();
    toast("โหลดข้อมูลไม่สำเร็จ ใช้ Demo Mode");
  }
  ensureDefaultSettings();
  renderAll();
}

function setSync(ok, msg){
  const dot  = $("#syncDot");
  const text = $("#syncText");
  const sub  = $("#syncSubText");
  if(text) text.textContent = msg;
  if(sub)  sub.textContent  = ok ? "Google Sheet Sync" : "ออฟไลน์ / ไม่ได้เชื่อมต่อ";
  if(dot)  dot.classList.toggle("good", ok);
}

function normalizeSettings(rows){
  const out = {};
  if(!rows) return out;
  // Array of objects: [{ "Task Status":"Backlog", … }, …]
  if(Array.isArray(rows) && rows.length && typeof rows[0] === "object" && !Array.isArray(rows[0])){
    const keys = Object.keys(rows[0]);
    keys.forEach(k => {
      out[k] = [...new Set(rows.map(r => String(r[k] || "").trim()).filter(Boolean))];
    });
    return out;
  }
  // Raw 2D array: [["Task Status","Priority"],["Backlog","สูง"],…]
  if(Array.isArray(rows) && Array.isArray(rows[0])){
    const headers = rows[0].map(x => String(x || "").trim()).filter(Boolean);
    headers.forEach((h, col) => {
      out[h] = [...new Set(rows.slice(1).map(r => String((r||[])[col] || "").trim()).filter(Boolean))];
    });
    return out;
  }
  return out;
}

function ensureDefaultSettings(){
  const defaults = {
    "Task Status":      ["Backlog","To Do","กำลังดำเนินการ","รอเอกสาร","รอ Vendor","ติดขัด","ปิดแล้ว"],
    "Priority":         ["สูงมาก","สูง","กลาง","ต่ำ"],
    "Warehouse Status": ["ยังไม่เริ่ม","กำลังปิดคลัง","รอส่งมอบ","ส่งมอบแล้ว","ปิดโครงการแล้ว"],
    "Phase":            ["เฟส 1 · ตรวจสัญญาและแจ้งเลิก","เฟส 2 · วางแผนและตั้งทีม","เฟส 3 · เคลียร์ทรัพย์สินและสต๊อก","เฟส 4 · ยกเลิก Vendor และสาธารณูปโภค","เฟส 5 · คืนสภาพพื้นที่","เฟส 6 · ส่งมอบพื้นที่","เฟส 7 · ปิดการเงินและเงินประกัน"],
    "Document Type":    ["สัญญาเช่า","ใบส่งมอบพื้นที่","รูปภาพพื้นที่","ใบเสนอราคา","Invoice / PO","อื่น ๆ"],
    "Document Status":  ["รอตรวจสอบ","ผ่าน","ต้องแก้ไข"],
    "Event Type":       ["กำหนดส่งงาน","นัดหมาย","ตรวจพื้นที่","ติดตามเอกสาร","แจ้งเตือน"],
    "Calendar Status":  ["ยังไม่เตือน","เตือนแล้ว","เสร็จสิ้น","ยกเลิก"]
  };
  Object.entries(defaults).forEach(([key, arr]) => {
    const existing = Array.isArray(state.settings[key]) ? state.settings[key].filter(Boolean) : [];
    state.settings[key] = [...new Set([...existing, ...arr])];
  });
  state.checklistTemplates = normalizeChecklistTemplates(state.checklistTemplates);
  if(!state.checklistTemplates.length){
    state.checklistTemplates = [
      {"Template ID":"TPL-001","Phase":"เฟส 1 · ตรวจสัญญาและแจ้งเลิก","Task Name":"ตรวจสัญญาเช่าและสรุปเงื่อนไขสำคัญ","Priority":"สูง","Default Status":"To Do","Default Due Offset Days":"3","Document Required":"สัญญาเช่า","Case Type":"Standard","Active":"TRUE","Notes":"ตรวจวันสิ้นสุดสัญญา Notice Period เงินประกัน และเงื่อนไขคืนสภาพ"},
      {"Template ID":"TPL-002","Phase":"เฟส 1 · ตรวจสัญญาและแจ้งเลิก","Task Name":"ส่งหนังสือแจ้งเลิก/ไม่ต่อสัญญา","Priority":"สูงมาก","Default Status":"To Do","Default Due Offset Days":"5","Document Required":"อื่น ๆ","Case Type":"Standard","Active":"TRUE","Notes":"เก็บหลักฐานการรับทราบจาก Landlord"},
      {"Template ID":"TPL-003","Phase":"เฟส 3 · เคลียร์ทรัพย์สินและสต๊อก","Task Name":"ตรวจนับทรัพย์สินและสินค้าในพื้นที่","Priority":"สูง","Default Status":"To Do","Default Due Offset Days":"10","Document Required":"รูปภาพพื้นที่","Case Type":"Standard","Active":"TRUE","Notes":"แยกของย้าย / คืน / ทิ้ง / ขาย"},
      {"Template ID":"TPL-004","Phase":"เฟส 5 · คืนสภาพพื้นที่","Task Name":"ทำ Defect List และคืนสภาพพื้นที่","Priority":"สูงมาก","Default Status":"To Do","Default Due Offset Days":"18","Document Required":"รูปภาพพื้นที่","Case Type":"Standard","Active":"TRUE","Notes":"เก็บภาพก่อน/หลังทุกจุด"},
      {"Template ID":"TPL-005","Phase":"เฟส 6 · ส่งมอบพื้นที่","Task Name":"Final Walkthrough และเซ็นเอกสารส่งมอบ","Priority":"สูงมาก","Default Status":"To Do","Default Due Offset Days":"21","Document Required":"ใบส่งมอบพื้นที่","Case Type":"Standard","Active":"TRUE","Notes":"คืนกุญแจ/บัตรผ่านและเก็บหลักฐาน"}
    ];
  }
}

function normalizeChecklistTemplates(list){
  if(!Array.isArray(list)) return [];
  return list.filter(Boolean).map((t, idx) => ({
    "Template ID":          t["Template ID"]          || t.templateId       || `TPL-LOCAL-${idx+1}`,
    "Phase":                t.Phase                   || t.phase            || "",
    "Task Name":            t["Task Name"]            || t.taskName         || "",
    "Default Assignee":     t["Default Assignee"]     || t.defaultAssignee  || "",
    "Priority":             t.Priority                || t.priority         || "กลาง",
    "Default Status":       t["Default Status"]       || t.defaultStatus    || "To Do",
    "Default Due Offset Days": t["Default Due Offset Days"] || t.dueOffset  || "7",
    "Document Required":    t["Document Required"]    || t.documentRequired || "",
    "Notes":                t.Notes                   || t.notes            || "",
    "Case Type":            t["Case Type"]            || t.caseType         || "Standard",
    "Active":               String(t.Active || t.active || "TRUE").toUpperCase() === "FALSE" ? "FALSE" : "TRUE"
  })).filter(t => t["Task Name"]);
}


// ─── RENDER ALL ──────────────────────────────────────────────
function renderAll(){
  const jobs = [
    ["dropdowns",       renderDropdowns],
    ["dashboard",       renderDashboard],
    ["warehouseStatus", renderWarehouseStatus],
    ["profiles",        renderProfiles],
    ["tasks",           renderTasks],
    ["documents",       renderDocuments],
    ["calendar",        renderCalendar],
    ["issues",          renderIssues],
    ["checklist",       renderChecklist],
    ["reports",         renderDailyReport],
    ["activity",        renderActivity],
    ["trash",           renderTrash],
    ["settings",        renderSettingsGrid]
  ];
  jobs.forEach(([name, fn]) => {
    try{ if(typeof fn === "function") fn(); }
    catch(err){ console.error("Render error:", name, err); }
  });
}


// ─── HELPER ACCESSORS ────────────────────────────────────────
function whName(id)           { return state.warehouses.find(w => w["Warehouse ID"] === id)?.["Warehouse Name"] || id || "-"; }
function whById(id)           { return state.warehouses.find(w => w["Warehouse ID"] === id) || {}; }
function tasksForWarehouse(id){ return state.tasks.filter(t => t["Warehouse ID"] === id); }
function isClosed(t)          { return ["ปิดแล้ว","เสร็จสิ้น","Completed"].includes(t.Status); }
function pendingTasks(tasks)  { return tasks.filter(t => !isClosed(t)); }
function overdueTasks(tasks)  { return tasks.filter(t => !isClosed(t) && daysDiff(t["Due Date"]) !== null && daysDiff(t["Due Date"]) < 0); }
function avgProgress(tasks)   { if(!tasks.length) return 0; return Math.round(tasks.reduce((s,t) => s + Number(t["Progress %"] || 0), 0) / tasks.length); }
function dueSoonTasks(tasks)  {
  return tasks.filter(t => !isClosed(t) && (
    ["ติดขัด","รอเอกสาร","รอ Vendor"].includes(t.Status) ||
    (daysDiff(t["Due Date"]) !== null && daysDiff(t["Due Date"]) <= CONFIG.dueSoonDays)
  ));
}


// ─── RENDER DASHBOARD ────────────────────────────────────────
function renderDashboard(){
  const total    = state.tasks.length;
  const done     = state.tasks.filter(isClosed).length;
  const active   = state.tasks.filter(t => !isClosed(t) && t.Status === "กำลังดำเนินการ").length;
  const overdue  = overdueTasks(state.tasks).length;
  const progress = avgProgress(state.tasks);

  $("#kpiWarehouses").textContent = state.warehouses.length;
  $("#kpiTasks").textContent      = total;
  $("#kpiActive").textContent     = active;
  $("#kpiDone").textContent       = done;
  $("#kpiOverdue").textContent    = overdue;
  $("#kpiProgress").textContent   = progress + "%";
  $("#overallProgress").textContent = progress + "%";

  const counts = {};
  state.tasks.forEach(t => counts[t.Status||"ไม่ระบุ"] = (counts[t.Status||"ไม่ระบุ"]||0) + 1);
  $("#statusBars").innerHTML = Object.entries(counts).map(([k,v]) =>
    `<div class="bar-row"><span>${escapeHTML(k)}</span><div class="bar-track"><div class="bar-fill" style="width:${total ? Math.round(v/total*100) : 0}%"></div></div><b>${v}</b></div>`
  ).join("") || empty("ยังไม่มีงาน");

  const follow = dueSoonTasks(state.tasks).slice(0, 8);
  $("#followUpList").innerHTML = follow.map(taskMini).join("") || empty("ยังไม่มีงานที่ต้องตาม");
}

function taskMini(t){
  const d   = daysDiff(t["Due Date"]);
  const cls = d < 0 ? "danger" : d === 0 ? "warn" : "";
  return `<div class="mini-card">
    <div><b>${escapeHTML(t["Task ID"])} · ${escapeHTML(t["Task Name"])}</b>
    <small>${escapeHTML(whName(t["Warehouse ID"]))} · Due ${t["Due Date"]||"-"} · ${escapeHTML(t.Status||"-")}</small></div>
    <span class="badge ${cls}">${d<0?"เลยกำหนด":d===0?"วันนี้":(d??"-")+" วัน"}</span>
  </div>`;
}

function empty(text){ return `<div class="mini-card"><small>${escapeHTML(text)}</small></div>`; }
function badge(s){ const cls=isClosed({Status:s})?"done":["ติดขัด","รอเอกสาร","รอ Vendor"].includes(s)?"danger":s==="กำลังดำเนินการ"?"warn":""; return `<span class="badge ${cls}">${escapeHTML(s||"-")}</span>`; }
function table(headers, rows){ return `<thead><tr>${headers.map(h=>`<th>${escapeHTML(h)}</th>`).join("")}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join("")}</tr>`).join("")}</tbody>`; }


// ─── RENDER WAREHOUSE STATUS ──────────────────────────────────
function renderWarehouseStatus(){
  const q  = ($("#warehouseStatusSearch")?.value || "").toLowerCase();
  const st = $("#warehouseStatusFilter")?.value || "";
  fillSelect($("#warehouseStatusFilter"), ["",...(state.settings["Warehouse Status"]||[])], "ทุกสถานะ", false);

  const list = state.warehouses.filter(w =>
    (!st || w["Warehouse Status"] === st) && JSON.stringify(w).toLowerCase().includes(q)
  );

  $("#warehouseStatusGrid").innerHTML = list.map(w => {
    const tasks  = tasksForWarehouse(w["Warehouse ID"]);
    const pend   = pendingTasks(tasks);
    const od     = overdueTasks(tasks);
    const p      = avgProgress(tasks);
    const next   = pend.map(t => t["Due Date"]).filter(Boolean).sort()[0] || "-";
    return `<article class="warehouse-card">
      <div class="card-head">
        <div><h4 class="card-title">${escapeHTML(w["Warehouse Name"])}</h4>
        <div class="card-sub">${escapeHTML(w["Location / Zone"]||"-")} · Owner: ${escapeHTML(w.Owner||"-")}</div></div>
        <div class="progress-ring" style="--p:${p}" data-p="${p}%"></div>
      </div>
      <div class="tabs">
        <span class="badge">${escapeHTML(w["Warehouse Status"]||"-")}</span>
        <span class="badge warn">ค้าง ${pend.length}</span>
        <span class="badge danger">เลย ${od.length}</span>
        <span class="badge">Due ถัดไป ${next}</span>
      </div>
      <div class="pending-list">${pend.slice(0,4).map(t => `
        <div class="pending-item">
          <b>${escapeHTML(t["Task Name"])}</b>
          <small>${escapeHTML(t["Task ID"])} · ${escapeHTML(t.Status)} · Due ${t["Due Date"]||"-"}</small>
          <div class="row-actions"><button class="tiny-btn orange" onclick="quickStatus('${escapeAttr(t["Task ID"])}')">แก้สถานะ</button></div>
        </div>`).join("") || "<small>ไม่มีงานค้าง</small>"}
      </div>
      <div class="button-row" style="margin-top:14px">
        <button class="tiny-btn orange" onclick="openProfile('${escapeAttr(w["Warehouse ID"])}')">ดูโปรไฟล์</button>
        <button class="tiny-btn" onclick="prefillTaskWarehouse('${escapeAttr(w["Warehouse ID"])}')">เพิ่มงาน</button>
        <button class="tiny-btn red" onclick="deleteRecord('Warehouses','${escapeAttr(w["Warehouse ID"])}')">ลบคลัง</button>
      </div>
    </article>`;
  }).join("") || empty("ยังไม่มีคลัง");
}


// ─── RENDER PROFILES ─────────────────────────────────────────
function renderProfiles(){
  const q    = ($("#profileSearch")?.value || "").toLowerCase();
  const list = state.warehouses.filter(w => JSON.stringify(w).toLowerCase().includes(q));
  $("#profileCards").innerHTML = list.map(w => {
    const tasks = tasksForWarehouse(w["Warehouse ID"]);
    return `<article class="profile-card" onclick="openProfile('${escapeAttr(w["Warehouse ID"])}')">
      <h4 class="card-title">${escapeHTML(w["Warehouse Name"])}</h4>
      <div class="card-sub">${escapeHTML(w["Location / Zone"]||"-")} · ${escapeHTML(w.Owner||"-")}</div>
      <div class="tabs">
        <span class="badge">${escapeHTML(w["Warehouse Status"]||"-")}</span>
        <span class="badge warn">งานค้าง ${pendingTasks(tasks).length}</span>
        <span class="badge">เอกสาร ${state.documents.filter(d => d["Warehouse ID"] === w["Warehouse ID"]).length}</span>
      </div>
    </article>`;
  }).join("") || empty("ยังไม่มีโปรไฟล์คลัง");
}

function openProfile(id){
  state.selectedWarehouseId = id;
  localStorage.setItem("spx_selected_wh", id);
  showView("profiles");
  const w      = whById(id);
  const tasks  = tasksForWarehouse(id);
  const docs   = state.documents.filter(d => d["Warehouse ID"] === id);
  const events = state.calendar.filter(e => e["Warehouse ID"] === id);
  const issues = state.issues.filter(i => i["Warehouse ID"] === id);
  const detail = $("#profileDetail");
  detail.classList.remove("hidden");
  detail.innerHTML = `<section class="panel">
    <div class="panel-head split">
      <div><h3>${escapeHTML(w["Warehouse Name"])}</h3><span>${escapeHTML(w["Location / Zone"]||"-")} · Owner: ${escapeHTML(w.Owner||"-")}</span></div>
      <div class="progress-ring" style="--p:${avgProgress(tasks)}" data-p="${avgProgress(tasks)}%"></div>
    </div>
    <div class="kpi-grid">
      <article class="kpi"><p>งานทั้งหมด</p><strong>${tasks.length}</strong></article>
      <article class="kpi"><p>งานค้าง</p><strong>${pendingTasks(tasks).length}</strong></article>
      <article class="kpi danger"><p>เลยกำหนด</p><strong>${overdueTasks(tasks).length}</strong></article>
      <article class="kpi"><p>เอกสาร</p><strong>${docs.length}</strong></article>
      <article class="kpi"><p>แผนงาน</p><strong>${events.length}</strong></article>
      <article class="kpi danger"><p>Issues</p><strong>${issues.filter(i => i.Status !== "Closed").length}</strong></article>
    </div>
    <div class="grid-2">
      <div><h3>งานของคลังนี้</h3>${tasks.map(taskMini).join("") || empty("ไม่มีงาน")}</div>
      <div><h3>เอกสารของคลังนี้</h3>${docs.map(d => `
        <div class="mini-card">
          <div><b>${escapeHTML(d["Document Name"])}</b>
          <small>${escapeHTML(d["Document Type"])} · ${escapeHTML(d["Document Status"]||"-")}</small></div>
          <a class="tiny-btn orange" href="${escapeAttr(d["File Link"]||"#")}" target="_blank">เปิด</a>
        </div>`).join("") || empty("ไม่มีเอกสาร")}
      </div>
    </div>
  </section>`;
  detail.scrollIntoView({ behavior:"smooth", block:"start" });
}


// ─── RENDER TASKS ────────────────────────────────────────────
function renderTasks(){
  const q  = ($("#taskSearch")?.value || "").toLowerCase();
  const wh = $("#taskWarehouseFilter")?.value || "";
  const st = $("#taskStatusFilter")?.value   || "";
  const rows = state.tasks.filter(t =>
    (!wh || t["Warehouse ID"] === wh) &&
    (!st || t.Status === st) &&
    JSON.stringify(t).toLowerCase().includes(q)
  );
  $("#tasksTable").innerHTML = table(
    ["Task ID","คลัง","ชื่องาน","Owner","Status","Priority","Due","Progress","Actions"],
    rows.map(t => [
      escapeHTML(t["Task ID"]),
      escapeHTML(whName(t["Warehouse ID"])),
      escapeHTML(t["Task Name"]),
      escapeHTML(t.Assignee||"-"),
      badge(t.Status),
      escapeHTML(t.Priority||"-"),
      t["Due Date"]||"-",
      `${t["Progress %"]||0}%`,
      `<div class="row-actions">
        <button class="tiny-btn orange" onclick="quickStatus('${escapeAttr(t["Task ID"])}')">แก้</button>
        <button class="tiny-btn red" onclick="deleteRecord('Tasks','${escapeAttr(t["Task ID"])}')">ลบ</button>
      </div>`
    ])
  );
}


// ─── RENDER DOCUMENTS ────────────────────────────────────────
function renderDocuments(){
  const q          = ($("#documentSearch")?.value || "").toLowerCase();
  const whFilter   = $("#documentWarehouseFilter")?.value || "";
  const typeFilter = $("#documentTypeFilter")?.value      || "";

  fillSelectObj($("#documentWarehouseFilter"),
    [{value:"", label:"ทุกคลัง"}, ...state.warehouses.map(w => ({value:w["Warehouse ID"], label:`${w["Warehouse Name"]} (${w["Warehouse ID"]})`}))],
    "ทุกคลัง", false);
  fillSelect($("#documentTypeFilter"), ["",...(state.settings["Document Type"]||[])], "ทุกประเภท", false);

  const docs = state.documents.filter(d => {
    const matchText = JSON.stringify(d).toLowerCase().includes(q);
    const matchWh   = !whFilter   || d["Warehouse ID"]   === whFilter;
    const matchType = !typeFilter || d["Document Type"]  === typeFilter;
    return matchText && matchWh && matchType;
  });

  const grouped = {};
  state.warehouses.forEach(w => {
    grouped[w["Warehouse ID"]] = { warehouse:w, docs:docs.filter(d => d["Warehouse ID"] === w["Warehouse ID"]) };
  });
  const unlinked = docs.filter(d => !state.warehouses.some(w => w["Warehouse ID"] === d["Warehouse ID"]));
  if(unlinked.length) grouped.__unlinked = {
    warehouse: {"Warehouse ID":"","Warehouse Name":"เอกสารที่ยังไม่ผูกคลัง","Location / Zone":"Unlinked"},
    docs: unlinked
  };

  const visible = Object.values(grouped).filter(g => g.docs.length || (!whFilter && !q && !typeFilter));

  $("#documentsWarehouseHub").innerHTML = visible.map(g => {
    const w          = g.warehouse;
    const byType     = {};
    g.docs.forEach(d => { const type = d["Document Type"] || "ไม่ระบุประเภท"; (byType[type] ||= []).push(d); });
    const completion = calcDocumentCompletion(g.docs);
    const taskCount  = new Set(g.docs.map(d => d["Task ID"]).filter(Boolean)).size;
    return `<article class="doc-warehouse-card">
      <div class="doc-warehouse-head">
        <div><h4>${escapeHTML(w["Warehouse Name"])}</h4>
        <p>${escapeHTML(w["Location / Zone"]||"-")} · ${escapeHTML(w["Warehouse ID"]||"-")}</p></div>
        <div class="doc-score" style="--p:${completion}"><strong>${completion}%</strong><span>DOCS</span></div>
      </div>
      <div class="doc-stats">
        <span>📁 เอกสาร ${g.docs.length}</span>
        <span>🔗 ผูกงาน ${taskCount}</span>
        <span>✅ ผ่าน ${g.docs.filter(d => d["Document Status"]==="ผ่าน").length}</span>
        <span>🕒 รอตรวจ ${g.docs.filter(d => d["Document Status"]==="รอตรวจสอบ").length}</span>
      </div>
      <div class="doc-type-groups">
        ${Object.keys(byType).length
          ? Object.entries(byType).map(([type,items]) => `
            <details class="doc-type-block" open>
              <summary><b>${escapeHTML(type)}</b><span>${items.length} ไฟล์</span></summary>
              <div class="doc-files">${items.map(documentCard).join("")}</div>
            </details>`).join("")
          : `<div class="empty-doc-box">ยังไม่มีเอกสารของคลังนี้</div>`}
      </div>
      <div class="button-row">
        <button class="tiny-btn orange" onclick="prefillDocumentWarehouse('${escapeAttr(w["Warehouse ID"]||"")}')">+ เพิ่มเอกสารคลังนี้</button>
        <button class="tiny-btn" onclick="openProfile('${escapeAttr(w["Warehouse ID"]||"")}')">ดูโปรไฟล์คลัง</button>
      </div>
    </article>`;
  }).join("") || empty("ยังไม่มีเอกสาร");

  const oldList = $("#documentsList");
  if(oldList) oldList.innerHTML = docs.map(documentCard).join("") || empty("ยังไม่มีเอกสาร");
}

function documentCard(d){
  const status      = d["Document Status"] || "-";
  const statusClass = status==="ผ่าน" ? "done" : status==="ต้องแก้ไข" ? "danger" : "warn";
  return `<div class="doc-file-card">
    <div>
      <b>${escapeHTML(d["Document Name"]||"-")}</b>
      <small>${escapeHTML(d["Document ID"]||"-")} · Task ${escapeHTML(d["Task ID"]||"-")} · ${d["Uploaded Date"]||"-"}</small>
      ${d.Notes ? `<p>${escapeHTML(d.Notes)}</p>` : ""}
    </div>
    <div class="doc-actions">
      <span class="badge ${statusClass}">${escapeHTML(status)}</span>
      <a class="tiny-btn orange" target="_blank" href="${escapeAttr(d["File Link"]||"#")}">เปิดไฟล์</a>
      <button class="tiny-btn red" onclick="deleteRecord('Documents','${escapeAttr(d["Document ID"])}')">ลบ</button>
    </div>
  </div>`;
}

function calcDocumentCompletion(docs){
  if(!docs.length) return 0;
  return Math.round(docs.filter(d => d["Document Status"] === "ผ่าน").length / docs.length * 100);
}

function prefillDocumentWarehouse(id){
  showView("documents");
  const sel = $("#docWarehouseSelect");
  if(sel) sel.value = id;
  setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior:"smooth" }), 150);
}


// ─── RENDER CALENDAR ─────────────────────────────────────────
function renderCalendar(){
  const monthInput = $("#calendarMonth");
  if(monthInput) monthInput.value = state.calendarCursor;

  const [y,m] = state.calendarCursor.split("-").map(Number);
  const first  = new Date(y, m-1, 1);
  const start  = new Date(first); start.setDate(1 - first.getDay());

  const names = ["อา","จ","อ","พ","พฤ","ศ","ส"];
  let html = names.map(n => `<div class="cal-day-name">${n}</div>`).join("");

  const eventsByDate = {};
  const combined = [
    ...state.calendar,
    ...state.tasks.map(t => ({
      "Event ID": t["Task ID"], "Warehouse ID": t["Warehouse ID"], "Task ID": t["Task ID"],
      "Event Title": t["Task Name"], "Event Type":"Task Due", "Due Date":t["Due Date"],
      "Assignee":t.Assignee, Status:t.Status
    }))
  ];
  combined.forEach(e => {
    const d = fmtDate(e["Due Date"] || e["Start Date"]);
    if(!d) return;
    (eventsByDate[d] ||= []).push(e);
  });

  for(let i=0; i<42; i++){
    const d   = new Date(start); d.setDate(start.getDate() + i);
    const iso = d.toISOString().slice(0,10);
    const arr = eventsByDate[iso] || [];
    html += `<div class="cal-cell ${d.getMonth() !== m-1 ? "other" : ""}" onclick="selectCalendarDay('${iso}')">
      <div class="cal-date">${d.getDate()}</div>
      ${arr.slice(0,3).map(e => `
        <div class="cal-event ${daysDiff(iso)<0?"overdue":iso===todayISO()?"today":""}"
          onclick="event.stopPropagation(); openEventDetail('${escapeAttr(e["Event ID"]||"")}','${escapeAttr(e["Task ID"]||"")}')">
          ${escapeHTML(e["Event Title"]||"")}
        </div>`).join("")}
      ${arr.length > 3 ? `<small>+${arr.length-3} more</small>` : ""}
    </div>`;
  }
  $("#monthCalendar").innerHTML = html;
  renderSelectedDay();
}

function selectCalendarDay(iso){ state.selectedCalendarDate = iso; renderSelectedDay(); }

function renderSelectedDay(){
  const title = $("#selectedDayTitle");
  if(title) title.textContent = state.selectedCalendarDate || "เลือกวันที่";

  const arr = [
    ...state.calendar,
    ...state.tasks.map(t => ({
      "Event ID":t["Task ID"],"Task ID":t["Task ID"],"Warehouse ID":t["Warehouse ID"],
      "Event Title":t["Task Name"],"Event Type":"Task Due","Due Date":t["Due Date"],"Assignee":t.Assignee
    }))
  ].filter(e => fmtDate(e["Due Date"] || e["Start Date"]) === state.selectedCalendarDate);

  $("#selectedDayEvents").innerHTML = arr.map(e => `
    <div class="mini-card">
      <div><b>${escapeHTML(e["Event Title"])}</b>
      <small>${escapeHTML(whName(e["Warehouse ID"]))} · ${escapeHTML(e["Event Type"]||"")}</small></div>
      ${e["Task ID"] ? `<button class="tiny-btn orange" onclick="quickStatus('${escapeAttr(e["Task ID"])}')">งาน</button>` : ""}
    </div>`).join("") || empty("วันนี้ไม่มีแผนงาน");
}

function changeMonth(n){
  const [y,m] = state.calendarCursor.split("-").map(Number);
  const d = new Date(y, m-1+n, 1);
  state.calendarCursor = d.toISOString().slice(0,7);
  renderCalendar();
}

function openEventDetail(id, taskId){ if(taskId) quickStatus(taskId); }


// ─── RENDER ISSUES ───────────────────────────────────────────
function renderIssues(){
  $("#issuesList").innerHTML = state.issues.map(i => `
    <div class="mini-card">
      <div><b>${escapeHTML(i["Issue Title"])}</b>
      <small>${escapeHTML(whName(i["Warehouse ID"]))} · ${escapeHTML(i.Status||"")} · ${escapeHTML(i.Priority||"-")}</small></div>
      <button class="tiny-btn red" onclick="deleteRecord('Issues','${escapeAttr(i["Issue ID"])}')">ลบ</button>
    </div>`).join("") || empty("ยังไม่มี Issue");
}


// ─── RENDER CHECKLIST ────────────────────────────────────────
function renderChecklist(){
  ensureDefaultSettings();
  const caseFilter = $("#checklistCaseFilter")?.value || "";
  const templates  = normalizeChecklistTemplates(state.checklistTemplates).filter(t => {
    const active    = String(t.Active || "TRUE").toUpperCase() !== "FALSE";
    const matchCase = !caseFilter || (t["Case Type"] || "Standard") === caseFilter;
    return active && matchCase;
  });

  $("#checklistTemplates").innerHTML = templates.map(t => {
    const tid = t["Template ID"] || "";
    return `<div class="template-card checklist-template-card">
      <div class="template-top">
        <span class="badge">${escapeHTML(t["Case Type"]||"Standard")}</span>
        <span class="badge ${t.Active==="FALSE"?"danger":"done"}">${t.Active==="FALSE"?"Inactive":"Active"}</span>
      </div>
      <h4>${escapeHTML(t["Task Name"]||"-")}</h4>
      <small>${escapeHTML(t.Phase||"-")} · ${escapeHTML(t.Priority||"-")} · Due +${t["Default Due Offset Days"]||0} วัน</small>
      <p>${escapeHTML(t.Notes||"")}</p>
      <div class="template-meta">
        <span>👤 ${escapeHTML(t["Default Assignee"]||"ไม่ระบุ")}</span>
        <span>📎 ${escapeHTML(t["Document Required"]||"ไม่บังคับเอกสาร")}</span>
      </div>
      <div class="button-row">
        <button class="tiny-btn orange" onclick="editChecklistTemplate('${escapeAttr(tid)}')">แก้ไข</button>
        <button class="tiny-btn" onclick="duplicateChecklistTemplate('${escapeAttr(tid)}')">ทำสำเนา</button>
        <button class="tiny-btn red" onclick="deleteChecklistTemplate('${escapeAttr(tid)}')">ลบ</button>
      </div>
    </div>`;
  }).join("") || empty("ยังไม่มี Checklist Template ในเคสนี้ กด + เพิ่ม Template ใหม่");
}

function openNewChecklistTemplateForm(){
  renderDropdowns();
  const form = $("#checklistTemplateForm");
  form.reset(); form.elements.templateId.value = "";
  $("#checklistTemplateFormTitle").textContent = "เพิ่ม Checklist Template";
  form.classList.remove("hidden");
  form.scrollIntoView({ behavior:"smooth", block:"start" });
}

function closeChecklistTemplateForm(){ $("#checklistTemplateForm").classList.add("hidden"); }

function editChecklistTemplate(templateId){
  renderDropdowns();
  const t = normalizeChecklistTemplates(state.checklistTemplates).find(x => x["Template ID"] === templateId);
  if(!t) return toast("ไม่พบ Template");
  const form = $("#checklistTemplateForm");
  form.elements.templateId.value      = t["Template ID"]             || "";
  form.elements.caseType.value        = t["Case Type"]               || "Standard";
  form.elements.phase.value           = t.Phase                      || "";
  form.elements.taskName.value        = t["Task Name"]               || "";
  form.elements.defaultAssignee.value = t["Default Assignee"]        || "";
  form.elements.priority.value        = t.Priority                   || "";
  form.elements.defaultStatus.value   = t["Default Status"]          || "To Do";
  form.elements.dueOffset.value       = t["Default Due Offset Days"] || 7;
  form.elements.documentRequired.value= t["Document Required"]       || "";
  form.elements.active.value          = String(t.Active||"TRUE").toUpperCase()==="FALSE" ? "FALSE" : "TRUE";
  form.elements.notes.value           = t.Notes                      || "";
  $("#checklistTemplateFormTitle").textContent = "แก้ไข Checklist Template";
  form.classList.remove("hidden");
  form.scrollIntoView({ behavior:"smooth", block:"start" });
}

function duplicateChecklistTemplate(templateId){
  renderDropdowns();
  const t = normalizeChecklistTemplates(state.checklistTemplates).find(x => x["Template ID"] === templateId);
  if(!t) return toast("ไม่พบ Template");
  openNewChecklistTemplateForm();
  const form = $("#checklistTemplateForm");
  form.elements.caseType.value         = t["Case Type"]               || "Standard";
  form.elements.phase.value            = t.Phase                      || "";
  form.elements.taskName.value         = (t["Task Name"]||"") + " (Copy)";
  form.elements.defaultAssignee.value  = t["Default Assignee"]        || "";
  form.elements.priority.value         = t.Priority                   || "";
  form.elements.defaultStatus.value    = t["Default Status"]          || "To Do";
  form.elements.dueOffset.value        = t["Default Due Offset Days"] || 7;
  form.elements.documentRequired.value = t["Document Required"]       || "";
  form.elements.active.value           = "TRUE";
  form.elements.notes.value            = t.Notes                      || "";
}

async function deleteChecklistTemplate(templateId){
  if(!confirm("ลบ Checklist Template นี้?")) return;
  try{
    await api("deleteChecklistTemplate", { templateId, user:CONFIG.defaultUser });
    toast("ลบ Template แล้ว");
    await loadAllData();
  } catch(err){
    console.error(err);
    toast("ลบ Template ไม่สำเร็จ: " + err.message);
  }
}

async function submitChecklistTemplate(e){
  e.preventDefault();
  const d = dataFromForm(e.target);
  const payload = {
    "Template ID":             d.templateId || uid("TPL"),
    "Phase":                   d.phase,
    "Task Name":               d.taskName,
    "Default Assignee":        d.defaultAssignee,
    "Priority":                d.priority    || "กลาง",
    "Default Status":          d.defaultStatus || "To Do",
    "Default Due Offset Days": d.dueOffset   || "7",
    "Document Required":       d.documentRequired || "",
    "Notes":                   d.notes,
    "Case Type":               d.caseType,
    "Active":                  d.active
  };
  try{
    await api(d.templateId ? "updateChecklistTemplate" : "addChecklistTemplate",
      { template:payload, user:CONFIG.defaultUser });
    toast("บันทึก Checklist Template แล้ว");
    closeChecklistTemplateForm();
    await loadAllData();
  } catch(err){
    console.error(err);
    toast("บันทึก Template ไม่สำเร็จ: " + err.message);
  }
}


// ─── RENDER DAILY REPORT ─────────────────────────────────────
function renderDailyReport(){
  const el = $("#dailyReport");
  if(!el) return;

  const today      = todayISO();
  const allTasks   = state.tasks;
  const overdueArr = overdueTasks(allTasks);
  const dueSoonArr = dueSoonTasks(allTasks).filter(t => daysDiff(t["Due Date"]) !== null && daysDiff(t["Due Date"]) >= 0);
  const closedToday= allTasks.filter(t => fmtDate(t["Closed Date"]) === today);
  const openIssues = state.issues.filter(i => i.Status !== "Closed");

  const thDate = new Intl.DateTimeFormat("th-TH", { timeZone:"Asia/Bangkok", dateStyle:"full" }).format(new Date());
  const thTime = new Intl.DateTimeFormat("th-TH", { timeZone:"Asia/Bangkok", timeStyle:"medium" }).format(new Date());
  const line   = "─".repeat(50);

  let r = "";
  r += `📋 SPX CLOSURE DAILY REPORT\n`;
  r += `📅 ${today}  |  ${thDate}\n`;
  r += `${line}\n\n`;

  r += `📊 ภาพรวม\n`;
  r += `• คลังทั้งหมด      : ${state.warehouses.length} แห่ง\n`;
  r += `• งานทั้งหมด       : ${allTasks.length} รายการ\n`;
  r += `• งานปิดแล้ว       : ${allTasks.filter(isClosed).length} รายการ\n`;
  r += `• ความคืบหน้าเฉลี่ย: ${avgProgress(allTasks)}%\n\n`;

  r += `🔥 งานเลยกำหนด (${overdueArr.length} รายการ)\n`;
  if(overdueArr.length){
    overdueArr.forEach(t => {
      const d = daysDiff(t["Due Date"]);
      r += `  ❌ [${t["Task ID"]}] ${t["Task Name"]}\n`;
      r += `     คลัง: ${whName(t["Warehouse ID"])}  |  Due: ${t["Due Date"]}  |  เลย ${Math.abs(d)} วัน  |  ${t.Assignee||"-"}\n`;
    });
  } else {
    r += `  ✅ ไม่มีงานเลยกำหนด\n`;
  }
  r += "\n";

  r += `⏰ งานที่ต้องตาม (${dueSoonArr.length} รายการ)\n`;
  if(dueSoonArr.length){
    dueSoonArr.forEach(t => {
      const d = daysDiff(t["Due Date"]);
      r += `  ⚠️  [${t["Task ID"]}] ${t["Task Name"]}\n`;
      r += `     คลัง: ${whName(t["Warehouse ID"])}  |  Due: ${t["Due Date"]}  |  อีก ${d} วัน  |  ${t.Status}\n`;
    });
  } else {
    r += `  ✅ ไม่มีงานที่ใกล้ครบกำหนด\n`;
  }
  r += "\n";

  if(closedToday.length){
    r += `✅ ปิดงานวันนี้ (${closedToday.length} รายการ)\n`;
    closedToday.forEach(t => {
      r += `  ✔️  [${t["Task ID"]}] ${t["Task Name"]}  |  ${whName(t["Warehouse ID"])}\n`;
    });
    r += "\n";
  }

  if(openIssues.length){
    r += `🚨 Issues ที่ยังเปิดอยู่ (${openIssues.length} รายการ)\n`;
    openIssues.forEach(i => {
      r += `  ⚡ [${i["Issue ID"]}] ${i["Issue Title"]}\n`;
      r += `     คลัง: ${whName(i["Warehouse ID"])}  |  ${i.Priority||"-"}  |  ${i.Status}\n`;
    });
    r += "\n";
  }

  r += `${line}\n`;
  r += `Generated by SPX Closure Control Tower V3.4.6\n`;
  r += `🕐 ${thTime}`;

  el.textContent = r;
}


// ─── RENDER ACTIVITY & TRASH ─────────────────────────────────
function renderActivity(){
  $("#activityTable").innerHTML = table(
    ["Time","Action","Sheet","Record","Warehouse","User","Details"],
    state.activity.slice().reverse().map(a => [
      a.Timestamp||"", escapeHTML(a.Action||""), escapeHTML(a.Sheet||""),
      escapeHTML(a["Record ID"]||""), escapeHTML(a["Warehouse ID"]||""),
      escapeHTML(a.User||""), escapeHTML(a.Details||"")
    ])
  );
}

function renderTrash(){
  $("#trashTable").innerHTML = table(
    ["Time","Source","Record","Warehouse","Deleted By","Reason"],
    state.trash.slice().reverse().map(a => [
      a.Timestamp||"", escapeHTML(a["Source Sheet"]||""), escapeHTML(a["Record ID"]||""),
      escapeHTML(a["Warehouse ID"]||""), escapeHTML(a["Deleted By"]||""), escapeHTML(a.Reason||"")
    ])
  );
}


// ─── RENDER SETTINGS GRID ────────────────────────────────────
function renderSettingsGrid(){
  const keys      = getSettingKeys();
  const catSelect = $("#settingCategorySelect");
  if(catSelect){
    const old = catSelect.value;
    catSelect.innerHTML = keys.map(k => `<option value="${escapeAttr(k)}">${escapeHTML(settingLabel(k))}</option>`).join("");
    catSelect.value = keys.includes(old) ? old : (keys[0] || "");
  }
  $("#settingsGrid").innerHTML = keys.map(k => {
    const arr = state.settings[k] || [];
    return `<div class="template-card setting-category-card" onclick="selectSettingCategory('${escapeAttr(k)}')">
      <div class="setting-card-head"><h4>${escapeHTML(settingLabel(k))}</h4><span>${arr.length} รายการ</span></div>
      <p>${arr.slice(0,8).map(v => `<b>${escapeHTML(v)}</b>`).join("<br>") || "ยังไม่มีข้อมูล"}</p>
      ${arr.length > 8 ? `<small>+${arr.length-8} รายการ</small>` : ""}
    </div>`;
  }).join("");
  renderSettingOptionList();
}

function getSettingKeys(){
  const preferred = ["Task Status","Priority","Warehouse Status","Phase","Document Type","Document Status","Event Type","Calendar Status"];
  const existing  = Object.keys(state.settings || {});
  return [...new Set([...preferred, ...existing])].filter(Boolean);
}

function settingLabel(key){
  const labels = {
    "Task Status":"สถานะงาน","Priority":"ความสำคัญ","Warehouse Status":"สถานะคลัง",
    "Phase":"เฟสงาน","Document Type":"ประเภทเอกสาร","Document Status":"สถานะเอกสาร",
    "Event Type":"ประเภทแผนงาน","Calendar Status":"สถานะปฏิทิน"
  };
  return labels[key] || key;
}

function selectSettingCategory(key){
  const sel = $("#settingCategorySelect");
  if(sel){ sel.value = key; renderSettingOptionList(); }
  $(".settings-active-box")?.scrollIntoView({ behavior:"smooth", block:"nearest" });
}

function renderSettingOptionList(){
  const key  = $("#settingCategorySelect")?.value || getSettingKeys()[0];
  const list = state.settings[key] || [];
  const title = $("#settingActiveTitle");
  if(title) title.textContent = `${settingLabel(key)} (${key})`;
  const box = $("#settingOptionList");
  if(!box) return;
  box.innerHTML = list.length
    ? list.map(v => `
      <div class="setting-option-pill">
        <span>${escapeHTML(v)}</span>
        <button type="button" onclick="deleteSettingOptionFromUI('${escapeAttr(key)}','${escapeAttr(v)}')">ลบ</button>
      </div>`).join("")
    : `<div class="empty-doc-box">ยังไม่มีตัวเลือกในหมวดนี้</div>`;
}

async function addSettingOptionFromUI(){
  const category = $("#settingCategorySelect")?.value;
  const value    = ($("#settingNewValueInput")?.value || "").trim();
  if(!category) return toast("กรุณาเลือกหมวด Settings");
  if(!value)    return toast("กรุณากรอกค่าที่ต้องการเพิ่ม");
  try{
    await api("addSettingOption", { category, value, user:CONFIG.defaultUser });
    $("#settingNewValueInput").value = "";
    toast("เพิ่มตัวเลือกแล้ว");
    await loadAllData();
  } catch(err){ console.error(err); toast("เพิ่มตัวเลือกไม่สำเร็จ: " + err.message); }
}

async function deleteSettingOptionFromUI(category, value){
  if(!confirm(`ลบ "${value}" ออกจาก ${settingLabel(category)} ?`)) return;
  try{
    await api("deleteSettingOption", { category, value, user:CONFIG.defaultUser });
    toast("ลบตัวเลือกแล้ว");
    await loadAllData();
  } catch(err){ console.error(err); toast("ลบตัวเลือกไม่สำเร็จ: " + err.message); }
}


// ─── RENDER DROPDOWNS ────────────────────────────────────────
function renderDropdowns(){
  ensureDefaultSettings();

  $$("[data-setting]").forEach(sel => {
    const key = sel.dataset.setting;
    const arr = state.settings[key] || [];
    fillSelect(sel, arr, key);
  });

  const whOpts = state.warehouses.map(w => ({
    value: w["Warehouse ID"],
    label: `${w["Warehouse Name"] || w["Warehouse ID"]} (${w["Warehouse ID"]})`
  }));

  ["taskWarehouseSelect","docWarehouseSelect","calWarehouseSelect","issueWarehouseSelect","checklistWarehouseSelect"].forEach(id => {
    fillSelectObj($("#" + id), whOpts, "เลือกคลัง");
  });

  fillSelectObj($("#taskWarehouseFilter"), [{value:"",label:"ทุกคลัง"},...whOpts], "ทุกคลัง", false);
  fillSelect($("#taskStatusFilter"), ["",...(state.settings["Task Status"]||[])], "ทุกสถานะ", false);

  const docWhFilter = $("#documentWarehouseFilter");
  if(docWhFilter) fillSelectObj(docWhFilter, [{value:"",label:"ทุกคลัง"},...whOpts], "ทุกคลัง", false);

  const docTypeFilter = $("#documentTypeFilter");
  if(docTypeFilter) fillSelect(docTypeFilter, ["",...(state.settings["Document Type"]||[])], "ทุกประเภท", false);

  const whStatusFilter = $("#warehouseStatusFilter");
  if(whStatusFilter) fillSelect(whStatusFilter, ["",...(state.settings["Warehouse Status"]||[])], "ทุกสถานะ", false);

  const caseSelect = $("#checklistCaseFilter");
  if(caseSelect){
    const old       = caseSelect.value;
    const caseTypes = ["", ...new Set(["Standard","Urgent","Small Site","Large Warehouse","Custom",
      ...normalizeChecklistTemplates(state.checklistTemplates).map(t => t["Case Type"] || "Standard")])];
    caseSelect.innerHTML = caseTypes.map(v => `<option value="${escapeAttr(v)}">${v || "ทุกเคส"}</option>`).join("");
    if(caseTypes.includes(old)) caseSelect.value = old;
  }
}

function fillSelect(sel, arr, placeholder="เลือก", clear=true){
  if(!sel) return;
  const old  = sel.value;
  const safe = [...new Set((arr||[]).map(v => String(v||"").trim()).filter(v => v !== ""))];
  sel.innerHTML =
    (clear ? `<option value="">${escapeHTML(placeholder)}</option>` : "") +
    safe.map(v => `<option value="${escapeAttr(v)}">${escapeHTML(v)}</option>`).join("");
  if([...sel.options].some(o => o.value === old)) sel.value = old;
}

function fillSelectObj(sel, arr, placeholder="เลือก", clear=true){
  if(!sel) return;
  const old  = sel.value;
  const safe = arr || [];
  sel.innerHTML =
    (clear ? `<option value="">${escapeHTML(placeholder)}</option>` : "") +
    safe.map(o => `<option value="${escapeAttr(o.value)}">${escapeHTML(o.label)}</option>`).join("");
  if([...sel.options].some(o => o.value === old)) sel.value = old;
}


// ─── FORM SUBMISSIONS ────────────────────────────────────────

async function submitWarehouse(e){
  e.preventDefault();
  const d = dataFromForm(e.target);
  if(!d.warehouseName) return toast("กรุณากรอกชื่อคลัง");
  const payload = {
    "Warehouse ID":           uid("WH"),
    "Warehouse Name":         d.warehouseName,
    "Location / Zone":        d.location      || "",
    "Owner":                  d.owner         || "",
    "Owner Phone":            d.ownerPhone    || "",
    "Start Date":             d.startDate     || "",
    "Target Handover Date":   d.targetDate    || "",
    "Warehouse Status":       d.status        || "ยังไม่เริ่ม",
    "Document Folder Link":   d.folderLink    || "",
    "Notes":                  d.notes         || "",
    "Created At":             todayISO(),
    "Updated At":             todayISO(),
    user: CONFIG.defaultUser
  };
  await postAndRefresh("addWarehouse", payload, "เพิ่มคลังแล้ว ✅");
  e.target.reset();
  saveFormMemory(e.target, "warehouse");
}

async function submitTask(e){
  e.preventDefault();
  const d = dataFromForm(e.target);
  if(!d.warehouseId) return toast("กรุณาเลือกคลัง");
  if(!d.taskName)    return toast("กรุณากรอกชื่องาน");
  const task = {
    "Task ID":       uid("T"),
    "Created Date":  todayISO(),
    "Warehouse ID":  d.warehouseId,
    "Phase":         d.phase         || "",
    "Task Name":     d.taskName,
    "Assignee":      d.assignee      || "",
    "Status":        d.status        || "To Do",
    "Priority":      d.priority      || "กลาง",
    "Due Date":      d.dueDate       || "",
    "Progress %":    d.progress      || 0,
    "Closed Date":   "",
    "Evidence Link": d.evidenceLink  || "",
    "Last Updated":  todayISO(),
    "Notes":         d.notes         || ""
  };
  const createCalendar = !!e.target.elements.createCalendar?.checked;
  await postAndRefresh("addTask", { task, createCalendar, user:CONFIG.defaultUser }, "เพิ่มงานแล้ว ✅");
  saveFormMemory(e.target, "task");
  e.target.reset();
}

async function submitDocument(e){
  e.preventDefault();
  const d = dataFromForm(e.target);
  if(!d.docName) return toast("กรุณากรอกชื่อเอกสาร");
  const payload = {
    "Document ID":     uid("DOC"),
    "Warehouse ID":    d.warehouseId  || "",
    "Task ID":         d.taskId       || "",
    "Document Type":   d.docType      || "",
    "Document Name":   d.docName,
    "File Link":       d.fileLink     || "",
    "Document Status": d.docStatus    || "รอตรวจสอบ",
    "Uploaded By":     d.uploadedBy   || CONFIG.defaultUser,
    "Uploaded Date":   todayISO(),
    "Notes":           d.notes        || "",
    user: CONFIG.defaultUser
  };
  await postAndRefresh("addDocument", payload, "เพิ่มเอกสารแล้ว ✅");
  e.target.reset();
}

async function submitCalendarEvent(e){
  e.preventDefault();
  const d = dataFromForm(e.target);
  if(!d.eventTitle) return toast("กรุณากรอกชื่อกิจกรรม");
  if(!d.dueDate)    return toast("กรุณาระบุ Due Date");
  const payload = {
    "Event ID":       uid("EV"),
    "Warehouse ID":   d.warehouseId  || "",
    "Task ID":        d.taskId       || "",
    "Event Title":    d.eventTitle,
    "Event Type":     d.eventType    || "กำหนดส่งงาน",
    "Start Date":     d.startDate    || todayISO(),
    "Due Date":       d.dueDate,
    "Assignee":       d.assignee     || "",
    "Reminder Days":  d.reminderDays || 2,
    "Calendar Status":"ยังไม่เตือน",
    "Notes":          d.notes        || "",
    user: CONFIG.defaultUser
  };
  await postAndRefresh("addCalendarEvent", payload, "เพิ่มแผนงานแล้ว ✅");
  e.target.reset();
}

async function submitIssue(e){
  e.preventDefault();
  const d = dataFromForm(e.target);
  if(!d.issueTitle) return toast("กรุณากรอก Issue Title");
  const payload = {
    "Issue ID":     uid("ISS"),
    "Warehouse ID": d.warehouseId || "",
    "Task ID":      d.taskId      || "",
    "Issue Title":  d.issueTitle,
    "Impact":       d.impact      || "",
    "Owner":        d.owner       || "",
    "Status":       d.status      || "Open",
    "Priority":     d.priority    || "กลาง",
    "Due Date":     d.dueDate     || "",
    "Solution":     d.solution    || "",
    "Created Date": todayISO(),
    "Closed Date":  "",
    "Notes":        d.notes       || "",
    user: CONFIG.defaultUser
  };
  await postAndRefresh("addIssue", payload, "เพิ่ม Issue แล้ว ✅");
  e.target.reset();
}


// ─── QUICK STATUS (Modal) ────────────────────────────────────
function quickStatus(taskId){
  const t = state.tasks.find(x => x["Task ID"] === taskId);
  if(!t) return toast("ไม่พบงาน " + taskId);

  const statusList = state.settings["Task Status"] ||
    ["Backlog","To Do","กำลังดำเนินการ","รอเอกสาร","รอ Vendor","ติดขัด","ปิดแล้ว"];

  const opts = statusList.map(s =>
    `<option value="${escapeAttr(s)}" ${t.Status === s ? "selected" : ""}>${escapeHTML(s)}</option>`
  ).join("");

  openModal(`
    <h3 style="margin:0 0 6px;font-size:22px">แก้ไขสถานะงาน</h3>
    <p style="color:#64748b;margin:0 0 20px;font-weight:700">${escapeHTML(t["Task ID"])} · ${escapeHTML(t["Task Name"])}<br>
    <small>คลัง: ${escapeHTML(whName(t["Warehouse ID"]))} | Due: ${t["Due Date"]||"-"}</small></p>
    <div class="form-grid one" style="gap:14px">
      <label style="display:flex;flex-direction:column;gap:7px;font-weight:900;color:#475569">สถานะ
        <select id="modalStatus">${opts}</select>
      </label>
      <label style="display:flex;flex-direction:column;gap:7px;font-weight:900;color:#475569">Progress %
        <input id="modalProgress" type="number" min="0" max="100" value="${t["Progress %"]||0}">
      </label>
      <label style="display:flex;flex-direction:column;gap:7px;font-weight:900;color:#475569">หมายเหตุ (optional)
        <input id="modalNote" placeholder="เพิ่มเติม…">
      </label>
    </div>
    <div class="button-row" style="margin-top:20px">
      <button class="primary-btn" onclick="updateStatus('${escapeAttr(taskId)}')">บันทึก</button>
      <button class="ghost-btn"   onclick="closeModal()">ยกเลิก</button>
    </div>
  `);
}

async function updateStatus(taskId){
  const status   = $("#modalStatus")?.value   || "";
  const progress = $("#modalProgress")?.value;
  const note     = $("#modalNote")?.value     || "";
  await postAndRefresh(
    "updateStatus",
    { taskId, status, progress: progress !== "" ? Number(progress) : null, note, user:CONFIG.defaultUser },
    "อัปเดตสถานะแล้ว ✅"
  );
  closeModal();
}

function prefillTaskWarehouse(id){
  showView("addTask");
  setTimeout(() => { const sel=$("#taskWarehouseSelect"); if(sel) sel.value=id; }, 100);
}


// ─── DELETE RECORD ───────────────────────────────────────────
async function deleteRecord(sheet, recordId){
  if(!confirm(`ยืนยันลบ ${recordId} จาก ${sheet}?\nข้อมูลจะถูกย้ายไป Trash`)) return;
  await postAndRefresh("deleteRecord", { sheet, recordId, user:CONFIG.defaultUser, reason:"Deleted from web" }, "ลบข้อมูลแล้ว");
}


// ─── CREATE CHECKLIST ────────────────────────────────────────
async function createChecklistForWarehouse(){
  const wh       = $("#checklistWarehouseSelect")?.value || "";
  const caseType = $("#checklistCaseFilter")?.value       || "";
  if(!wh) return toast("เลือกคลังก่อน");
  if(!confirm(`สร้าง Checklist ${caseType||"ทุกเคส"} ให้คลัง ${whName(wh)} ?\nจะสร้างงานตาม Template ที่ Active อยู่`)) return;
  await postAndRefresh("createChecklist", { warehouseId:wh, caseType, user:CONFIG.defaultUser }, "สร้าง Checklist แล้ว ✅");
}


// ─── SETTINGS PAGE ───────────────────────────────────────────
function initSettingsFields(){
  const si = $("#sheetIdInput");  if(si)  si.value  = CONFIG.spreadsheetId;
  const ai = $("#apiUrlInput");   if(ai)  ai.value  = CONFIG.apiUrl;
  const du = $("#defaultUserInput"); if(du) du.value = CONFIG.defaultUser;
  const ds = $("#dueSoonDaysInput"); if(ds) ds.value = CONFIG.dueSoonDays;
}

function saveSettings(e){
  if(e && e.preventDefault) e.preventDefault();
  const sheetId = ($("#sheetIdInput")?.value || "").trim();
  const apiUrl  = ($("#apiUrlInput")?.value  || "").trim();
  const user    = ($("#defaultUserInput")?.value || "").trim() || "System";
  const days    = Number($("#dueSoonDaysInput")?.value || 3);
  localStorage.setItem("spx_sheet_id",      sheetId);
  localStorage.setItem("spx_api_url",       apiUrl);
  localStorage.setItem("spx_default_user",  user);
  localStorage.setItem("spx_due_soon_days", days);
  Object.assign(CONFIG, { spreadsheetId:sheetId, apiUrl, defaultUser:user, dueSoonDays:days });
  toast("บันทึกการตั้งค่าแล้ว");
  loadAllData();
}

async function testApi(){
  try{
    await api("ping", {}, "GET");
    toast("✅ เชื่อมต่อ API สำเร็จ");
  } catch(err){
    toast("❌ เชื่อมต่อไม่สำเร็จ: " + err.message);
  }
}


// ─── FORM MEMORY ─────────────────────────────────────────────
function saveFormMemory(form, key){
  try{ localStorage.setItem("spx_memory_" + key, JSON.stringify(dataFromForm(form))); } catch(_){}
}

function loadMemoryIntoForms(){
  ["task","warehouse"].forEach(key => {
    try{
      const obj  = JSON.parse(localStorage.getItem("spx_memory_" + key) || "{}");
      const form = $("#" + (key === "task" ? "taskForm" : "warehouseForm"));
      if(form) Object.entries(obj).forEach(([k,v]) => { if(form.elements[k]) form.elements[k].value = v; });
    } catch(_){}
  });
}


// ─── DEMO / SEED DATA ────────────────────────────────────────
function seedDemo(){
  state.warehouses = [{"Warehouse ID":"WH-0001","Warehouse Name":"คลังตัวอย่าง","Location / Zone":"กรุงเทพฯ / Zone A","Owner":"Earth","Owner Phone":"","Warehouse Status":"กำลังปิดคลัง"}];
  state.tasks      = [{"Task ID":"T-0001","Created Date":todayISO(),"Warehouse ID":"WH-0001","Phase":"เฟส 1 · ตรวจสัญญาและแจ้งเลิก","Task Name":"ตรวจสัญญาเช่า","Assignee":"Earth","Status":"กำลังดำเนินการ","Priority":"สูง","Due Date":todayISO(),"Progress %":"30","Notes":"Demo task"}];
  state.documents  = []; state.calendar = []; state.activity = []; state.issues = []; state.trash = [];
  ensureDefaultSettings();
}

async function demoApi(action, payload){
  if(action === "getAllData") return { success:true, data:{
    Warehouses:state.warehouses, Tasks:state.tasks, Documents:state.documents, Calendar:state.calendar,
    Activity_Log:state.activity, Settings:[], Issues:state.issues,
    Checklist_Templates:state.checklistTemplates, Trash:state.trash
  }};

  const log = (sheet, id, details) => state.activity.push({
    Timestamp: new Date().toLocaleString("th-TH"), Action:action, Sheet:sheet,
    "Record ID":id, "Warehouse ID":payload["Warehouse ID"]||payload.warehouseId||"",
    User:CONFIG.defaultUser, Details:details
  });

  if(action === "addWarehouse"){
    state.warehouses.push(payload);
    log("Warehouses", payload["Warehouse ID"], "add warehouse");
  }
  if(action === "addTask"){
    const task = payload.task || payload;
    state.tasks.push(task);
    log("Tasks", task["Task ID"], "add task");
    if(payload.createCalendar && task["Due Date"]){
      state.calendar.push({
        "Event ID": uid("EV"), "Warehouse ID":task["Warehouse ID"], "Task ID":task["Task ID"],
        "Event Title":task["Task Name"], "Event Type":"กำหนดส่งงาน", "Due Date":task["Due Date"],
        "Assignee":task.Assignee, "Calendar Status":"ยังไม่เตือน"
      });
    }
  }
  if(action === "addDocument"){   state.documents.push(payload); log("Documents", payload["Document ID"], "add document"); }
  if(action === "addCalendarEvent"){ state.calendar.push(payload); log("Calendar", payload["Event ID"], "add event"); }
  if(action === "addIssue"){     state.issues.push(payload); log("Issues", payload["Issue ID"], "add issue"); }

  if(action === "updateStatus"){
    const t = state.tasks.find(x => x["Task ID"] === payload.taskId);
    if(t){
      const old = t.Status;
      t.Status = payload.status;
      if(payload.progress !== null && payload.progress !== undefined) t["Progress %"] = payload.progress;
      t["Last Updated"] = new Date().toISOString();
      if(payload.status === "ปิดแล้ว"){ t["Closed Date"] = todayISO(); t["Progress %"] = 100; }
      log("Tasks", payload.taskId, `status ${old} -> ${payload.status}`);
    }
  }

  if(action === "deleteRecord"){
    const map     = { Warehouses:state.warehouses, Tasks:state.tasks, Documents:state.documents, Calendar:state.calendar, Issues:state.issues };
    const idField = { Warehouses:"Warehouse ID", Tasks:"Task ID", Documents:"Document ID", Calendar:"Event ID", Issues:"Issue ID" }[payload.sheet];
    const arr     = map[payload.sheet];
    const idx     = arr?.findIndex(x => x[idField] === payload.recordId);
    if(idx >= 0){
      const snap = arr.splice(idx, 1)[0];
      state.trash.push({
        Timestamp: new Date().toLocaleString("th-TH"), "Source Sheet":payload.sheet,
        "Record ID":payload.recordId, "Warehouse ID":snap["Warehouse ID"]||payload.recordId,
        "Deleted By":CONFIG.defaultUser, Reason:payload.reason, "Snapshot JSON":JSON.stringify(snap)
      });
    }
  }

  if(action === "addSettingOption"){
    const { category:cat, value:val } = payload;
    state.settings[cat] ||= [];
    if(!state.settings[cat].includes(val)) state.settings[cat].push(val);
  }
  if(action === "deleteSettingOption"){
    const { category:cat, value:val } = payload;
    state.settings[cat] = (state.settings[cat]||[]).filter(x => x !== val);
  }

  if(action === "addChecklistTemplate"){
    state.checklistTemplates.push(payload.template);
  }
  if(action === "updateChecklistTemplate"){
    const idx = state.checklistTemplates.findIndex(t => t["Template ID"] === payload.template["Template ID"]);
    if(idx >= 0) state.checklistTemplates[idx] = payload.template;
    else state.checklistTemplates.push(payload.template);
  }
  if(action === "deleteChecklistTemplate"){
    state.checklistTemplates = state.checklistTemplates.filter(t => t["Template ID"] !== payload.templateId);
  }

  if(action === "createChecklist"){
    normalizeChecklistTemplates(state.checklistTemplates)
      .filter(t => String(t.Active||"TRUE").toUpperCase() !== "FALSE" &&
        (!payload.caseType || (t["Case Type"]||"Standard") === payload.caseType))
      .forEach(t => state.tasks.push({
        "Task ID":      uid("T"),
        "Created Date": todayISO(),
        "Warehouse ID": payload.warehouseId,
        "Phase":        t.Phase,
        "Task Name":    t["Task Name"],
        "Assignee":     t["Default Assignee"]  || "",
        "Status":       t["Default Status"]    || "To Do",
        "Priority":     t.Priority             || "กลาง",
        "Due Date":     addDays(todayISO(), Number(t["Default Due Offset Days"]||7)),
        "Progress %":   0,
        "Notes":        t.Notes                || ""
      }));
  }

  if(action === "ping") return { success:true, message:"pong" };

  return { success:true };
}
