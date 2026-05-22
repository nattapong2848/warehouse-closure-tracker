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
  $("#copyReportBtn")?.addEventListener("click", () => navigator.clipboard.writeText($("#dailyReport").textContent).then(()=>toast("คัดลอกรายงานแล้ว")));
  $("#prevMonth")?.addEventListener("click", () => changeMonth(-1));
  $("#nextMonth")?.addEventListener("click", () => changeMonth(1));
  $("#calendarMonth")?.addEventListener("change", e => { state.calendarCursor=e.target.value; renderCalendar(); });
  $("#createChecklistBtn")?.addEventListener("click", createChecklistForWarehouse);
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
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(m) return new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00`);
  const d = new Date(s);
  return isNaN(d) ? null : d;
}
function fmtDate(v){ const d=parseDate(v); return d ? d.toISOString().slice(0,10) : ""; }
function daysDiff(dateStr){ const d=parseDate(dateStr); if(!d) return null; return Math.floor((d - parseDate(todayISO()))/86400000); }
function uid(prefix){ return prefix + "-" + Math.floor(1000 + Math.random()*9000) + Date.now().toString().slice(-3); }
function toast(msg){ const t=$("#toast"); t.textContent=msg; t.classList.add("show"); setTimeout(()=>t.classList.remove("show"),2600); }
function openModal(html){ $("#modalBody").innerHTML=html; $("#modal").classList.remove("hidden"); }
function closeModal(){ $("#modal").classList.add("hidden"); }

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
  if(!rows?.length) return {};
  const headers = Object.keys(rows[0]).length ? Object.keys(rows[0]) : [];
  const out = {};
  if(headers.length){
    headers.forEach(h => out[h] = rows.map(r=>r[h]).filter(Boolean));
  }
  return out;
}
function ensureDefaultSettings(){
  state.settings["Task Status"] ||= ["Backlog","To Do","กำลังดำเนินการ","รอเอกสาร","รอ Vendor","ติดขัด","ปิดแล้ว"];
  state.settings["Priority"] ||= ["สูงมาก","สูง","กลาง","ต่ำ"];
  state.settings["Warehouse Status"] ||= ["ยังไม่เริ่ม","กำลังปิดคลัง","รอส่งมอบ","ส่งมอบแล้ว","ปิดโครงการแล้ว"];
  state.settings["Phase"] ||= ["เฟส 1 · ตรวจสัญญาและแจ้งเลิก","เฟส 2 · วางแผนและตั้งทีม","เฟส 3 · เคลียร์ทรัพย์สินและสต๊อก","เฟส 4 · ยกเลิก Vendor และสาธารณูปโภค","เฟส 5 · คืนสภาพพื้นที่","เฟส 6 · ส่งมอบพื้นที่","เฟส 7 · ปิดการเงินและเงินประกัน"];
  state.settings["Document Type"] ||= ["สัญญาเช่า","ใบส่งมอบพื้นที่","รูปภาพพื้นที่","ใบเสนอราคา","Invoice / PO","อื่น ๆ"];
  state.settings["Document Status"] ||= ["รอตรวจสอบ","ผ่าน","ต้องแก้ไข"];
  state.settings["Event Type"] ||= ["กำหนดส่งงาน","นัดหมาย","ตรวจพื้นที่","ติดตามเอกสาร","แจ้งเตือน"];
  state.settings["Calendar Status"] ||= ["ยังไม่เตือน","เตือนแล้ว","เสร็จสิ้น","ยกเลิก"];
  if(!state.checklistTemplates.length){
    state.checklistTemplates = [
      {"Template ID":"TPL-001","Phase":"เฟส 1 · ตรวจสัญญาและแจ้งเลิก","Task Name":"ตรวจสัญญาเช่าและสรุปเงื่อนไขสำคัญ","Priority":"สูง","Default Status":"To Do","Default Due Offset Days":"3","Document Required":"สัญญาเช่า"},
      {"Template ID":"TPL-002","Phase":"เฟส 1 · ตรวจสัญญาและแจ้งเลิก","Task Name":"ส่งหนังสือแจ้งเลิก/ไม่ต่อสัญญา","Priority":"สูงมาก","Default Status":"To Do","Default Due Offset Days":"5","Document Required":"หนังสือแจ้งเลิก"},
      {"Template ID":"TPL-003","Phase":"เฟส 3 · เคลียร์ทรัพย์สินและสต๊อก","Task Name":"ตรวจนับทรัพย์สินและสินค้าในพื้นที่","Priority":"สูง","Default Status":"To Do","Default Due Offset Days":"10","Document Required":"Inventory List"},
      {"Template ID":"TPL-004","Phase":"เฟส 5 · คืนสภาพพื้นที่","Task Name":"ทำ Defect List และคืนสภาพพื้นที่","Priority":"สูงมาก","Default Status":"To Do","Default Due Offset Days":"18","Document Required":"รูปภาพพื้นที่"},
      {"Template ID":"TPL-005","Phase":"เฟส 6 · ส่งมอบพื้นที่","Task Name":"Final Walkthrough และเซ็นเอกสารส่งมอบ","Priority":"สูงมาก","Default Status":"To Do","Default Due Offset Days":"21","Document Required":"ใบส่งมอบพื้นที่"}
    ];
  }
}
function renderAll(){
  renderDropdowns(); renderDashboard(); renderWarehouseStatus(); renderProfiles(); renderTasks(); renderDocuments(); renderCalendar(); renderIssues(); renderChecklist(); renderDailyReport(); renderActivity(); renderTrash(); renderSettingsGrid();
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
  const total=state.tasks.length, done=state.tasks.filter(isClosed).length, active=state.tasks.filter(t=>!isClosed(t)&&t.Status==="กำลังดำเนินการ").length, overdue=overdueTasks(state.tasks).length, progress=avgProgress(state.tasks);
  $("#kpiWarehouses").textContent=state.warehouses.length; $("#kpiTasks").textContent=total; $("#kpiActive").textContent=active; $("#kpiDone").textContent=done; $("#kpiOverdue").textContent=overdue; $("#kpiProgress").textContent=progress+"%"; $("#overallProgress").textContent=progress+"%";
  const counts={}; state.tasks.forEach(t=>counts[t.Status||"ไม่ระบุ"]=(counts[t.Status||"ไม่ระบุ"]||0)+1);
  $("#statusBars").innerHTML = Object.entries(counts).map(([k,v])=>`<div class="bar-row"><span>${k}</span><div class="bar-track"><div class="bar-fill" style="width:${total?Math.round(v/total*100):0}%"></div></div><b>${v}</b></div>`).join("") || empty("ยังไม่มีงาน");
  const follow=dueSoonTasks(state.tasks).slice(0,8);
  $("#followUpList").innerHTML = follow.map(taskMini).join("") || empty("ยังไม่มีงานที่ต้องตาม");
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
      <div class="button-row" style="margin-top:14px"><button class="tiny-btn orange" onclick="openProfile('${w["Warehouse ID"]}')">ดูโปรไฟล์</button><button class="tiny-btn" onclick="prefillTaskWarehouse('${w["Warehouse ID"]}')">เพิ่มงาน</button><button class="tiny-btn red" onclick="deleteRecord('Warehouses','${w["Warehouse ID"]}')">ลบคลัง</button></div>
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
  state.selectedWarehouseId=id; localStorage.setItem("spx_selected_wh",id); showView("profiles");
  const w=whById(id), tasks=tasksForWarehouse(id), docs=state.documents.filter(d=>d["Warehouse ID"]===id), events=state.calendar.filter(e=>e["Warehouse ID"]===id), issues=state.issues.filter(i=>i["Warehouse ID"]===id);
  $("#profileDetail").classList.remove("hidden");
  $("#profileDetail").innerHTML=`<section class="panel">
    <div class="panel-head split"><div><h3>${w["Warehouse Name"]}</h3><span>${w["Location / Zone"]||"-"} · Owner: ${w.Owner||"-"}</span></div><div class="progress-ring" style="--p:${avgProgress(tasks)}" data-p="${avgProgress(tasks)}%"></div></div>
    <div class="kpi-grid"><article class="kpi"><p>งานทั้งหมด</p><strong>${tasks.length}</strong></article><article class="kpi"><p>งานค้าง</p><strong>${pendingTasks(tasks).length}</strong></article><article class="kpi danger"><p>เลยกำหนด</p><strong>${overdueTasks(tasks).length}</strong></article><article class="kpi"><p>เอกสาร</p><strong>${docs.length}</strong></article><article class="kpi"><p>แผนงาน</p><strong>${events.length}</strong></article><article class="kpi danger"><p>Issues</p><strong>${issues.filter(i=>i.Status!=="Closed").length}</strong></article></div>
    <div class="grid-2"><div><h3>งานของคลังนี้</h3>${tasks.map(taskMini).join("")||empty("ไม่มีงาน")}</div><div><h3>เอกสารของคลังนี้</h3>${docs.map(d=>`<div class="mini-card"><div><b>${d["Document Name"]}</b><small>${d["Document Type"]} · ${d["Document Status"]||"-"}</small></div><a class="tiny-btn orange" href="${d["File Link"]||"#"}" target="_blank">เปิด</a></div>`).join("")||empty("ไม่มีเอกสาร")}</div></div>
  </section>`;
  $("#profileDetail").scrollIntoView({behavior:"smooth",block:"start"});
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
  $("#calendarMonth").value = state.calendarCursor;
  const [y,m]=state.calendarCursor.split("-").map(Number);
  const first=new Date(y,m-1,1), start=new Date(first); start.setDate(1-first.getDay());
  const names=["อา","จ","อ","พ","พฤ","ศ","ส"]; let html=names.map(n=>`<div class="cal-day-name">${n}</div>`).join("");
  const eventsByDate={};
  [...state.calendar, ...state.tasks.map(t=>({"Event ID":t["Task ID"],"Warehouse ID":t["Warehouse ID"],"Task ID":t["Task ID"],"Event Title":t["Task Name"],"Event Type":"Task Due","Due Date":t["Due Date"],"Assignee":t.Assignee,Status:t.Status}))].forEach(e=>{
    const d=fmtDate(e["Due Date"]||e["Start Date"]); if(!d) return; (eventsByDate[d] ||= []).push(e);
  });
  for(let i=0;i<42;i++){
    const d=new Date(start); d.setDate(start.getDate()+i); const iso=d.toISOString().slice(0,10); const arr=eventsByDate[iso]||[];
    html += `<div class="cal-cell ${d.getMonth()!==m-1?"other":""}" onclick="selectCalendarDay('${iso}')"><div class="cal-date">${d.getDate()}</div>${arr.slice(0,3).map(e=>`<div class="cal-event ${daysDiff(iso)<0?"overdue":iso===todayISO()?"today":""}" onclick="event.stopPropagation(); openEventDetail('${e["Event ID"]||""}','${e["Task ID"]||""}')">${e["Event Title"]}</div>`).join("")}${arr.length>3?`<small>+${arr.length-3} more</small>`:""}</div>`;
  }
  $("#monthCalendar").innerHTML=html; renderSelectedDay();
}
function selectCalendarDay(iso){ state.selectedCalendarDate=iso; renderSelectedDay(); }
function renderSelectedDay(){
  $("#selectedDayTitle").textContent = state.selectedCalendarDate || "เลือกวันที่";
  const arr=[...state.calendar, ...state.tasks.map(t=>({"Event ID":t["Task ID"],"Task ID":t["Task ID"],"Warehouse ID":t["Warehouse ID"],"Event Title":t["Task Name"],"Event Type":"Task Due","Due Date":t["Due Date"],"Assignee":t.Assignee}))].filter(e=>fmtDate(e["Due Date"]||e["Start Date"])===state.selectedCalendarDate);
  $("#selectedDayEvents").innerHTML=arr.map(e=>`<div class="mini-card"><div><b>${e["Event Title"]}</b><small>${whName(e["Warehouse ID"])} · ${e["Event Type"]}</small></div>${e["Task ID"]?`<button class="tiny-btn orange" onclick="quickStatus('${e["Task ID"]}')">งาน</button>`:""}</div>`).join("") || empty("วันนี้ไม่มีแผนงาน");
}
function changeMonth(n){ const [y,m]=state.calendarCursor.split("-").map(Number); const d=new Date(y,m-1+n,1); state.calendarCursor=d.toISOString().slice(0,7); renderCalendar(); }
function openEventDetail(id,taskId){ if(taskId) quickStatus(taskId); }

function renderIssues(){ $("#issuesList").innerHTML=state.issues.map(i=>`<div class="mini-card"><div><b>${i["Issue Title"]}</b><small>${whName(i["Warehouse ID"])} · ${i.Status} · ${i.Priority||"-"}</small></div><button class="tiny-btn red" onclick="deleteRecord('Issues','${i["Issue ID"]}')">ลบ</button></div>`).join("") || empty("ยังไม่มี Issue"); }
function renderChecklist(){ $("#checklistTemplates").innerHTML=state.checklistTemplates.map(t=>`<div class="template-card"><h4>${t["Task Name"]}</h4><small>${t.Phase} · ${t.Priority}</small><p>${t.Notes||""}</p></div>`).join(""); }

function renderDailyReport(){
  const follow=dueSoonTasks(state.tasks), done=state.tasks.filter(isClosed), issues=state.issues.filter(i=>i.Status!=="Closed");
  $("#dailyReport").textContent = `รายงานงานปิดคลังสินค้า SPX\nวันที่ ${todayISO()}\n\nภาพรวม\n- คลังทั้งหมด: ${state.warehouses.length}\n- งานทั้งหมด: ${state.tasks.length}\n- งานปิดแล้ว: ${done.length}\n- งานที่ต้องตาม: ${follow.length}\n- Issue เปิดอยู่: ${issues.length}\n- ความคืบหน้าเฉลี่ย: ${avgProgress(state.tasks)}%\n\nงานที่ต้องตามด่วน\n${follow.map(t=>`- ${t["Task ID"]} ${t["Task Name"]} | ${whName(t["Warehouse ID"])} | ${t.Status} | Due ${t["Due Date"]||"-"}`).join("\n") || "- ไม่มี"}\n\nRisks / Issues\n${issues.map(i=>`- ${i["Issue ID"]} ${i["Issue Title"]} | ${whName(i["Warehouse ID"])} | ${i.Priority||"-"}`).join("\n") || "- ไม่มี"}`;
}
function renderActivity(){ $("#activityTable").innerHTML=table(["Time","Action","Sheet","Record","Warehouse","User","Details"], state.activity.slice().reverse().map(a=>[a.Timestamp||"",a.Action||"",a.Sheet||"",a["Record ID"]||"",a["Warehouse ID"]||"",a.User||"",a.Details||""])); }
function renderTrash(){ $("#trashTable").innerHTML=table(["Time","Source","Record","Warehouse","Deleted By","Reason"], state.trash.slice().reverse().map(a=>[a.Timestamp||"",a["Source Sheet"]||"",a["Record ID"]||"",a["Warehouse ID"]||"",a["Deleted By"]||"",a.Reason||""])); }
function renderSettingsGrid(){ $("#settingsGrid").innerHTML=Object.entries(state.settings).map(([k,arr])=>`<div class="template-card"><h4>${k}</h4><p>${arr.join("<br>")}</p></div>`).join(""); }

function renderDropdowns(){
  $$("[data-setting]").forEach(sel=>fillSelect(sel,state.settings[sel.dataset.setting]||[], sel.dataset.setting));
  const whOpts=state.warehouses.map(w=>({value:w["Warehouse ID"],label:`${w["Warehouse Name"]} (${w["Warehouse ID"]})`}));
  ["taskWarehouseSelect","docWarehouseSelect","calWarehouseSelect","issueWarehouseSelect","checklistWarehouseSelect"].forEach(id=>fillSelectObj($("#"+id),whOpts,"เลือกคลัง"));
  fillSelectObj($("#taskWarehouseFilter"),[{value:"",label:"ทุกคลัง"},...whOpts],"ทุกคลัง",false);
  fillSelect($("#taskStatusFilter"),["",...(state.settings["Task Status"]||[])],"ทุกสถานะ",false);
}
function fillSelect(sel,arr,placeholder="เลือก",clear=true){ if(!sel) return; const old=sel.value; sel.innerHTML = (clear?`<option value="">${placeholder}</option>`:"") + arr.map(v=>`<option value="${v}">${v}</option>`).join(""); if([...sel.options].some(o=>o.value===old)) sel.value=old; }
function fillSelectObj(sel,arr,placeholder="เลือก",clear=true){ if(!sel) return; const old=sel.value; sel.innerHTML = (clear?`<option value="">${placeholder}</option>`:"") + arr.map(o=>`<option value="${o.value}">${o.label}</option>`).join(""); if([...sel.options].some(o=>o.value===old)) sel.value=old; }

function dataFromForm(form){ return Object.fromEntries(new FormData(form).entries()); }
async function submitWarehouse(e){ e.preventDefault(); const d=dataFromForm(e.target); saveFormMemory(e.target,"warehouse"); const payload={"Warehouse ID":uid("WH"),"Warehouse Name":d.warehouseName,"Location / Zone":d.location,Owner:d.owner,"Owner Phone":d.ownerPhone,"Start Date":d.startDate,"Target Handover Date":d.targetDate,"Warehouse Status":d.status,"Document Folder Link":d.folderLink,Notes:d.notes,"Created At":new Date().toISOString(),"Updated At":new Date().toISOString()}; await postAndRefresh("addWarehouse",payload,"บันทึกคลังแล้ว"); e.target.reset(); }
async function submitTask(e){ e.preventDefault(); const d=dataFromForm(e.target); saveFormMemory(e.target,"task"); const payload={"Task ID":uid("T"),"Created Date":todayISO(),"Warehouse ID":d.warehouseId,Phase:d.phase,"Task Name":d.taskName,Assignee:d.assignee,Status:d.status,Priority:d.priority,"Due Date":d.dueDate,"Progress %":d.progress,"Closed Date":"","Evidence Link":d.evidenceLink,"Last Updated":new Date().toISOString(),Notes:d.notes}; await postAndRefresh("addTask",{task:payload,createCalendar:!!d.createCalendar},"บันทึกงานแล้ว"); e.target.reset(); }
async function submitDocument(e){ e.preventDefault(); const d=dataFromForm(e.target); const payload={"Document ID":uid("DOC"),"Warehouse ID":d.warehouseId,"Task ID":d.taskId,"Document Type":d.docType,"Document Name":d.docName,"File Link":d.fileLink,"Document Status":d.docStatus,"Uploaded By":d.uploadedBy,"Uploaded Date":todayISO(),Notes:d.notes}; await postAndRefresh("addDocument",payload,"เพิ่มเอกสารแล้ว"); e.target.reset(); }
async function submitCalendarEvent(e){ e.preventDefault(); const d=dataFromForm(e.target); const payload={"Event ID":uid("EV"),"Warehouse ID":d.warehouseId,"Task ID":d.taskId,"Event Title":d.eventTitle,"Event Type":d.eventType,"Start Date":d.startDate,"Due Date":d.dueDate,Assignee:d.assignee,"Reminder Days":d.reminderDays,"Calendar Status":"ยังไม่เตือน",Notes:d.notes}; await postAndRefresh("addCalendarEvent",payload,"เพิ่มแผนงานแล้ว"); state.calendarCursor=(d.dueDate||todayISO()).slice(0,7); state.selectedCalendarDate=d.dueDate||todayISO(); e.target.reset(); showView("calendar"); }
async function submitIssue(e){ e.preventDefault(); const d=dataFromForm(e.target); const payload={"Issue ID":uid("ISS"),"Warehouse ID":d.warehouseId,"Task ID":d.taskId,"Issue Title":d.issueTitle,Impact:d.impact,Owner:d.owner,Status:d.status,Priority:d.priority,"Due Date":d.dueDate,Solution:d.solution,"Created Date":todayISO(),Notes:""}; await postAndRefresh("addIssue",payload,"เพิ่ม Issue แล้ว"); e.target.reset(); }
async function postAndRefresh(action,payload,msg){ try{ await api(action,payload); toast(msg); await loadAllData(); }catch(err){ console.error(err); toast("บันทึกไม่สำเร็จ: "+err.message); } }

function quickStatus(taskId){
  const t=state.tasks.find(x=>x["Task ID"]===taskId); if(!t) return;
  openModal(`<h2>แก้สถานะ: ${t["Task ID"]}</h2><p><b>${t["Task Name"]}</b><br>${whName(t["Warehouse ID"])}</p>
    <label>สถานะใหม่<select id="modalStatus">${(state.settings["Task Status"]||[]).map(s=>`<option ${s===t.Status?"selected":""}>${s}</option>`).join("")}</select></label>
    <label>Progress %<input id="modalProgress" type="number" min="0" max="100" value="${t["Progress %"]||0}"></label>
    <label>หมายเหตุ<textarea id="modalNote"></textarea></label>
    <button class="primary-btn wide" onclick="updateStatus('${taskId}')">บันทึกสถานะ</button>`);
}
async function updateStatus(taskId){
  const t=state.tasks.find(x=>x["Task ID"]===taskId), status=$("#modalStatus").value, progress=$("#modalProgress").value, note=$("#modalNote").value;
  await postAndRefresh("updateStatus",{taskId,status,progress,note,user:CONFIG.defaultUser},"อัปเดตสถานะแล้ว"); closeModal();
}
function prefillTaskWarehouse(id){ showView("addTask"); $("#taskWarehouseSelect").value=id; }
async function deleteRecord(sheet,recordId){
  if(!confirm(`ยืนยันลบ ${recordId} จาก ${sheet}? ข้อมูลจะเข้า Trash`)) return;
  await postAndRefresh("deleteRecord",{sheet,recordId,user:CONFIG.defaultUser,reason:"Deleted from web"},"ลบข้อมูลแล้ว");
}
async function createChecklistForWarehouse(){
  const wh=$("#checklistWarehouseSelect").value; if(!wh) return toast("เลือกคลังก่อน");
  await postAndRefresh("createChecklist",{warehouseId:wh,user:CONFIG.defaultUser},"สร้าง Checklist แล้ว");
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
  if(action==="createChecklist"){state.checklistTemplates.forEach(t=>state.tasks.push({"Task ID":uid("T"),"Created Date":todayISO(),"Warehouse ID":payload.warehouseId,Phase:t.Phase,"Task Name":t["Task Name"],Assignee:t["Default Assignee"]||"",Status:t["Default Status"]||"To Do",Priority:t.Priority||"กลาง","Due Date":addDays(todayISO(),Number(t["Default Due Offset Days"]||7)),"Progress %":0,Notes:t.Notes||""}));}
  return {success:true};
}
function addDays(iso,n){ const d=parseDate(iso); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10); }
