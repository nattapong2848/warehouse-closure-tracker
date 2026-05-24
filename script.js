const CONFIG = {
  spreadsheetId: localStorage.getItem("spx_sheet_id") || "1gNnjKeqxaE6TtCOOXOqnaG_E0v5dQtUmE_KfLgoo6hI",
  apiUrl: localStorage.getItem("spx_api_url") || "",
  defaultUser: localStorage.getItem("spx_default_user") || "System",
  dueSoonDays: Number(localStorage.getItem("spx_due_soon_days") || 3)
};

const state = {
  warehouses: [], tasks: [], documents: [], calendar: [], activity: [], settings: {},
  issues: [], checklistTemplates: [], trash: [],
  selectedWarehouseId: localStorage.getItem("spx_selected_wh") || "",
  currentView: "dashboard",
  selectedCalendarDate: todayISO(),
  calendarCursor: todayISO().slice(0,7)
};

const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];

document.addEventListener("DOMContentLoaded", init);

function init(){
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
    dashboard:"⚡ Dashboard", warehouseStatus:"🏢 สถานะคลัง", profiles:"🗂️ โปรไฟล์คลัง", addWarehouse:"+ เพิ่มคลัง",
    addTask:"📦 เพิ่มงาน", tasks:"📋 รายการงาน", documents:"📎 เอกสาร", calendar:"🗓️ ปฏิทิน", issues:"🚨 Risks / Issues",
    checklist:"✅ Checklist", reports:"📣 รายงาน", activity:"🛰️ Activity Log", trash:"🗑️ ถังขยะ", settings:"⚙️ ตั้งค่า"
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
  $("#copyReportBtn")?.addEventListener("click", () => navigator.clipboard.writeText($("#dailyReport").textContent).then(()=>toast("คัดลอกรายงานแล้ว")));
  $("#prevMonth")?.addEventListener("click", () => changeMonth(-1));
  $("#nextMonth")?.addEventListener("click", () => changeMonth(1));
  $("#calendarMonth")?.addEventListener("change", e => { state.calendarCursor=e.target.value; renderCalendar(); });
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

function startClock(){
  const tick=()=>{ $("#clock").textContent = new Intl.DateTimeFormat("th-TH",{timeZone:"Asia/Bangkok",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}).format(new Date()); };
  tick(); setInterval(tick,1000);
}

function todayISO(){
  const f = new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Bangkok",year:"numeric",month:"2-digit",day:"2-digit"});
  return f.format(new Date());
}
function parseDate(v){
  if(!v) return null;
  if(v instanceof Date) return v;
  const s = String(v).trim();

  // ISO: 2026-05-22 or 2026-05-22 00:00:00
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if(iso){
    const y = iso[1], m = String(iso[2]).padStart(2,"0"), d = String(iso[3]).padStart(2,"0");
    return new Date(`${y}-${m}-${d}T00:00:00`);
  }

  // Thai/Google display format: 22/5/2026, 12:51:48 or 22/05/2026
  const th = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if(th){
    const d = String(th[1]).padStart(2,"0"), m = String(th[2]).padStart(2,"0"), y = th[3];
    return new Date(`${y}-${m}-${d}T00:00:00`);
  }

  const d = new Date(s);
  return isNaN(d) ? null : d;
}
function fmtDate(v){ const d=parseDate(v); return d ? d.toISOString().slice(0,10) : ""; }
function daysDiff(dateStr){ const d=parseDate(dateStr); if(!d) return null; return Math.floor((d - parseDate(todayISO()))/86400000); }
function uid(prefix){ return prefix + "-" + Math.floor(1000 + Math.random()*9000) + Date.now().toString().slice(-3); }
function toast(msg){ const t=$("#toast"); t.textContent=msg; t.classList.add("show"); setTimeout(()=>t.classList.remove("show"),2600); }
function openModal(html){ $("#modalBody").innerHTML=html; $("#modal").classList.remove("hidden"); }
function closeModal(){ $("#modal").classList.add("hidden"); }

async function withLoading(btn, asyncFn){
  if(btn){ btn.setAttribute("data-loading","1"); btn.disabled=true; }
  try{ await asyncFn(); }
  finally{ if(btn){ btn.removeAttribute("data-loading"); btn.disabled=false; } }
}

async function postAndRefresh(action, payload, successMsg, section=""){
  await api(action, payload);
  toast(successMsg);
  if(!CONFIG.apiUrl){
    // demo mode — อัปเดต state แล้ว re-render
    await demoApi(action, payload);
    renderAll();
  } else {
    await loadAllData();
  }
}

async function api(action, payload={}, method="POST"){
  if(!CONFIG.apiUrl){
    return demoApi(action,payload);
  }
  const url = method === "GET" ? `${CONFIG.apiUrl}?action=${encodeURIComponent(action)}` : CONFIG.apiUrl;
  const res = await fetch(url, method === "GET" ? {method:"GET"} : {method:"POST", body: JSON.stringify({action, ...payload})});
  const json = await res.json();
  if(!json.success) throw new Error(json.message || "API error");
  return json;
}

async function loadAllData(){
  setSync(false,"Syncing...");
  try{
    const res = await api("getAllData",{}, "GET");
    const data = res.data || {};
    state.warehouses = data.Warehouses || data.warehouses || [];
    state.tasks = data.Tasks || data.tasks || [];
    state.documents = data.Documents || data.documents || [];
    state.calendar = data.Calendar || data.calendar || [];
    state.activity = data.Activity_Log || data.activity || [];
    state.settings = normalizeSettings(data.Settings || data.settings || []);
    state.issues = data.Issues || data.issues || [];
    state.checklistTemplates = data.Checklist_Templates || data.checklistTemplates || [];
    state.trash = data.Trash || data.trash || [];
    setSync(true, CONFIG.apiUrl ? "เชื่อมต่อแล้ว" : "Demo Mode");
  }catch(err){
    console.error(err);
    setSync(false,"Demo Mode");
    if(!state.warehouses.length) seedDemo();
    toast("โหลดข้อมูลไม่สำเร็จ ใช้ Demo Mode");
  }
  ensureDefaultSettings();
  renderAll();
}
function setSync(ok,msg){ $("#syncText").textContent=msg; $("#syncSubText").textContent= ok ? "Google Sheet Sync" : "Google Sheet Sync"; $("#syncDot").classList.toggle("good", ok); }
function normalizeSettings(rows){
  const fallback = {};
  if(!rows) return fallback;

  // Case 1: Apps Script returns array of objects:
  // [{ "Task Status": "Backlog", "Priority": "สูง" }, ...]
  if(Array.isArray(rows) && rows.length && typeof rows[0] === "object" && !Array.isArray(rows[0])){
    const keys = Object.keys(rows[0]);
    keys.forEach(k => {
      fallback[k] = [...new Set(rows.map(r => String(r[k] || "").trim()).filter(Boolean))];
    });
    return fallback;
  }

  // Case 2: raw 2D array:
  // [["Task Status","Priority"],["Backlog","สูง"]]
  if(Array.isArray(rows) && Array.isArray(rows[0])){
    const headers = rows[0].map(x => String(x || "").trim()).filter(Boolean);
    headers.forEach((h, col) => {
      fallback[h] = [...new Set(rows.slice(1).map(r => String((r || [])[col] || "").trim()).filter(Boolean))];
    });
    return fallback;
  }

  return fallback;
}
function ensureDefaultSettings(){
  const defaults = {
    "Task Status": ["Backlog","To Do","กำลังดำเนินการ","รอเอกสาร","รอ Vendor","ติดขัด","ปิดแล้ว"],
    "Priority": ["สูงมาก","สูง","กลาง","ต่ำ"],
    "Warehouse Status": ["ยังไม่เริ่ม","กำลังปิดคลัง","รอส่งมอบ","ส่งมอบแล้ว","ปิดโครงการแล้ว"],
    "Phase": ["เฟส 1 · ตรวจสัญญาและแจ้งเลิก","เฟส 2 · วางแผนและตั้งทีม","เฟส 3 · เคลียร์ทรัพย์สินและสต๊อก","เฟส 4 · ยกเลิก Vendor และสาธารณูปโภค","เฟส 5 · คืนสภาพพื้นที่","เฟส 6 · ส่งมอบพื้นที่","เฟส 7 · ปิดการเงินและเงินประกัน"],
    "Document Type": ["สัญญาเช่า","ใบส่งมอบพื้นที่","รูปภาพพื้นที่","ใบเสนอราคา","Invoice / PO","อื่น ๆ"],
    "Document Status": ["รอตรวจสอบ","ผ่าน","ต้องแก้ไข"],
    "Event Type": ["กำหนดส่งงาน","นัดหมาย","ตรวจพื้นที่","ติดตามเอกสาร","แจ้งเตือน"],
    "Calendar Status": ["ยังไม่เตือน","เตือนแล้ว","เสร็จสิ้น","ยกเลิก"]
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
    "Template ID": t["Template ID"] || t.templateId || `TPL-LOCAL-${idx+1}`,
    "Phase": t.Phase || t.phase || "",
    "Task Name": t["Task Name"] || t.taskName || "",
    "Default Assignee": t["Default Assignee"] || t.defaultAssignee || "",
    "Priority": t.Priority || t.priority || "กลาง",
    "Default Status": t["Default Status"] || t.defaultStatus || "To Do",
    "Default Due Offset Days": t["Default Due Offset Days"] || t.dueOffset || "7",
    "Document Required": t["Document Required"] || t.documentRequired || "",
    "Notes": t.Notes || t.notes || "",
    "Case Type": t["Case Type"] || t.caseType || "Standard",
    "Active": String(t.Active || t.active || "TRUE").toUpperCase() === "FALSE" ? "FALSE" : "TRUE"
  })).filter(t => t["Task Name"]);
}
function renderAll(){
  const jobs = [
    ["dropdowns", renderDropdowns],
    ["dashboard", renderDashboard],
    ["warehouseStatus", renderWarehouseStatus],
    ["profiles", renderProfiles],
    ["tasks", renderTasks],
    ["documents", renderDocuments],
    ["calendar", renderCalendar],
    ["issues", renderIssues],
    ["checklist", renderChecklist],
    ["reports", renderDailyReport],
    ["activity", renderActivity],
    ["trash", renderTrash],
    ["settings", renderSettingsGrid]
  ];

  jobs.forEach(([name, fn]) => {
    try { if(typeof fn === "function") fn(); }
    catch(err){ console.error("Render error:", name, err); }
  });
  renderNavBadges();
}

function renderNavBadges(){
  const today = todayISO();
  const overdueCnt  = overdueTasks(state.tasks).length;
  const todayCnt    = state.tasks.filter(t => !isClosed(t) && fmtDate(t["Due Date"]) === today).length;
  const issueCnt    = state.issues.filter(i => i.Status !== "Closed" && i.Status !== "ปิดแล้ว").length;
  const calTodayCnt = state.calendar.filter(e => {
    const d = fmtDate(e["Due Date"] || e["Start Date"] || "");
    return d === today && e["Calendar Status"] !== "เสร็จแล้ว" && e["Calendar Status"] !== "เสร็จสิ้น";
  }).length;
  const setBadge = (id, count, cls="") => {
    const el = $("#" + id);
    if(!el) return;
    el.textContent = count;
    el.className = ["nav-badge", cls, count === 0 ? "zero" : ""].filter(Boolean).join(" ");
  };
  setBadge("badgeTasks",     overdueCnt + todayCnt,  overdueCnt > 0 ? "" : "warn");
  setBadge("badgeWarehouse", overdueCnt,              overdueCnt > 0 ? "" : "zero");
  setBadge("badgeIssues",    issueCnt,                issueCnt > 0 ? "" : "zero");
  setBadge("badgeCalendar",  calTodayCnt,             calTodayCnt > 0 ? "warn" : "zero");
}

function whName(id){ return state.warehouses.find(w=>w["Warehouse ID"]===id)?.["Warehouse Name"] || id || "-"; }
function whById(id){ return state.warehouses.find(w=>w["Warehouse ID"]===id) || {}; }
function tasksForWarehouse(id){ return state.tasks.filter(t=>t["Warehouse ID"]===id); }
function isClosed(t){ return ["ปิดแล้ว","เสร็จสิ้น","Completed"].includes(t.Status); }
function pendingTasks(tasks){ return tasks.filter(t=>!isClosed(t)); }
function overdueTasks(tasks){ return tasks.filter(t=>!isClosed(t) && daysDiff(t["Due Date"]) !== null && daysDiff(t["Due Date"]) < 0); }
function avgProgress(tasks){ if(!tasks.length) return 0; return Math.round(tasks.reduce((s,t)=>s+Number(t["Progress %"]||0),0)/tasks.length); }
function dueSoonTasks(tasks){
  return tasks.filter(t => !isClosed(t) && (
    ["ติดขัด","รอเอกสาร","รอ Vendor"].includes(t.Status) ||
    (daysDiff(t["Due Date"]) !== null && daysDiff(t["Due Date"]) <= CONFIG.dueSoonDays)
  ));
}

function renderDashboard(){
  const today = todayISO();
  const total = state.tasks.length, done = state.tasks.filter(isClosed).length;
  const active = state.tasks.filter(t => !isClosed(t) && t.Status === "กำลังดำเนินการ").length;
  const overdue = overdueTasks(state.tasks);
  const progress = avgProgress(state.tasks);

  // KPI
  const kpiEl = n => $("#" + n);
  if(kpiEl("kpiWarehouses")) kpiEl("kpiWarehouses").textContent = state.warehouses.length;
  if(kpiEl("kpiTasks"))      kpiEl("kpiTasks").textContent = total;
  if(kpiEl("kpiActive"))     kpiEl("kpiActive").textContent = active;
  if(kpiEl("kpiDone"))       kpiEl("kpiDone").textContent = done;
  if(kpiEl("kpiOverdue"))    kpiEl("kpiOverdue").textContent = overdue.length;
  if(kpiEl("kpiProgress"))   kpiEl("kpiProgress").textContent = progress + "%";
  if(kpiEl("overallProgress")) kpiEl("overallProgress").textContent = progress + "%";

  // Date chip
  const dc = $("#todayDateChip");
  if(dc) dc.textContent = new Date().toLocaleDateString("th-TH",{weekday:"long",year:"numeric",month:"long",day:"numeric"});

  // Alert strip
  const strip = $("#alertStrip");
  if(strip){
    const todayTasks  = state.tasks.filter(t => !isClosed(t) && fmtDate(t["Due Date"]) === today);
    const openIssues  = state.issues.filter(i => i.Status !== "Closed" && i.Status !== "ปิดแล้ว");
    if(overdue.length === 0 && openIssues.length === 0){
      strip.className = "alert-strip ok";
      strip.classList.remove("hidden");
      strip.innerHTML = `<span class="alert-title">✅ ทุกอย่างอยู่ในเกณฑ์ดี</span>`;
    } else {
      strip.className = "alert-strip";
      strip.classList.remove("hidden");
      let html = `<span class="alert-title">⚠️ ต้องการการดูแล</span>`;
      if(overdue.length)    html += `<span class="alert-chip" onclick="showView('tasks')">🔥 เลยกำหนด ${overdue.length} งาน</span>`;
      if(todayTasks.length) html += `<span class="alert-chip" onclick="showView('tasks')">📅 ครบกำหนดวันนี้ ${todayTasks.length} งาน</span>`;
      if(openIssues.length) html += `<span class="alert-chip" onclick="showView('issues')">🚨 Issues ค้าง ${openIssues.length} รายการ</span>`;
      strip.innerHTML = html;
    }
  }

  // Today focus grid — เลยกำหนด + วันนี้ + ใกล้ครบ 7 วัน
  const grid = $("#todayTaskGrid");
  if(grid){
    const urgent     = overdue.slice(0, 4);
    const todayDue   = state.tasks.filter(t => !isClosed(t) && fmtDate(t["Due Date"]) === today).slice(0, 4);
    const comingSoon = state.tasks.filter(t => {
      if(isClosed(t)) return false;
      const d = daysDiff(t["Due Date"]);
      return d !== null && d > 0 && d <= 7;
    }).slice(0, 4);

    const seen = new Set();
    const allShow = [
      ...urgent.map(t    => ({t, cls:"overdue", label:"🔥 เลยกำหนด"})),
      ...todayDue.map(t  => ({t, cls:"today",   label:"📅 วันนี้"})),
      ...comingSoon.map(t => ({t, cls:"soon",   label:`⏳ ${daysDiff(t["Due Date"])} วัน`}))
    ].filter(({t}) => {
      if(seen.has(t["Task ID"])) return false;
      seen.add(t["Task ID"]);
      return true;
    });

    if(!allShow.length){
      grid.innerHTML = `<div class="today-task-card"><b>✅ ไม่มีงานเร่งด่วน</b><small>สบายใจได้ วันนี้ทุกอย่างเรียบร้อย</small></div>`;
    } else {
      grid.innerHTML = allShow.map(({t, cls, label}) =>
        `<div class="today-task-card ${cls}" onclick="quickStatus('${escapeAttr(t["Task ID"])}')">
          <b>${escapeHTML(t["Task Name"])}</b>
          <small>${escapeHTML(whName(t["Warehouse ID"]))} · ${escapeHTML(t.Assignee||"-")}</small>
          <span class="task-label">${label}</span>
        </div>`
      ).join("");
    }
  }

  // Status bars
  const counts = {};
  state.tasks.forEach(t => counts[t.Status || "ไม่ระบุ"] = (counts[t.Status||"ไม่ระบุ"]||0) + 1);
  const barsEl = $("#statusBars");
  if(barsEl) barsEl.innerHTML = Object.entries(counts).map(([k,v]) =>
    `<div class="bar-row"><span>${k}</span><div class="bar-track"><div class="bar-fill" style="width:${total?Math.round(v/total*100):0}%"></div></div><b>${v}</b></div>`
  ).join("") || empty("ยังไม่มีงาน");

  const follow = dueSoonTasks(state.tasks).slice(0, 8);
  const flEl = $("#followUpList");
  if(flEl) flEl.innerHTML = follow.map(taskMini).join("") || empty("ยังไม่มีงานที่ต้องตาม");
}
function taskMini(t){
  const d=daysDiff(t["Due Date"]); const cls=d<0?"danger":d===0?"warn":"";
  return `<div class="mini-card"><div><b>${t["Task ID"]} · ${t["Task Name"]}</b><small>${whName(t["Warehouse ID"])} · Due ${t["Due Date"]||"-"} · ${t.Status||"-"}</small></div><span class="badge ${cls}">${d<0?"เลยกำหนด":d===0?"วันนี้":(d??"-")+" วัน"}</span></div>`;
}
function empty(text){ return `<div class="mini-card"><small>${text}</small></div>`; }

function renderWarehouseStatus(){
  const q=($("#warehouseStatusSearch")?.value||"").toLowerCase(); const st=$("#warehouseStatusFilter")?.value||"";
  fillSelect($("#warehouseStatusFilter"), ["",...state.settings["Warehouse Status"]], "ทุกสถานะ", false);
  const list=state.warehouses.filter(w=>(!st || w["Warehouse Status"]===st) && JSON.stringify(w).toLowerCase().includes(q));
  $("#warehouseStatusGrid").innerHTML = list.map(w=>{
    const tasks=tasksForWarehouse(w["Warehouse ID"]), pend=pendingTasks(tasks), overdue=overdueTasks(tasks), p=avgProgress(tasks);
    const next=pend.map(t=>t["Due Date"]).filter(Boolean).sort()[0] || "-";
    return `<article class="warehouse-card">
      <div class="card-head"><div><h4 class="card-title">${w["Warehouse Name"]}</h4><div class="card-sub">${w["Location / Zone"]||"-"} · Owner: ${w.Owner||"-"}</div></div><div class="progress-ring" style="--p:${p}" data-p="${p}%"></div></div>
      <div class="tabs"><span class="badge">${w["Warehouse Status"]||"-"}</span><span class="badge warn">ค้าง ${pend.length}</span><span class="badge danger">เลย ${overdue.length}</span><span class="badge">Due ถัดไป ${next}</span></div>
      <div class="pending-list">${pend.slice(0,4).map(t=>`<div class="pending-item"><b>${t["Task Name"]}</b><small>${t["Task ID"]} · ${t.Status} · Due ${t["Due Date"]||"-"}</small><div class="row-actions"><button class="tiny-btn orange" onclick="quickStatus('${t["Task ID"]}')">แก้สถานะ</button></div></div>`).join("") || "<small>ไม่มีงานค้าง</small>"}</div>
      <div class="button-row" style="margin-top:14px"><button class="tiny-btn orange" onclick="openProfile('${w["Warehouse ID"]}')">ดูโปรไฟล์</button><button class="tiny-btn blue" onclick="quickEditWarehouse('${escapeAttr(w["Warehouse ID"])}')">✏️ แก้ไข</button><button class="tiny-btn" onclick="prefillTaskWarehouse('${w["Warehouse ID"]}')">เพิ่มงาน</button><button class="tiny-btn red" onclick="deleteRecord('Warehouses','${w["Warehouse ID"]}')">ลบคลัง</button></div>
    </article>`
  }).join("") || empty("ยังไม่มีคลัง");
}

function renderProfiles(){
  const q=($("#profileSearch")?.value||"").toLowerCase();
  const list=state.warehouses.filter(w=>JSON.stringify(w).toLowerCase().includes(q));
  $("#profileCards").innerHTML=list.map(w=>{
    const tasks=tasksForWarehouse(w["Warehouse ID"]);
    return `<article class="profile-card" onclick="openProfile('${w["Warehouse ID"]}')">
      <h4 class="card-title">${w["Warehouse Name"]}</h4><div class="card-sub">${w["Location / Zone"]||"-"} · ${w.Owner||"-"}</div>
      <div class="tabs"><span class="badge">${w["Warehouse Status"]||"-"}</span><span class="badge warn">งานค้าง ${pendingTasks(tasks).length}</span><span class="badge">เอกสาร ${state.documents.filter(d=>d["Warehouse ID"]===w["Warehouse ID"]).length}</span></div>
    </article>`
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
  const p      = avgProgress(tasks);

  const taskAccordion = t => {
    const tid = escapeAttr(t["Task ID"]);
    const d = daysDiff(t["Due Date"]);
    const overdueCls = d !== null && d < 0 ? "danger" : d === 0 ? "warn" : "";
    const prog = Number(t["Progress %"] || 0);
    const statusOpts = (state.settings["Task Status"] || []).map(s =>
      `<option${s === t.Status ? " selected" : ""}>${escapeHTML(s)}</option>`).join("");
    return `<details class="task-accordion">
      <summary>
        <div class="task-accordion-head">
          <b>${escapeHTML(t["Task Name"])}</b>
          <small>${escapeHTML(t["Task ID"])} · ${escapeHTML(t.Assignee||"-")} · Due ${escapeHTML(t["Due Date"]||"-")}</small>
        </div>
        <span class="badge ${overdueCls}">${badge(t.Status).replace(/<[^>]+>/g,"") || "-"}</span>
      </summary>
      <div class="task-accordion-body">
        <div class="ta-bar"><div class="ta-fill" style="width:${prog}%"></div></div>
        <div class="ta-form">
          <label>สถานะ<select id="taSt_${tid}">${statusOpts}</select></label>
          <label>Progress %<input type="number" min="0" max="100" id="taProg_${tid}" value="${prog}"></label>
          <label class="full" style="grid-column:1/-1">หมายเหตุ<textarea id="taNote_${tid}" placeholder="หมายเหตุเพิ่มเติม...">${escapeHTML(t.Notes||"")}</textarea></label>
        </div>
        <div class="button-row" style="margin-top:8px">
          <button class="tiny-btn orange" onclick="saveTaskInline('${tid}',this)">💾 บันทึก</button>
          <button class="tiny-btn red" onclick="deleteRecord('Tasks','${tid}')">ลบงาน</button>
        </div>
      </div>
    </details>`;
  };

  $("#profileDetail").classList.remove("hidden");
  $("#profileDetail").innerHTML = `<section class="panel">
    <div class="panel-head split">
      <div>
        <h3>${escapeHTML(w["Warehouse Name"])}</h3>
        <span>${escapeHTML(w["Location / Zone"]||"-")} · Owner: ${escapeHTML(w.Owner||"-")}</span>
      </div>
      <div style="display:flex;gap:10px;align-items:center">
        <button class="tiny-btn blue" onclick="quickEditWarehouse('${escapeAttr(id)}')">✏️ แก้ไขคลัง</button>
        <div class="progress-ring" style="--p:${p}" data-p="${p}%"></div>
      </div>
    </div>
    <div class="kpi-grid" style="grid-template-columns:repeat(6,minmax(100px,1fr))">
      <article class="kpi"><p>งานทั้งหมด</p><strong>${tasks.length}</strong></article>
      <article class="kpi"><p>งานค้าง</p><strong>${pendingTasks(tasks).length}</strong></article>
      <article class="kpi danger"><p>เลยกำหนด</p><strong>${overdueTasks(tasks).length}</strong></article>
      <article class="kpi"><p>เอกสาร</p><strong>${docs.length}</strong></article>
      <article class="kpi"><p>แผนงาน</p><strong>${events.length}</strong></article>
      <article class="kpi danger"><p>Issues</p><strong>${issues.filter(i=>i.Status!=="Closed").length}</strong></article>
    </div>
    <div class="grid-2">
      <div>
        <h3>งานของคลังนี้</h3>
        ${tasks.map(taskAccordion).join("") || empty("ไม่มีงาน")}
      </div>
      <div>
        <h3>เอกสารของคลังนี้</h3>
        ${docs.map(d =>`<div class="mini-card"><div><b>${escapeHTML(d["Document Name"])}</b><small>${escapeHTML(d["Document Type"])} · ${escapeHTML(d["Document Status"]||"-")}</small></div><a class="tiny-btn orange" href="${d["File Link"]||"#"}" target="_blank">เปิด</a></div>`).join("") || empty("ไม่มีเอกสาร")}
      </div>
    </div>
  </section>`;
  $("#profileDetail").scrollIntoView({behavior:"smooth", block:"start"});
}

async function saveTaskInline(taskId, btn){
  // รองรับทั้ง prefix ของ profile (taSt_) และปฏิทิน (calSt_)
  const getVal = (prefixes, id) => {
    for(const p of prefixes){ const el = $("#" + p + id); if(el) return el.value; }
    return "";
  };
  const status   = getVal(["taSt_","calSt_"], taskId);
  const progress = getVal(["taProg_","calProg_"], taskId);
  const note     = getVal(["taNote_"], taskId);
  await withLoading(btn, async () => {
    await postAndRefresh("updateStatus", {
      taskId, status, progress, note, user: CONFIG.defaultUser
    }, "อัปเดตสถานะแล้ว ✅");
    // refresh โปรไฟล์ถ้าเปิดอยู่
    if(state.selectedWarehouseId) openProfile(state.selectedWarehouseId);
  });
}

function quickEditWarehouse(warehouseId){
  const w = state.warehouses.find(x => x["Warehouse ID"] === warehouseId);
  if(!w) return toast("ไม่พบข้อมูลคลัง");
  const statusOpts = (state.settings["Warehouse Status"] || []).map(s =>
    `<option value="${escapeAttr(s)}"${s === w["Warehouse Status"] ? " selected" : ""}>${escapeHTML(s)}</option>`
  ).join("");
  openModal(`
    <h3 style="margin:0 0 18px">✏️ แก้ไขข้อมูลคลัง</h3>
    <div class="form-grid">
      <label>ชื่อคลัง *<input id="we_name" value="${escapeAttr(w["Warehouse Name"]||"")}"></label>
      <label>พื้นที่ / โซน<input id="we_zone" value="${escapeAttr(w["Location / Zone"]||"")}"></label>
      <label>Owner<input id="we_owner" value="${escapeAttr(w.Owner||"")}"></label>
      <label>เบอร์ Owner<input id="we_phone" value="${escapeAttr(w["Owner Phone"]||"")}"></label>
      <label>วันเริ่มปิดคลัง<input type="date" id="we_start" value="${escapeAttr(w["Start Date"]||"")}"></label>
      <label>วันเป้าหมายส่งมอบ<input type="date" id="we_target" value="${escapeAttr(w["Target Handover Date"]||"")}"></label>
      <label>สถานะคลัง<select id="we_status">${statusOpts}</select></label>
      <label>ลิงก์โฟลเดอร์<input id="we_folder" value="${escapeAttr(w["Document Folder Link"]||"")}"></label>
      <label class="full">หมายเหตุ<textarea id="we_notes">${escapeHTML(w.Notes||"")}</textarea></label>
    </div>
    <div class="button-row" style="margin-top:16px">
      <button class="primary-btn" onclick="updateWarehouseFromModal('${escapeAttr(warehouseId)}',this)">💾 บันทึก</button>
      <button class="ghost-btn" onclick="closeModal()">ยกเลิก</button>
    </div>
  `);
}

async function updateWarehouseFromModal(warehouseId, btn){
  const name = ($("#we_name")?.value || "").trim();
  if(!name) return toast("กรุณากรอกชื่อคลัง");
  await withLoading(btn, async () => {
    await postAndRefresh("updateWarehouse", {
      warehouseId,
      "Warehouse Name":         name,
      "Location / Zone":        $("#we_zone")?.value || "",
      "Owner":                  $("#we_owner")?.value || "",
      "Owner Phone":            $("#we_phone")?.value || "",
      "Start Date":             $("#we_start")?.value || "",
      "Target Handover Date":   $("#we_target")?.value || "",
      "Warehouse Status":       $("#we_status")?.value || "",
      "Document Folder Link":   $("#we_folder")?.value || "",
      "Notes":                  $("#we_notes")?.value || "",
      user: CONFIG.defaultUser
    }, "อัปเดตข้อมูลคลังแล้ว ✅", "warehouse");
    closeModal();
    if(state.selectedWarehouseId === warehouseId) openProfile(warehouseId);
  });
}

function renderTasks(){
  const q=($("#taskSearch")?.value||"").toLowerCase(), wh=$("#taskWarehouseFilter")?.value||"", st=$("#taskStatusFilter")?.value||"";
  const rows=state.tasks.filter(t=>(!wh||t["Warehouse ID"]===wh)&&(!st||t.Status===st)&&JSON.stringify(t).toLowerCase().includes(q));
  $("#tasksTable").innerHTML = table(["Task ID","คลัง","ชื่องาน","Owner","Status","Priority","Due","Progress","Actions"], rows.map(t=>[
    t["Task ID"], whName(t["Warehouse ID"]), t["Task Name"], t.Assignee||"-", badge(t.Status), t.Priority||"-", t["Due Date"]||"-", `${t["Progress %"]||0}%`,
    `<div class="row-actions"><button class="tiny-btn orange" onclick="quickStatus('${t["Task ID"]}')">แก้</button><button class="tiny-btn red" onclick="deleteRecord('Tasks','${t["Task ID"]}')">ลบ</button></div>`
  ]));
}
function badge(s){ const cls=isClosed({Status:s})?"done":["ติดขัด","รอเอกสาร","รอ Vendor"].includes(s)?"danger":s==="กำลังดำเนินการ"?"warn":""; return `<span class="badge ${cls}">${s||"-"}</span>`; }
function table(headers, rows){ return `<thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join("")}</tr>`).join("")}</tbody>`; }

function renderDocuments(){
  const q = ($("#documentSearch")?.value || "").toLowerCase();
  const whFilter = $("#documentWarehouseFilter")?.value || "";
  const typeFilter = $("#documentTypeFilter")?.value || "";

  fillSelectObj($("#documentWarehouseFilter"), [
    {value:"", label:"ทุกคลัง"},
    ...state.warehouses.map(w => ({value:w["Warehouse ID"], label:`${w["Warehouse Name"]} (${w["Warehouse ID"]})`}))
  ], "ทุกคลัง", false);

  fillSelect($("#documentTypeFilter"), ["", ...(state.settings["Document Type"] || [])], "ทุกประเภท", false);

  const docs = state.documents.filter(d => {
    const matchText = JSON.stringify(d).toLowerCase().includes(q);
    const matchWh = !whFilter || d["Warehouse ID"] === whFilter;
    const matchType = !typeFilter || d["Document Type"] === typeFilter;
    return matchText && matchWh && matchType;
  });

  const grouped = {};
  state.warehouses.forEach(w => {
    grouped[w["Warehouse ID"]] = {
      warehouse: w,
      docs: docs.filter(d => d["Warehouse ID"] === w["Warehouse ID"])
    };
  });

  // เผื่อมีเอกสารที่ไม่มี Warehouse ID หรือ WH ถูกลบไปแล้ว
  const unlinked = docs.filter(d => !state.warehouses.some(w => w["Warehouse ID"] === d["Warehouse ID"]));
  if (unlinked.length) {
    grouped.__unlinked = {
      warehouse: {"Warehouse ID":"", "Warehouse Name":"เอกสารที่ยังไม่ผูกคลัง", "Location / Zone":"Unlinked"},
      docs: unlinked
    };
  }

  const visibleGroups = Object.values(grouped).filter(g => g.docs.length || (!whFilter && !q && !typeFilter));

  $("#documentsWarehouseHub").innerHTML = visibleGroups.map(g => {
    const w = g.warehouse;
    const byType = {};
    g.docs.forEach(d => {
      const type = d["Document Type"] || "ไม่ระบุประเภท";
      (byType[type] ||= []).push(d);
    });

    const completion = calcDocumentCompletion(g.docs);
    const taskCount = new Set(g.docs.map(d => d["Task ID"]).filter(Boolean)).size;

    return `<article class="doc-warehouse-card">
      <div class="doc-warehouse-head">
        <div>
          <h4>${w["Warehouse Name"]}</h4>
          <p>${w["Location / Zone"] || "-"} · ${w["Warehouse ID"] || "-"}</p>
        </div>
        <div class="doc-score" style="--p:${completion}">
          <strong>${completion}%</strong>
          <span>DOCS</span>
        </div>
      </div>

      <div class="doc-stats">
        <span>📁 เอกสาร ${g.docs.length}</span>
        <span>🔗 ผูกงาน ${taskCount}</span>
        <span>✅ ผ่าน ${g.docs.filter(d => d["Document Status"] === "ผ่าน").length}</span>
        <span>🕒 รอตรวจ ${g.docs.filter(d => d["Document Status"] === "รอตรวจสอบ").length}</span>
      </div>

      <div class="doc-type-groups">
        ${Object.keys(byType).length ? Object.entries(byType).map(([type, items]) => `
          <details class="doc-type-block" open>
            <summary>
              <b>${type}</b>
              <span>${items.length} ไฟล์</span>
            </summary>
            <div class="doc-files">
              ${items.map(documentCard).join("")}
            </div>
          </details>
        `).join("") : `<div class="empty-doc-box">ยังไม่มีเอกสารของคลังนี้</div>`}
      </div>

      <div class="button-row">
        <button class="tiny-btn orange" onclick="prefillDocumentWarehouse('${w["Warehouse ID"] || ""}')">+ เพิ่มเอกสารคลังนี้</button>
        <button class="tiny-btn" onclick="openProfile('${w["Warehouse ID"] || ""}')">ดูโปรไฟล์คลัง</button>
      </div>
    </article>`;
  }).join("") || empty("ยังไม่มีเอกสาร");

  // keep old fallback container compatible if older HTML exists
  const oldList = $("#documentsList");
  if (oldList) oldList.innerHTML = docs.map(documentCard).join("") || empty("ยังไม่มีเอกสาร");
}

function documentCard(d){
  const status = d["Document Status"] || "-";
  const statusClass = status === "ผ่าน" ? "done" : status === "ต้องแก้ไข" ? "danger" : "warn";
  const fileLink = d["File Link"] || "#";
  return `<div class="doc-file-card">
    <div>
      <b>${d["Document Name"] || "-"}</b>
      <small>${d["Document ID"] || "-"} · Task ${d["Task ID"] || "-"} · ${d["Uploaded Date"] || "-"}</small>
      ${d.Notes ? `<p>${d.Notes}</p>` : ""}
    </div>
    <div class="doc-actions">
      <span class="badge ${statusClass}">${status}</span>
      <a class="tiny-btn orange" target="_blank" href="${fileLink}">เปิดไฟล์</a>
      <button class="tiny-btn red" onclick="deleteRecord('Documents','${d["Document ID"]}')">ลบ</button>
    </div>
  </div>`;
}

function calcDocumentCompletion(docs){
  if(!docs.length) return 0;
  const passed = docs.filter(d => d["Document Status"] === "ผ่าน").length;
  return Math.round((passed / docs.length) * 100);
}

function prefillDocumentWarehouse(id){
  showView("documents");
  const sel = $("#docWarehouseSelect");
  if(sel) sel.value = id;
  window.scrollTo({top: document.body.scrollHeight, behavior: "smooth"});
}
function renderCalendar(){
  const calEl = $("#calendarMonth");
  if(calEl) calEl.value = state.calendarCursor;
  const [y,m] = state.calendarCursor.split("-").map(Number);
  const first = new Date(y, m-1, 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  const today = todayISO();
  const names = ["อา","จ","อ","พ","พฤ","ศ","ส"];
  let html = names.map(n => `<div class="cal-day-name">${n}</div>`).join("");

  // รวม calendar events + tasks ที่ยังไม่ปิด
  const eventsByDate = {};
  const allEntries = [
    ...state.calendar.filter(e => e["Calendar Status"] !== "เสร็จแล้ว" && e["Calendar Status"] !== "ยกเลิก"),
    ...state.tasks.filter(t => !isClosed(t)).map(t => ({
      "Event ID":  t["Task ID"],
      "Warehouse ID": t["Warehouse ID"],
      "Task ID":   t["Task ID"],
      "Event Title": t["Task Name"],
      "Event Type": "Task Due",
      "Due Date":  t["Due Date"],
      "Assignee":  t.Assignee,
      "Status":    t.Status
    }))
  ];
  allEntries.forEach(e => {
    const d = fmtDate(e["Due Date"] || e["Start Date"]);
    if(!d) return;
    (eventsByDate[d] ||= []).push(e);
  });

  for(let i = 0; i < 42; i++){
    const d   = new Date(start);
    d.setDate(start.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    const arr = eventsByDate[iso] || [];
    const isToday = iso === today;
    const isOther = d.getMonth() !== m - 1;
    html += `<div class="cal-cell${isOther?" other":""}${isToday?" cal-today":""}" onclick="selectCalendarDay('${iso}')">
      <div class="cal-date-row">
        <div class="cal-date${isToday?" cal-date-today":""}">${d.getDate()}</div>
        <button class="cal-add-btn" title="เพิ่มงานวันนี้" onclick="event.stopPropagation();quickAddFromCalendar('${iso}')">+</button>
      </div>
      ${arr.slice(0, 3).map(e => {
        const diff = daysDiff(iso);
        const cls  = diff !== null && diff < 0 ? "overdue" : isToday ? "today" : "";
        return `<div class="cal-event ${cls}" onclick="event.stopPropagation();openEventDetail('${escapeAttr(e["Event ID"]||"")}','${escapeAttr(e["Task ID"]||"")}')">${escapeHTML(e["Event Title"])}</div>`;
      }).join("")}
      ${arr.length > 3 ? `<small class="cal-more">+${arr.length-3}</small>` : ""}
    </div>`;
  }
  const mc = $("#monthCalendar");
  if(mc) mc.innerHTML = html;
  renderSelectedDay();
}

function selectCalendarDay(iso){
  state.selectedCalendarDate = iso;
  renderSelectedDay();
}

function renderSelectedDay(){
  const iso  = state.selectedCalendarDate;
  const btn  = $("#addFromCalBtn");
  const titleEl = $("#selectedDayTitle");

  if(!iso){
    if(titleEl) titleEl.textContent = "เลือกวันที่";
    if(btn) btn.style.display = "none";
    return;
  }

  // แสดงชื่อวัน
  const d = parseDate(iso);
  if(titleEl) titleEl.textContent = d
    ? d.toLocaleDateString("th-TH",{weekday:"long",day:"numeric",month:"long"})
    : iso;
  if(btn) btn.style.display = "";

  // งาน (ยังไม่ปิด) ของวันนั้น
  const dayTasks = state.tasks.filter(t =>
    !isClosed(t) && fmtDate(t["Due Date"]) === iso
  );
  // calendar events
  const dayEvents = state.calendar.filter(e =>
    fmtDate(e["Due Date"] || e["Start Date"]) === iso &&
    e["Calendar Status"] !== "ยกเลิก"
  );

  let html = "";

  if(dayTasks.length){
    html += `<h5 style="margin:0 0 8px;color:#475569">📋 งาน</h5>`;
    html += dayTasks.map(t => {
      const tid  = escapeAttr(t["Task ID"]);
      const prog = Number(t["Progress %"] || 0);
      const statusOpts = (state.settings["Task Status"] || []).map(s =>
        `<option${s === t.Status ? " selected" : ""}>${escapeHTML(s)}</option>`).join("");
      return `<details class="task-accordion">
        <summary>
          <div class="task-accordion-head">
            <b>${escapeHTML(t["Task Name"])}</b>
            <small>${escapeHTML(t["Task ID"])} · ${escapeHTML(whName(t["Warehouse ID"]))}</small>
          </div>
          ${badge(t.Status)}
        </summary>
        <div class="task-accordion-body">
          <div class="ta-bar"><div class="ta-fill" style="width:${prog}%"></div></div>
          <div class="ta-form">
            <label>สถานะ<select id="calSt_${tid}">${statusOpts}</select></label>
            <label>Progress %<input type="number" min="0" max="100" id="calProg_${tid}" value="${prog}"></label>
          </div>
          <button class="tiny-btn orange" style="margin-top:8px" onclick="saveTaskInline('${tid}',this)">💾 บันทึก</button>
        </div>
      </details>`;
    }).join("");
  }

  if(dayEvents.length){
    html += `<h5 style="margin:12px 0 8px;color:#475569">🗓️ กิจกรรม</h5>`;
    html += dayEvents.map(e =>
      `<div class="mini-card"><div><b>${escapeHTML(e["Event Title"])}</b><small>${escapeHTML(whName(e["Warehouse ID"]))} · ${escapeHTML(e["Event Type"]||"-")}</small></div></div>`
    ).join("");
  }

  if(!dayTasks.length && !dayEvents.length){
    html = `<div style="text-align:center;padding:20px;color:var(--muted)">
      <p>ไม่มีแผนงาน</p>
      <button class="ghost-btn" style="margin-top:8px" onclick="quickAddFromCalendar('${iso}')">+ เพิ่มงานวันนี้</button>
    </div>`;
  }

  const el = $("#selectedDayEvents");
  if(el) el.innerHTML = html;
}

function changeMonth(n){
  const [y,m] = state.calendarCursor.split("-").map(Number);
  const d = new Date(y, m-1+n, 1);
  state.calendarCursor = d.toISOString().slice(0, 7);
  renderCalendar();
}
function openEventDetail(id, taskId){ if(taskId) quickStatus(taskId); }

function quickAddFromCalendar(iso){
  const whOpts = state.warehouses.map(w =>
    `<option value="${escapeAttr(w["Warehouse ID"])}">${escapeHTML(w["Warehouse Name"])}</option>`
  ).join("");
  const phaseOpts = (state.settings["Phase"] || []).map(p =>
    `<option value="${escapeAttr(p)}">${escapeHTML(p)}</option>`
  ).join("");
  const prioOpts = (state.settings["Priority"] || []).map(p =>
    `<option value="${escapeAttr(p)}">${escapeHTML(p)}</option>`
  ).join("");
  openModal(`
    <h3 style="margin:0 0 18px">📋 เพิ่มงาน — ${escapeHTML(iso)}</h3>
    <div class="form-grid">
      <label>คลัง *<select id="qac_wh"><option value="">เลือกคลัง</option>${whOpts}</select></label>
      <label>เฟสงาน<select id="qac_phase"><option value="">-</option>${phaseOpts}</select></label>
      <label class="full">ชื่องาน *<input id="qac_name" placeholder="เช่น นัด Landlord ตรวจพื้นที่" required></label>
      <label>Assignee<input id="qac_assignee" placeholder="ชื่อผู้รับผิดชอบ"></label>
      <label>Priority<select id="qac_prio">${prioOpts}</select></label>
      <label>Due Date<input type="date" id="qac_due" value="${iso}"></label>
      <label>Progress %<input type="number" min="0" max="100" id="qac_prog" value="0"></label>
      <label class="full">หมายเหตุ<textarea id="qac_notes" placeholder="รายละเอียด..."></textarea></label>
    </div>
    <label class="checkbox-line"><input type="checkbox" id="qac_addCal" checked> เพิ่มลงปฏิทินอัตโนมัติ</label>
    <div class="button-row" style="margin-top:16px">
      <button class="primary-btn" onclick="submitTaskFromCalendar('${escapeAttr(iso)}',this)">💾 บันทึก</button>
      <button class="ghost-btn" onclick="closeModal()">ยกเลิก</button>
    </div>
  `);
}

async function submitWarehouse(e){
  e.preventDefault();
  const d = dataFromForm(e.target);
  const payload = {
    "Warehouse ID":           uid("WH"),
    "Warehouse Name":         d.warehouseName,
    "Location / Zone":        d.location,
    "Owner":                  d.owner,
    "Owner Phone":            d.ownerPhone,
    "Start Date":             d.startDate,
    "Target Handover Date":   d.targetDate,
    "Warehouse Status":       d.status || "ยังไม่เริ่ม",
    "Document Folder Link":   d.folderLink,
    "Notes":                  d.notes,
    "Created At":             new Date().toISOString(),
    "Updated At":             new Date().toISOString(),
    user: CONFIG.defaultUser
  };
  await postAndRefresh("addWarehouse", payload, "เพิ่มคลังแล้ว ✅");
  e.target.reset();
}

async function submitTask(e){
  e.preventDefault();
  const d = dataFromForm(e.target);
  const task = {
    "Task ID":        uid("T"),
    "Created Date":   todayISO(),
    "Warehouse ID":   d.warehouseId,
    "Phase":          d.phase,
    "Task Name":      d.taskName,
    "Assignee":       d.assignee,
    "Status":         d.status || "To Do",
    "Priority":       d.priority || "กลาง",
    "Due Date":       d.dueDate,
    "Progress %":     Number(d.progress || 0),
    "Evidence Link":  d.evidenceLink,
    "Last Updated":   todayISO(),
    "Notes":          d.notes
  };
  const createCalendar = !!d.createCalendar;
  await postAndRefresh("addTask", { task, createCalendar, user: CONFIG.defaultUser }, "เพิ่มงานแล้ว ✅");
  e.target.reset();
}

async function submitDocument(e){
  e.preventDefault();
  const d = dataFromForm(e.target);
  const payload = {
    "Document ID":      uid("DOC"),
    "Warehouse ID":     d.warehouseId,
    "Task ID":          d.taskId,
    "Document Type":    d.docType,
    "Document Name":    d.docName,
    "File Link":        d.fileLink,
    "Document Status":  d.docStatus || "รอตรวจสอบ",
    "Uploaded By":      d.uploadedBy || CONFIG.defaultUser,
    "Uploaded Date":    todayISO(),
    "Notes":            d.notes,
    user: CONFIG.defaultUser
  };
  await postAndRefresh("addDocument", payload, "เพิ่มเอกสารแล้ว ✅");
  e.target.reset();
}

async function submitCalendarEvent(e){
  e.preventDefault();
  const d = dataFromForm(e.target);
  const payload = {
    "Event ID":         uid("EV"),
    "Warehouse ID":     d.warehouseId,
    "Task ID":          d.taskId,
    "Event Title":      d.eventTitle,
    "Event Type":       d.eventType,
    "Start Date":       d.startDate,
    "Due Date":         d.dueDate,
    "Assignee":         d.assignee,
    "Reminder Days":    d.reminderDays || 2,
    "Calendar Status":  "ยังไม่เตือน",
    "Notes":            d.notes,
    user: CONFIG.defaultUser
  };
  await postAndRefresh("addCalendarEvent", payload, "เพิ่มแผนงานแล้ว ✅");
  e.target.reset();
}

async function submitIssue(e){
  e.preventDefault();
  const d = dataFromForm(e.target);
  const payload = {
    "Issue ID":       uid("ISS"),
    "Warehouse ID":   d.warehouseId,
    "Task ID":        d.taskId,
    "Issue Title":    d.issueTitle,
    "Impact":         d.impact,
    "Owner":          d.owner,
    "Status":         d.status || "Open",
    "Priority":       d.priority || "กลาง",
    "Due Date":       d.dueDate,
    "Solution":       d.solution,
    "Created Date":   todayISO(),
    "Notes":          d.notes,
    user: CONFIG.defaultUser
  };
  await postAndRefresh("addIssue", payload, "เพิ่ม Issue แล้ว ✅");
  e.target.reset();
}

function dataFromForm(form){
  const obj = {};
  [...new FormData(form).entries()].forEach(([k,v]) => obj[k] = v);
  return obj;
}

async function submitTaskFromCalendar(dueDate, btn){
  const name = ($("#qac_name")?.value || "").trim();
  if(!name) return toast("กรุณากรอกชื่องาน");
  await withLoading(btn, async () => {
    const task = {
      "Task ID":      uid("T"),
      "Created Date": todayISO(),
      "Warehouse ID": $("#qac_wh")?.value || "",
      "Phase":        $("#qac_phase")?.value || "",
      "Task Name":    name,
      "Assignee":     $("#qac_assignee")?.value || "",
      "Status":       "To Do",
      "Priority":     $("#qac_prio")?.value || "กลาง",
      "Due Date":     dueDate,
      "Progress %":   Number($("#qac_prog")?.value || 0),
      "Notes":        $("#qac_notes")?.value || ""
    };
    const createCalendar = $("#qac_addCal")?.checked;
    await postAndRefresh("addTask", { task, createCalendar, user: CONFIG.defaultUser }, "เพิ่มงานแล้ว ✅");
    closeModal();
    state.selectedCalendarDate = dueDate;
    renderCalendar();
  });
}

function renderIssues(){ $("#issuesList").innerHTML=state.issues.map(i=>`<div class="mini-card"><div><b>${i["Issue Title"]}</b><small>${whName(i["Warehouse ID"])} · ${i.Status} · ${i.Priority||"-"}</small></div><button class="tiny-btn red" onclick="deleteRecord('Issues','${i["Issue ID"]}')">ลบ</button></div>`).join("") || empty("ยังไม่มี Issue"); }
function renderChecklist(){
  ensureDefaultSettings();
  const caseFilter = $("#checklistCaseFilter")?.value || "";
  const templates = normalizeChecklistTemplates(state.checklistTemplates).filter(t => {
    const active = String(t.Active || "TRUE").toUpperCase() !== "FALSE";
    const matchCase = !caseFilter || (t["Case Type"] || "Standard") === caseFilter;
    return active && matchCase;
  });

  $("#checklistTemplates").innerHTML = templates.map(t => {
    const tid = t["Template ID"] || "";
    return `<div class="template-card checklist-template-card">
      <div class="template-top">
        <span class="badge">${t["Case Type"] || "Standard"}</span>
        <span class="badge ${t.Active === "FALSE" ? "danger" : "done"}">${t.Active === "FALSE" ? "Inactive" : "Active"}</span>
      </div>
      <h4>${t["Task Name"] || "-"}</h4>
      <small>${t.Phase || "-"} · ${t.Priority || "-"} · Due +${t["Default Due Offset Days"] || 0} วัน</small>
      <p>${t.Notes || ""}</p>
      <div class="template-meta">
        <span>👤 ${t["Default Assignee"] || "ไม่ระบุ"}</span>
        <span>📎 ${t["Document Required"] || "ไม่บังคับเอกสาร"}</span>
      </div>
      <div class="button-row">
        <button class="tiny-btn orange" onclick="editChecklistTemplate('${escapeAttr(tid)}')">แก้ไข</button>
        <button class="tiny-btn" onclick="duplicateChecklistTemplate('${escapeAttr(tid)}')">ทำสำเนา</button>
        <button class="tiny-btn red" onclick="deleteChecklistTemplate('${escapeAttr(tid)}')">ลบ</button>
      </div>
    </div>`;
  }).join("") || empty("ยังไม่มี Checklist Template ในเคสนี้ กด + เพิ่ม Template ใหม่ เพื่อสร้างรายการเอง");
}

function openNewChecklistTemplateForm(){
  renderDropdowns();
  const form = $("#checklistTemplateForm");
  form.reset();
  form.elements.templateId.value = "";
  $("#checklistTemplateFormTitle").textContent = "เพิ่ม Checklist Template";
  form.classList.remove("hidden");
  form.scrollIntoView({behavior:"smooth", block:"start"});
}

function closeChecklistTemplateForm(){
  $("#checklistTemplateForm").classList.add("hidden");
}

function editChecklistTemplate(templateId){
  renderDropdowns();
  const t = normalizeChecklistTemplates(state.checklistTemplates).find(x => x["Template ID"] === templateId);
  if(!t) return toast("ไม่พบ Template");

  const form = $("#checklistTemplateForm");
  form.elements.templateId.value = t["Template ID"] || "";
  form.elements.caseType.value = t["Case Type"] || "Standard";
  form.elements.phase.value = t.Phase || "";
  form.elements.taskName.value = t["Task Name"] || "";
  form.elements.defaultAssignee.value = t["Default Assignee"] || "";
  form.elements.priority.value = t.Priority || "";
  form.elements.defaultStatus.value = t["Default Status"] || "To Do";
  form.elements.dueOffset.value = t["Default Due Offset Days"] || 7;
  form.elements.documentRequired.value = t["Document Required"] || "";
  form.elements.active.value = String(t.Active || "TRUE").toUpperCase() === "FALSE" ? "FALSE" : "TRUE";
  form.elements.notes.value = t.Notes || "";

  $("#checklistTemplateFormTitle").textContent = "แก้ไข Checklist Template";
  form.classList.remove("hidden");
  form.scrollIntoView({behavior:"smooth", block:"start"});
}

function duplicateChecklistTemplate(templateId){
  renderDropdowns();
  const t = normalizeChecklistTemplates(state.checklistTemplates).find(x => x["Template ID"] === templateId);
  if(!t) return toast("ไม่พบ Template");
  openNewChecklistTemplateForm();
  const form = $("#checklistTemplateForm");
  form.elements.caseType.value = t["Case Type"] || "Standard";
  form.elements.phase.value = t.Phase || "";
  form.elements.taskName.value = (t["Task Name"] || "") + " (Copy)";
  form.elements.defaultAssignee.value = t["Default Assignee"] || "";
  form.elements.priority.value = t.Priority || "";
  form.elements.defaultStatus.value = t["Default Status"] || "To Do";
  form.elements.dueOffset.value = t["Default Due Offset Days"] || 7;
  form.elements.documentRequired.value = t["Document Required"] || "";
  form.elements.active.value = "TRUE";
  form.elements.notes.value = t.Notes || "";
}

async function deleteChecklistTemplate(templateId){
  if(!confirm("ลบ Checklist Template นี้?")) return;
  try{
    await api("deleteChecklistTemplate", { templateId, user: CONFIG.defaultUser });
    toast("ลบ Template แล้ว");
    await loadAllData();
  }catch(err){
    console.error(err);
    toast("ลบ Template ไม่สำเร็จ: " + err.message);
  }
}

async function submitChecklistTemplate(e){
  e.preventDefault();
  const d = dataFromForm(e.target);

  const payload = {
    "Template ID": d.templateId || uid("TPL"),
    "Phase": d.phase,
    "Task Name": d.taskName,
    "Default Assignee": d.defaultAssignee,
    "Priority": d.priority || "กลาง",
    "Default Status": d.defaultStatus || "To Do",
    "Default Due Offset Days": d.dueOffset || "7",
    "Document Required": d.documentRequired || "",
    "Notes": d.notes,
    "Case Type": d.caseType,
    "Active": d.active
  };

  try{
    await api(d.templateId ? "updateChecklistTemplate" : "addChecklistTemplate", { template: payload, user: CONFIG.defaultUser });
    toast("บันทึก Checklist Template แล้ว");
    closeChecklistTemplateForm();
    await loadAllData();
  }catch(err){
    console.error(err);
    toast("บันทึก Template ไม่สำเร็จ: " + err.message);
  }
}
function renderActivity(){ $("#activityTable").innerHTML=table(["Time","Action","Sheet","Record","Warehouse","User","Details"], state.activity.slice().reverse().map(a=>[a.Timestamp||"",a.Action||"",a.Sheet||"",a["Record ID"]||"",a["Warehouse ID"]||"",a.User||"",a.Details||""])); }
function renderTrash(){ $("#trashTable").innerHTML=table(["Time","Source","Record","Warehouse","Deleted By","Reason"], state.trash.slice().reverse().map(a=>[a.Timestamp||"",a["Source Sheet"]||"",a["Record ID"]||"",a["Warehouse ID"]||"",a["Deleted By"]||"",a.Reason||""])); }
function renderSettingsGrid(){
  const keys = getSettingKeys();

  const catSelect = $("#settingCategorySelect");
  if (catSelect) {
    const old = catSelect.value;
    catSelect.innerHTML = keys.map(k => `<option value="${k}">${settingLabel(k)}</option>`).join("");
    catSelect.value = keys.includes(old) ? old : (keys[0] || "");
  }

  $("#settingsGrid").innerHTML = keys.map(k => {
    const arr = state.settings[k] || [];
    return `<div class="template-card setting-category-card" onclick="selectSettingCategory('${escapeAttr(k)}')">
      <div class="setting-card-head">
        <h4>${settingLabel(k)}</h4>
        <span>${arr.length} รายการ</span>
      </div>
      <p>${arr.slice(0, 8).map(v => `<b>${v}</b>`).join("<br>") || "ยังไม่มีข้อมูล"}</p>
      ${arr.length > 8 ? `<small>+${arr.length - 8} รายการ</small>` : ""}
    </div>`;
  }).join("");

  renderSettingOptionList();
}

function getSettingKeys(){
  const preferred = ["Task Status","Priority","Warehouse Status","Phase","Document Type","Document Status","Event Type","Calendar Status"];
  const existing = Object.keys(state.settings || {});
  return [...new Set([...preferred, ...existing])].filter(Boolean);
}

function settingLabel(key){
  const labels = {
    "Task Status": "สถานะงาน",
    "Priority": "ความสำคัญ",
    "Warehouse Status": "สถานะคลัง",
    "Phase": "เฟสงาน",
    "Document Type": "ประเภทเอกสาร",
    "Document Status": "สถานะเอกสาร",
    "Event Type": "ประเภทแผนงาน",
    "Calendar Status": "สถานะปฏิทิน"
  };
  return labels[key] || key;
}

function selectSettingCategory(key){
  const sel = $("#settingCategorySelect");
  if(sel){
    sel.value = key;
    renderSettingOptionList();
    $(".settings-active-box")?.scrollIntoView({behavior:"smooth", block:"nearest"});
  }
}

function renderSettingOptionList(){
  const key = $("#settingCategorySelect")?.value || getSettingKeys()[0];
  const list = state.settings[key] || [];
  const title = $("#settingActiveTitle");
  if(title) title.textContent = `${settingLabel(key)} (${key})`;

  const box = $("#settingOptionList");
  if(!box) return;

  box.innerHTML = list.length ? list.map(v => `
    <div class="setting-option-pill">
      <span>${v}</span>
      <button type="button" onclick="deleteSettingOptionFromUI('${escapeAttr(key)}','${escapeAttr(v)}')">ลบ</button>
    </div>
  `).join("") : `<div class="empty-doc-box">ยังไม่มีตัวเลือกในหมวดนี้</div>`;
}

async function addSettingOptionFromUI(){
  const category = $("#settingCategorySelect")?.value;
  const value = ($("#settingNewValueInput")?.value || "").trim();

  if(!category) return toast("กรุณาเลือกหมวด Settings");
  if(!value) return toast("กรุณากรอกค่าที่ต้องการเพิ่ม");

  try{
    await api("addSettingOption", { category, value, user: CONFIG.defaultUser });
    $("#settingNewValueInput").value = "";
    toast("เพิ่มตัวเลือกแล้ว");
    await loadAllData();
  }catch(err){
    console.error(err);
    toast("เพิ่มตัวเลือกไม่สำเร็จ: " + err.message);
  }
}

async function deleteSettingOptionFromUI(category, value){
  if(!confirm(`ลบ "${value}" ออกจาก ${settingLabel(category)} ?`)) return;

  try{
    await api("deleteSettingOption", { category, value, user: CONFIG.defaultUser });
    toast("ลบตัวเลือกแล้ว");
    await loadAllData();
  }catch(err){
    console.error(err);
    toast("ลบตัวเลือกไม่สำเร็จ: " + err.message);
  }
}

function escapeAttr(value){
  return String(value || "")
    .replace(/&/g,"&amp;")
    .replace(/'/g,"&#39;")
    .replace(/"/g,"&quot;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;");
}

function renderDropdowns(){
  // Critical function: if missing, renderAll stops and page looks connected but empty.
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

  fillSelectObj($("#taskWarehouseFilter"), [{value:"", label:"ทุกคลัง"}, ...whOpts], "ทุกคลัง", false);
  fillSelect($("#taskStatusFilter"), ["", ...(state.settings["Task Status"] || [])], "ทุกสถานะ", false);

  const docWhFilter = $("#documentWarehouseFilter");
  if(docWhFilter) fillSelectObj(docWhFilter, [{value:"", label:"ทุกคลัง"}, ...whOpts], "ทุกคลัง", false);

  const docTypeFilter = $("#documentTypeFilter");
  if(docTypeFilter) fillSelect(docTypeFilter, ["", ...(state.settings["Document Type"] || [])], "ทุกประเภท", false);

  const whStatusFilter = $("#warehouseStatusFilter");
  if(whStatusFilter) fillSelect(whStatusFilter, ["", ...(state.settings["Warehouse Status"] || [])], "ทุกสถานะ", false);

  const caseSelect = $("#checklistCaseFilter");
  if(caseSelect){
    const old = caseSelect.value;
    const caseTypes = ["", ...new Set(["Standard","Urgent","Small Site","Large Warehouse","Custom", ...normalizeChecklistTemplates(state.checklistTemplates).map(t => t["Case Type"] || "Standard")])];
    caseSelect.innerHTML = caseTypes.map(v => `<option value="${v}">${v || "ทุกเคส"}</option>`).join("");
    if(caseTypes.includes(old)) caseSelect.value = old;
  }
}

function fillSelect(sel, arr, placeholder="เลือก", clear=true){
  if(!sel) return;
  const old = sel.value;
  const safe = [...new Set((arr || []).map(v => String(v || "").trim()).filter(v => clear ? true : true))];
  sel.innerHTML = (clear ? `<option value="">${escapeHTML(placeholder)}</option>` : "") +
    safe.map(v => `<option value="${escapeAttr(v)}">${escapeHTML(v)}</option>`).join("");
  if([...sel.options].some(o => o.value === old)) sel.value = old;
}

function fillSelectObj(sel, arr, placeholder="เลือก", clear=true){
  if(!sel) return;
  const old = sel.value;
  const safe = arr || [];
  sel.innerHTML = (clear ? `<option value="">${escapeHTML(placeholder)}</option>` : "") +
    safe.map(o => `<option value="${escapeAttr(o.value)}">${escapeHTML(o.label)}</option>`).join("");
  if([...sel.options].some(o => o.value === old)) sel.value = old;
}

function escapeHTML(value){
  return String(value || "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#39;");
}
function quickStatus(taskId){
  const t = state.tasks.find(x => x["Task ID"] === taskId);
  if(!t) return toast("ไม่พบงาน");
  const statusOpts = (state.settings["Task Status"] || []).map(s =>
    `<option value="${escapeAttr(s)}"${s === t.Status ? " selected" : ""}>${escapeHTML(s)}</option>`
  ).join("");
  openModal(`
    <h3 style="margin:0 0 16px">📋 แก้สถานะ — ${escapeHTML(t["Task Name"])}</h3>
    <div class="form-grid">
      <label>สถานะ<select id="modalStatus">${statusOpts}</select></label>
      <label>Progress %<input type="number" id="modalProgress" min="0" max="100" value="${t["Progress %"]||0}"></label>
      <label class="full">หมายเหตุ<textarea id="modalNote" placeholder="หมายเหตุ...">${escapeHTML(t.Notes||"")}</textarea></label>
    </div>
    <div class="button-row" style="margin-top:16px">
      <button class="primary-btn" onclick="updateStatus('${escapeAttr(taskId)}',this)">💾 บันทึก</button>
      <button class="ghost-btn" onclick="closeModal()">ยกเลิก</button>
    </div>
  `);
}

async function updateStatus(taskId, btn){
  const status   = $("#modalStatus")?.value;
  const progress = $("#modalProgress")?.value;
  const note     = $("#modalNote")?.value;
  await withLoading(btn, async () => {
    await postAndRefresh("updateStatus", {taskId, status, progress, note, user: CONFIG.defaultUser}, "อัปเดตสถานะแล้ว ✅");
    closeModal();
  });
}
function prefillTaskWarehouse(id){ showView("addTask"); $("#taskWarehouseSelect").value=id; }
async function deleteRecord(sheet,recordId){
  if(!confirm(`ยืนยันลบ ${recordId} จาก ${sheet}? ข้อมูลจะเข้า Trash`)) return;
  await postAndRefresh("deleteRecord",{sheet,recordId,user:CONFIG.defaultUser,reason:"Deleted from web"},"ลบข้อมูลแล้ว");
}
async function createChecklistForWarehouse(){
  const wh = $("#checklistWarehouseSelect").value;
  const caseType = $("#checklistCaseFilter")?.value || "";
  if(!wh) return toast("เลือกคลังก่อน");

  if(!confirm(`สร้าง Checklist ${caseType || "ทุกเคส"} ให้คลัง ${whName(wh)} ?`)) return;

  await postAndRefresh("createChecklist", {
    warehouseId: wh,
    caseType,
    user: CONFIG.defaultUser
  }, "สร้าง Checklist แล้ว");
}

function initSettingsFields(){ $("#sheetIdInput").value=CONFIG.spreadsheetId; $("#apiUrlInput").value=CONFIG.apiUrl; $("#defaultUserInput").value=CONFIG.defaultUser; $("#dueSoonDaysInput").value=CONFIG.dueSoonDays; }
function saveSettings(e){ e.preventDefault(); localStorage.setItem("spx_sheet_id",$("#sheetIdInput").value.trim()); localStorage.setItem("spx_api_url",$("#apiUrlInput").value.trim()); localStorage.setItem("spx_default_user",$("#defaultUserInput").value.trim()||"System"); localStorage.setItem("spx_due_soon_days",$("#dueSoonDaysInput").value||3); Object.assign(CONFIG,{spreadsheetId:$("#sheetIdInput").value.trim(),apiUrl:$("#apiUrlInput").value.trim(),defaultUser:$("#defaultUserInput").value.trim()||"System",dueSoonDays:Number($("#dueSoonDaysInput").value||3)}); toast("บันทึกการตั้งค่าแล้ว"); loadAllData(); }
async function testApi(){ try{ await api("ping",{},"GET"); toast("เชื่อมต่อ API สำเร็จ"); }catch(e){ toast("เชื่อมต่อไม่สำเร็จ: "+e.message); } }
function saveFormMemory(form,key){ const obj=dataFromForm(form); localStorage.setItem("spx_memory_"+key,JSON.stringify(obj)); }
function loadMemoryIntoForms(){ ["task","warehouse"].forEach(key=>{ const obj=JSON.parse(localStorage.getItem("spx_memory_"+key)||"{}"); const form=$("#"+(key==="task"?"taskForm":"warehouseForm")); if(form) Object.entries(obj).forEach(([k,v])=>{ if(form.elements[k]) form.elements[k].value=v; }); }); }

function seedDemo(){
  state.warehouses=[{"Warehouse ID":"WH-0001","Warehouse Name":"คลังตัวอย่าง","Location / Zone":"กรุงเทพฯ / Zone A",Owner:"Earth","Owner Phone":"","Warehouse Status":"กำลังปิดคลัง"}];
  state.tasks=[{"Task ID":"T-0001","Created Date":todayISO(),"Warehouse ID":"WH-0001",Phase:"เฟส 1 · ตรวจสัญญาและแจ้งเลิก","Task Name":"ตรวจสัญญาเช่า","Assignee":"Earth",Status:"กำลังดำเนินการ",Priority:"สูง","Due Date":todayISO(),"Progress %":"30",Notes:"Demo task"}];
  state.documents=[]; state.calendar=[]; state.activity=[]; state.issues=[]; state.trash=[]; ensureDefaultSettings();
}
async function demoApi(action,payload){
  if(action==="getAllData") return {success:true,data:{Warehouses:state.warehouses,Tasks:state.tasks,Documents:state.documents,Calendar:state.calendar,Activity_Log:state.activity,Settings:[],Issues:state.issues,Checklist_Templates:state.checklistTemplates,Trash:state.trash}};
  const log=(sheet,id,details)=>state.activity.push({Timestamp:new Date().toLocaleString("th-TH"),Action:action,Sheet:sheet,"Record ID":id,"Warehouse ID":payload["Warehouse ID"]||payload.warehouseId||"",User:CONFIG.defaultUser,Details:details});
  if(action==="addWarehouse"){state.warehouses.push(payload);log("Warehouses",payload["Warehouse ID"],"add warehouse")}
  if(action==="addTask"){state.tasks.push(payload.task);log("Tasks",payload.task["Task ID"],"add task"); if(payload.createCalendar&&payload.task["Due Date"]) state.calendar.push({"Event ID":uid("EV"),"Warehouse ID":payload.task["Warehouse ID"],"Task ID":payload.task["Task ID"],"Event Title":payload.task["Task Name"],"Event Type":"กำหนดส่งงาน","Due Date":payload.task["Due Date"],Assignee:payload.task.Assignee,"Calendar Status":"ยังไม่เตือน"});}
  if(action==="addDocument"){state.documents.push(payload);log("Documents",payload["Document ID"],"add document")}
  if(action==="addCalendarEvent"){state.calendar.push(payload);log("Calendar",payload["Event ID"],"add event")}
  if(action==="addIssue"){state.issues.push(payload);log("Issues",payload["Issue ID"],"add issue")}
  if(action==="updateStatus"){const t=state.tasks.find(x=>x["Task ID"]===payload.taskId); if(t){const old=t.Status;t.Status=payload.status;t["Progress %"]=payload.progress;t["Last Updated"]=new Date().toISOString(); if(payload.status==="ปิดแล้ว"){t["Closed Date"]=todayISO();t["Progress %"]=100} log("Tasks",payload.taskId,`status ${old} -> ${payload.status}`)}}
  if(action==="deleteRecord"){let map={Warehouses:state.warehouses,Tasks:state.tasks,Documents:state.documents,Calendar:state.calendar,Issues:state.issues}; const idField={Warehouses:"Warehouse ID",Tasks:"Task ID",Documents:"Document ID",Calendar:"Event ID",Issues:"Issue ID"}[payload.sheet]; const arr=map[payload.sheet]; const idx=arr?.findIndex(x=>x[idField]===payload.recordId); if(idx>=0){const snap=arr.splice(idx,1)[0]; state.trash.push({Timestamp:new Date().toLocaleString("th-TH"),"Source Sheet":payload.sheet,"Record ID":payload.recordId,"Warehouse ID":snap["Warehouse ID"]||payload.recordId,"Deleted By":CONFIG.defaultUser,Reason:payload.reason,"Snapshot JSON":JSON.stringify(snap)});}}
  if(action==="addSettingOption"){
    const cat = payload.category, val = payload.value;
    state.settings[cat] ||= [];
    if(!state.settings[cat].includes(val)) state.settings[cat].push(val);
  }
  if(action==="deleteSettingOption"){
    const cat = payload.category, val = payload.value;
    state.settings[cat] = (state.settings[cat] || []).filter(x => x !== val);
  }
  if(action==="updateWarehouse"){
    const idx = state.warehouses.findIndex(w => w["Warehouse ID"] === payload.warehouseId);
    if(idx >= 0){
      const editableFields = ["Warehouse Name","Location / Zone","Owner","Owner Phone","Start Date","Target Handover Date","Warehouse Status","Document Folder Link","Notes"];
      editableFields.forEach(f => { if(payload[f] !== undefined && payload[f] !== null) state.warehouses[idx][f] = payload[f]; });
      log("Warehouses", payload.warehouseId, "Updated warehouse");
    }
  }
  if(action==="addChecklistTemplate"){
    state.checklistTemplates.push(payload.template);
  }
  if(action==="updateChecklistTemplate"){
    const idx = state.checklistTemplates.findIndex(t => t["Template ID"] === payload.template["Template ID"]);
    if(idx >= 0) state.checklistTemplates[idx] = payload.template;
    else state.checklistTemplates.push(payload.template);
  }
  if(action==="deleteChecklistTemplate"){
    state.checklistTemplates = state.checklistTemplates.filter(t => t["Template ID"] !== payload.templateId);
  }
  if(action==="createChecklist"){normalizeChecklistTemplates(state.checklistTemplates).filter(t => String(t.Active || "TRUE").toUpperCase() !== "FALSE" && (!payload.caseType || (t["Case Type"] || "Standard") === payload.caseType)).forEach(t=>state.tasks.push({"Task ID":uid("T"),"Created Date":todayISO(),"Warehouse ID":payload.warehouseId,Phase:t.Phase,"Task Name":t["Task Name"],Assignee:t["Default Assignee"]||"",Status:t["Default Status"]||"To Do",Priority:t.Priority||"กลาง","Due Date":addDays(todayISO(),Number(t["Default Due Offset Days"]||7)),"Progress %":0,Notes:t.Notes||""}));}
  return {success:true};
}
function addDays(iso,n){ const d=parseDate(iso); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10); }

function renderDailyReport(){
  const el = $("#dailyReport");
  if(!el) return;
  const today = todayISO();
  const overdue = overdueTasks(state.tasks);
  const todayTasks = state.tasks.filter(t => !isClosed(t) && fmtDate(t["Due Date"]) === today);
  const openIssues = state.issues.filter(i => i.Status !== "Closed" && i.Status !== "ปิดแล้ว");
  const progress = avgProgress(state.tasks);
  let lines = [];
  lines.push(`📊 SPX Closure Control Tower — Daily Report`);
  lines.push(`📅 วันที่: ${new Date().toLocaleDateString("th-TH",{year:"numeric",month:"long",day:"numeric"})}`);
  lines.push(`─────────────────────────────────`);
  lines.push(`🏢 คลังทั้งหมด: ${state.warehouses.length}`);
  lines.push(`📋 งานทั้งหมด: ${state.tasks.length}  |  ปิดแล้ว: ${state.tasks.filter(isClosed).length}`);
  lines.push(`📈 ความคืบหน้าเฉลี่ย: ${progress}%`);
  lines.push(`─────────────────────────────────`);
  if(overdue.length){
    lines.push(`🔥 งานเลยกำหนด (${overdue.length} รายการ):`);
    overdue.forEach(t => lines.push(`  • ${t["Task ID"]} ${t["Task Name"]} [${whName(t["Warehouse ID"])}] Due: ${t["Due Date"]||"-"}`));
    lines.push("");
  }
  if(todayTasks.length){
    lines.push(`📅 ครบกำหนดวันนี้ (${todayTasks.length} รายการ):`);
    todayTasks.forEach(t => lines.push(`  • ${t["Task ID"]} ${t["Task Name"]} [${whName(t["Warehouse ID"])}]`));
    lines.push("");
  }
  if(openIssues.length){
    lines.push(`🚨 Issues ที่ยังเปิดอยู่ (${openIssues.length} รายการ):`);
    openIssues.forEach(i => lines.push(`  • ${i["Issue ID"]} ${i["Issue Title"]} [${i.Status}] ${i.Priority||""}`));
    lines.push("");
  }
  lines.push(`─────────────────────────────────`);
  lines.push(`สร้างโดย SPX Closure Control Tower V3.5`);
  el.textContent = lines.join("\n");
}
