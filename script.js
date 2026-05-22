
const DEFAULT_SHEET_ID = "1gNnjKeqxaE6TtCOOXOqnaG_E0v5dQtUmE_KfLgoo6hI";
const CONFIG = {
  spreadsheetId: localStorage.getItem("spx_sheet_id") || DEFAULT_SHEET_ID,
  apiUrl: localStorage.getItem("spx_api_url") || ""
};
const STATE = {
  warehouses: [], tasks: [], documents: [], calendar: [], activity: [], settings: {},
  issues: [], templates: [], trash: [], selectedWarehouse: localStorage.getItem("last_selected_warehouse") || "",
  calendarDate: new Date()
};
const SHEETS = {
  warehouses: "Warehouses", tasks: "Tasks", documents: "Documents", calendar: "Calendar",
  activity: "Activity_Log", issues: "Issues", templates: "Checklist_Templates", trash: "Trash", settings: "Settings"
};
const HEADERS = {
  Warehouses:["Warehouse ID","Warehouse Name","Location / Zone","Owner","Owner Phone","Start Date","Target Handover Date","Warehouse Status","Document Folder Link","Notes","Created At","Updated At"],
  Tasks:["Task ID","Created Date","Warehouse ID","Phase","Task Name","Assignee","Status","Priority","Due Date","Progress %","Closed Date","Evidence Link","Last Updated","Notes"],
  Documents:["Document ID","Warehouse ID","Task ID","Document Type","Document Name","File Link","Document Status","Uploaded By","Uploaded Date","Notes"],
  Calendar:["Event ID","Warehouse ID","Task ID","Event Title","Event Type","Start Date","Due Date","Assignee","Reminder Days","Calendar Status","Notes"],
  Issues:["Issue ID","Warehouse ID","Task ID","Issue Title","Impact","Owner","Status","Priority","Due Date","Solution","Created Date","Closed Date","Notes"],
  Activity_Log:["Log ID","Timestamp","Action","Sheet","Record ID","Warehouse ID","User","Details"],
  Trash:["Trash ID","Timestamp","Source Sheet","Record ID","Warehouse ID","Deleted By","Reason","Snapshot JSON"]
};
const $ = (id)=>document.getElementById(id);
const todayISO = () => new Date(Date.now() - new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);
const safe = v => (v ?? "").toString().trim();
const pct = n => Math.max(0, Math.min(100, Number(n)||0));
const byId = (arr, field, id) => arr.find(x=>safe(x[field])===safe(id));
const whName = id => byId(STATE.warehouses,"Warehouse ID",id)?.["Warehouse Name"] || id || "-";
const whObj = id => byId(STATE.warehouses,"Warehouse ID",id) || {};
const statusClass = s => {
  s=safe(s); if(["ปิดแล้ว","เสร็จสิ้น","Resolved"].includes(s)) return "green";
  if(["ติดขัด","เลยกำหนด","Open"].includes(s)) return "red";
  if(["รอเอกสาร","รอ Vendor","Monitoring"].includes(s)) return "violet";
  if(["กำลังดำเนินการ","To Do"].includes(s)) return "orange";
  return "blue";
};
const isClosed = t => ["ปิดแล้ว","เสร็จสิ้น","Closed","Resolved"].includes(safe(t.Status || t["Warehouse Status"]));
const parseDate = v => {
  v = safe(v); if(!v) return null;
  if(/^\d{4}-\d{2}-\d{2}/.test(v)) return new Date(v.slice(0,10)+"T00:00:00");
  const d = new Date(v); return isNaN(d) ? null : d;
};
const daysBetween = (a,b)=> Math.floor((parseDate(a)-parseDate(b))/(86400000));
function toast(msg){ const el=$("toast"); el.textContent=msg; el.classList.add("show"); clearTimeout(window.toastT); window.toastT=setTimeout(()=>el.classList.remove("show"),2800); }
function setConnected(ok){ const b=$("syncBox"); b.classList.toggle("connected",!!ok); $("syncTitle").textContent = ok ? "เชื่อมต่อแล้ว" : "Demo Mode"; $("syncSub").textContent = ok ? "Google Sheet Sync" : "Local Preview"; $("missionPulse").textContent = ok ? "Live API online" : "Awaiting API URL"; }
function apiUrl(){ return safe(CONFIG.apiUrl); }
async function apiGet(action="getAllData", params={}) {
  if(!apiUrl()) throw new Error("NO_API_URL");
  const url = new URL(apiUrl());
  url.searchParams.set("action", action);
  Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,v));
  const res = await fetch(url.toString());
  const json = await res.json();
  if(!json.success) throw new Error(json.message || "API error");
  return json.data;
}
async function apiPost(action, payload={}) {
  if(!apiUrl()) throw new Error("NO_API_URL");
  const res = await fetch(apiUrl(), { method:"POST", body: JSON.stringify({action, ...payload}) });
  const json = await res.json();
  if(!json.success) throw new Error(json.message || "API error");
  return json.data || json;
}
function demoData(){
  return {
    warehouses:[
      {"Warehouse ID":"WH-0001","Warehouse Name":"The Angel Clinic","Location / Zone":"ปทุมธานี","Owner":"Earth","Owner Phone":"0864080008","Start Date":todayISO(),"Target Handover Date":"2026-05-31","Warehouse Status":"กำลังปิดคลัง","Document Folder Link":"","Notes":"Demo warehouse"}
    ],
    tasks:[
      {"Task ID":"T-0001","Created Date":todayISO(),"Warehouse ID":"WH-0001","Phase":"เฟส 1 · ตรวจสัญญาและแจ้งเลิก","Task Name":"ตรวจสัญญาเช่า","Assignee":"Earth","Status":"กำลังดำเนินการ","Priority":"สูง","Due Date":todayISO(),"Progress %":"30","Evidence Link":"","Last Updated":todayISO(),"Notes":"งานตัวอย่าง"},
      {"Task ID":"T-0002","Created Date":todayISO(),"Warehouse ID":"WH-0001","Phase":"เฟส 3 · เคลียร์ทรัพย์สินและสต๊อก","Task Name":"ตรวจนับทรัพย์สิน","Assignee":"Earth","Status":"รอเอกสาร","Priority":"สูงมาก","Due Date":todayISO(),"Progress %":"10","Evidence Link":"","Last Updated":todayISO(),"Notes":"รอรายการทรัพย์สิน"}
    ],
    documents:[{"Document ID":"DOC-0001","Warehouse ID":"WH-0001","Task ID":"T-0001","Document Type":"สัญญาเช่า","Document Name":"สัญญาเช่า","File Link":"","Document Status":"รอตรวจสอบ","Uploaded By":"Earth","Uploaded Date":todayISO(),"Notes":""}],
    calendar:[{"Event ID":"EV-0001","Warehouse ID":"WH-0001","Task ID":"T-0001","Event Title":"ตรวจสัญญาเช่า","Event Type":"กำหนดส่งงาน","Start Date":todayISO(),"Due Date":todayISO(),"Assignee":"Earth","Reminder Days":"2","Calendar Status":"ยังไม่เตือน","Notes":""}],
    activity:[], issues:[], trash:[],
    templates:[
      {"Template ID":"TPL-001","Phase":"เฟส 1 · ตรวจสัญญาและแจ้งเลิก","Task Name":"ตรวจสัญญาเช่าและสรุปเงื่อนไขสำคัญ","Default Assignee":"","Priority":"สูง","Default Status":"To Do","Default Due Offset Days":"3","Document Required":"สัญญาเช่า","Notes":""},
      {"Template ID":"TPL-002","Phase":"เฟส 5 · คืนสภาพพื้นที่","Task Name":"ทำ Defect List และคืนสภาพพื้นที่","Default Assignee":"","Priority":"สูงมาก","Default Status":"To Do","Default Due Offset Days":"18","Document Required":"รูปภาพพื้นที่","Notes":""}
    ],
    settings:{
      "Task Status":["Backlog","To Do","กำลังดำเนินการ","รอเอกสาร","รอ Vendor","ติดขัด","ปิดแล้ว"],
      "Priority":["สูงมาก","สูง","กลาง","ต่ำ"],"Warehouse Status":["ยังไม่เริ่ม","กำลังปิดคลัง","รอส่งมอบ","ส่งมอบแล้ว","ปิดโครงการแล้ว"],
      "Phase":["เฟส 1 · ตรวจสัญญาและแจ้งเลิก","เฟส 2 · วางแผนและตั้งทีม","เฟส 3 · เคลียร์ทรัพย์สินและสต๊อก","เฟส 4 · ยกเลิก Vendor และสาธารณูปโภค","เฟส 5 · คืนสภาพพื้นที่","เฟส 6 · ส่งมอบพื้นที่","เฟส 7 · ปิดการเงินและเงินประกัน"],
      "Document Type":["สัญญาเช่า","ใบส่งมอบพื้นที่","รูปภาพพื้นที่","ใบเสนอราคา","Invoice / PO","อื่น ๆ"], "Document Status":["รอตรวจสอบ","ผ่าน","ต้องแก้ไข"],
      "Event Type":["กำหนดส่งงาน","นัดหมาย","ตรวจพื้นที่","ติดตามเอกสาร","แจ้งเตือน"], "Calendar Status":["ยังไม่เตือน","เตือนแล้ว","เสร็จสิ้น","ยกเลิก"]
    }
  };
}
function applyData(data){
  Object.assign(STATE, {
    warehouses:data.warehouses||[], tasks:data.tasks||[], documents:data.documents||[], calendar:data.calendar||[],
    activity:data.activity||[], settings:data.settings||{}, issues:data.issues||[], templates:data.templates||[], trash:data.trash||[]
  });
  fillDynamicSelects(); renderAll();
}
async function loadAllData(show=false){
  try{
    const data = await apiGet("getAllData");
    applyData(data); setConnected(true); if(show) toast("โหลดข้อมูลล่าสุดแล้ว");
  }catch(e){
    if(!apiUrl() || e.message==="NO_API_URL"){ applyData(demoData()); setConnected(false); if(show) toast("ยังไม่ได้เชื่อม Apps Script - ใช้ Demo Mode"); }
    else { console.error(e); toast("โหลดข้อมูลไม่สำเร็จ: "+e.message); }
  }
}
function fillDynamicSelects(){
  document.querySelectorAll("[data-setting]").forEach(sel=>{
    const key = sel.dataset.setting;
    const options = STATE.settings[key] || demoData().settings[key] || [];
    sel.innerHTML = options.map(o=>`<option value="${o}">${o}</option>`).join("");
  });
  const whOpts = [`<option value="">เลือกคลัง</option>`].concat(STATE.warehouses.map(w=>`<option value="${safe(w["Warehouse ID"])}">${safe(w["Warehouse Name"])} (${safe(w["Warehouse ID"])})</option>`)).join("");
  ["taskWarehouseSelect","docWarehouseSelect","calWarehouseSelect","issueWarehouseSelect","checklistWarehouse"].forEach(id=>{ if($(id)) $(id).innerHTML=whOpts; });
  const whFilter = $("taskWarehouseFilter"); if(whFilter) whFilter.innerHTML = `<option value="">ทุกคลัง</option>` + STATE.warehouses.map(w=>`<option value="${w["Warehouse ID"]}">${w["Warehouse Name"]}</option>`).join("");
  const whStatus = $("warehouseStatusFilter"); if(whStatus) whStatus.innerHTML = `<option value="">ทุกสถานะคลัง</option>` + (STATE.settings["Warehouse Status"]||[]).map(x=>`<option>${x}</option>`).join("");
  const ts = $("taskStatusFilter"); if(ts) ts.innerHTML = `<option value="">ทุกสถานะ</option>` + (STATE.settings["Task Status"]||[]).map(x=>`<option>${x}</option>`).join("");
}
function openView(name){
  document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
  const view = $(name+"View"); if(view) view.classList.add("active");
  document.querySelectorAll(".nav button").forEach(b=>b.classList.toggle("active", b.dataset.view===name));
  const btn = document.querySelector(`.nav button[data-view="${name}"]`);
  $("pageTitle").textContent = btn ? btn.textContent.replace(/[^\u0E00-\u0E7Fa-zA-Z ]/g,"").trim() : "Dashboard";
  if(name==="reports") renderReports();
  if(name==="calendar") renderCalendar();
}
function kpis(){
  const total=STATE.tasks.length, closed=STATE.tasks.filter(isClosed).length;
  const overdue=STATE.tasks.filter(t=>!isClosed(t)&&parseDate(t["Due Date"])&&parseDate(t["Due Date"])<parseDate(todayISO())).length;
  const issues=STATE.issues.filter(i=>!["Resolved","Closed","ปิดแล้ว"].includes(safe(i.Status))).length;
  const wh=STATE.warehouses.length, pending=total-closed, prog= total?Math.round(STATE.tasks.reduce((s,t)=>s+pct(t["Progress %"]),0)/total):0;
  return {wh,total,closed,pending,overdue,issues,prog};
}
function renderDashboard(){
  const k=kpis(); $("overallProgress").textContent=k.prog+"%";
  $("kpiGrid").innerHTML = [
    ["🏢","คลังทั้งหมด",k.wh,"Warehouse profiles"],["📦","งานทั้งหมด",k.total,"Total tasks"],["🔥","งานค้าง",k.pending,"Pending"],["✅","ปิดแล้ว",k.closed,"Completed"],["🚨","เลยกำหนด",k.overdue,"Overdue"],["⚠️","Issues",k.issues,"Open risks"]
  ].map(x=>`<div class="kpi"><i>${x[0]}</i><span>${x[1]}</span><b>${x[2]}</b><small>${x[3]}</small></div>`).join("");
  const groups = groupBy(STATE.tasks,"Status");
  const max = Math.max(1,...Object.values(groups).map(a=>a.length));
  $("statusBars").innerHTML = Object.entries(groups).map(([s,a])=>`<div class="status-row"><span>${s||"-"}</span><div class="bar"><span style="width:${a.length/max*100}%"></span></div><b>${a.length}</b></div>`).join("") || `<div class="empty">ยังไม่มีงาน</div>`;
  const follow = followTasks().slice(0,8);
  $("followList").innerHTML = follow.map(taskFollowHTML).join("") || `<div class="empty">ยังไม่มีงานที่ต้องตาม</div>`;
  $("hotWarehouses").innerHTML = STATE.warehouses.map(w=>warehouseStats(w)).filter(x=>x.pending||x.overdue).slice(0,6).map(s=>`<div class="follow-item"><div><strong>${s.name}</strong><small>${s.pending} งานค้าง · ${s.overdue} เลยกำหนด</small></div><button class="btn ghost" onclick="selectProfile('${s.id}')">เปิด</button></div>`).join("") || `<div class="empty">ทุกคลังดูปกติ</div>`;
  $("issueRadar").innerHTML = STATE.issues.filter(i=>safe(i.Status)!=="Resolved").slice(0,6).map(i=>`<div class="follow-item"><div><strong>${i["Issue Title"]}</strong><small>${whName(i["Warehouse ID"])} · ${i.Owner||"-"}</small></div><span class="badge ${statusClass(i.Priority)}">${i.Priority||"Issue"}</span></div>`).join("") || `<div class="empty">ยังไม่มี Issue เปิดอยู่</div>`;
}
function taskFollowHTML(t){
  const due = safe(t["Due Date"]); const cls = isOverdue(t) ? "red" : isDueSoon(t) ? "orange" : statusClass(t.Status);
  return `<div class="follow-item"><div><strong>${t["Task ID"]} · ${t["Task Name"]}</strong><small>${whName(t["Warehouse ID"])} · Due ${due||"-"} · ${t.Assignee||"-"}</small></div><span class="badge ${cls}">${t.Status||"-"}</span></div>`;
}
function followTasks(){ return STATE.tasks.filter(t=>!isClosed(t)&&(isOverdue(t)||isDueSoon(t)||["ติดขัด","รอเอกสาร","รอ Vendor"].includes(safe(t.Status)))); }
function isOverdue(t){ const d=parseDate(t["Due Date"]); return d && d<parseDate(todayISO()) && !isClosed(t); }
function isDueSoon(t){ const d=parseDate(t["Due Date"]); if(!d||isClosed(t))return false; const diff=(d-parseDate(todayISO()))/86400000; return diff>=0&&diff<=3; }
function warehouseStats(w){
  const id=w["Warehouse ID"], tasks=STATE.tasks.filter(t=>t["Warehouse ID"]===id), closed=tasks.filter(isClosed).length;
  const overdue=tasks.filter(isOverdue).length, pending=tasks.length-closed, progress=tasks.length?Math.round(tasks.reduce((s,t)=>s+pct(t["Progress %"]),0)/tasks.length):0;
  const docs=STATE.documents.filter(d=>d["Warehouse ID"]===id).length, issues=STATE.issues.filter(i=>i["Warehouse ID"]===id && safe(i.Status)!=="Resolved").length;
  const nextDue = tasks.filter(t=>!isClosed(t)&&parseDate(t["Due Date"])).sort((a,b)=>parseDate(a["Due Date"])-parseDate(b["Due Date"]))[0]?.["Due Date"] || "-";
  return {id,name:w["Warehouse Name"],loc:w["Location / Zone"],owner:w.Owner,status:w["Warehouse Status"],tasks,closed,overdue,pending,progress,docs,issues,nextDue,w};
}
function renderWarehouseStatus(){
  const q=safe($("warehouseStatusSearch")?.value).toLowerCase(), status=safe($("warehouseStatusFilter")?.value), att=safe($("warehouseAttentionFilter")?.value);
  let list=STATE.warehouses.map(warehouseStats).filter(s=>(!q||JSON.stringify(s).toLowerCase().includes(q))&&(!status||s.status===status));
  if(att==="pending") list=list.filter(s=>s.pending>0); if(att==="overdue") list=list.filter(s=>s.overdue>0); if(att==="issues") list=list.filter(s=>s.issues>0);
  $("warehouseStatusGrid").innerHTML=list.map(renderWarehouseCard).join("")||`<div class="empty">ไม่พบคลัง</div>`;
}
function renderWarehouseCard(s){
  const pendingTasks=s.tasks.filter(t=>!isClosed(t)).slice(0,4);
  return `<article class="warehouse-card">
    <div class="card-head"><div><h3>${s.name}</h3><small>${s.loc||"-"} · Owner: ${s.owner||"-"}</small></div><div class="progress-ring" style="--p:${s.progress}%"><span>${s.progress}%</span></div></div>
    <div><span class="badge ${statusClass(s.status)}">${s.status||"ไม่ระบุ"}</span></div>
    <div class="metric-row"><div class="metric"><b>${s.tasks.length}</b><span>งาน</span></div><div class="metric"><b>${s.pending}</b><span>ค้าง</span></div><div class="metric"><b>${s.overdue}</b><span>เลยกำหนด</span></div><div class="metric"><b>${s.issues}</b><span>Issue</span></div></div>
    <p><b>Due ถัดไป:</b> ${s.nextDue}</p>
    <div>${pendingTasks.map(t=>`<div class="task-chip"><b>${t["Task ID"]}</b> ${t["Task Name"]}<br><small>${t.Status} · Due ${t["Due Date"]||"-"}</small></div>`).join("") || `<div class="empty">ไม่มีงานค้าง</div>`}</div>
    <div class="card-actions"><button class="btn ghost" onclick="selectProfile('${s.id}')">ดูโปรไฟล์</button><button class="btn ghost" onclick="filterTasksByWarehouse('${s.id}')">ดูงาน</button><button class="btn primary" onclick="prefillTaskWarehouse('${s.id}')">เพิ่มงาน</button><button class="btn danger" onclick="deleteRecord('Warehouses','${s.id}','${s.name}')">ลบ</button></div>
  </article>`;
}
function renderProfileHub(){
  $("profileCards").innerHTML = STATE.warehouses.map(w=> {
    const s=warehouseStats(w); return `<button class="profile-card" onclick="selectProfile('${s.id}')"><div class="card-head"><div><h3>${s.name}</h3><small>${s.loc||"-"} · ${s.owner||"-"}</small></div><div class="progress-ring" style="--p:${s.progress}%"><span>${s.progress}%</span></div></div><div class="metric-row"><div class="metric"><b>${s.pending}</b><span>งานค้าง</span></div><div class="metric"><b>${s.docs}</b><span>เอกสาร</span></div><div class="metric"><b>${s.overdue}</b><span>Overdue</span></div><div class="metric"><b>${s.issues}</b><span>Issue</span></div></div><span class="badge ${statusClass(s.status)}">${s.status||"-"}</span></button>`;
  }).join("") || `<div class="empty">ยังไม่มีคลัง</div>`;
  if(STATE.selectedWarehouse) renderProfileDetail(STATE.selectedWarehouse);
}
function selectProfile(id){ STATE.selectedWarehouse=id; localStorage.setItem("last_selected_warehouse",id); openView("profileHub"); renderProfileDetail(id); }
function renderProfileDetail(id){
  const w=whObj(id), s=warehouseStats(w);
  if(!w["Warehouse ID"]){ $("profileDetail").innerHTML=""; return; }
  const tasks=STATE.tasks.filter(t=>t["Warehouse ID"]===id), docs=STATE.documents.filter(d=>d["Warehouse ID"]===id), cals=STATE.calendar.filter(e=>e["Warehouse ID"]===id), issues=STATE.issues.filter(i=>i["Warehouse ID"]===id);
  $("profileDetail").innerHTML = `<div class="panel">
    <div class="panel-head split"><div><h3>${w["Warehouse Name"]}</h3><span>${w["Location / Zone"]||"-"} · Owner: ${w.Owner||"-"} · ${w["Warehouse Status"]||"-"}</span></div><div class="card-actions"><button class="btn primary" onclick="prefillTaskWarehouse('${id}')">+ งาน</button><button class="btn ghost" onclick="prefillDocWarehouse('${id}')">+ เอกสาร</button><button class="btn ghost" onclick="prefillCalendarWarehouse('${id}')">+ แผนงาน</button></div></div>
    <div class="metric-row"><div class="metric"><b>${tasks.length}</b><span>งานทั้งหมด</span></div><div class="metric"><b>${s.pending}</b><span>งานค้าง</span></div><div class="metric"><b>${docs.length}</b><span>เอกสาร</span></div><div class="metric"><b>${issues.filter(i=>i.Status!=="Resolved").length}</b><span>Issue</span></div></div>
    <div class="dash-grid"><div><h4>งานค้าง</h4>${tasks.filter(t=>!isClosed(t)).map(taskFollowHTML).join("")||`<div class="empty">ไม่มีงานค้าง</div>`}</div><div><h4>เอกสารของคลังนี้</h4>${groupDocsHTML(docs)}</div></div>
    <div class="dash-grid"><div><h4>แผนงาน</h4>${cals.slice(0,6).map(e=>`<div class="follow-item"><div><strong>${e["Event Title"]}</strong><small>${e["Due Date"]||e["Start Date"]} · ${e.Assignee||"-"}</small></div><span class="badge blue">${e["Event Type"]||"-"}</span></div>`).join("")||`<div class="empty">ยังไม่มีแผนงาน</div>`}</div><div><h4>Risks / Issues</h4>${issues.map(i=>`<div class="follow-item"><div><strong>${i["Issue Title"]}</strong><small>${i.Impact||""}</small></div><span class="badge ${statusClass(i.Priority)}">${i.Status||"Open"}</span></div>`).join("")||`<div class="empty">ไม่มี Issue</div>`}</div></div>
  </div>`;
}
function groupDocsHTML(docs){
  if(!docs.length) return `<div class="empty">ยังไม่มีเอกสาร</div>`;
  const g=groupBy(docs,"Document Type");
  return Object.entries(g).map(([type,items])=>`<div class="task-chip"><b>${type||"ไม่ระบุ"}</b><br>${items.map(d=>`<small>${d["Document Name"]} · <a href="${d["File Link"]||"#"}" target="_blank">เปิดไฟล์</a></small>`).join("<br>")}</div>`).join("");
}
function renderTasks(){
  const q=safe($("taskSearch")?.value).toLowerCase(), wid=safe($("taskWarehouseFilter")?.value), st=safe($("taskStatusFilter")?.value);
  let rows=STATE.tasks.filter(t=>(!q||JSON.stringify(t).toLowerCase().includes(q))&&(!wid||t["Warehouse ID"]===wid)&&(!st||t.Status===st));
  $("tasksTable").innerHTML = tableHTML(["Task ID","คลัง","ชื่องาน","Assignee","Status","Priority","Due","Progress","Action"], rows.map(t=>[
    t["Task ID"], whName(t["Warehouse ID"]), t["Task Name"], t.Assignee, badge(t.Status), badge(t.Priority), t["Due Date"], `${pct(t["Progress %"])}%`,
    `<button class="btn ghost" onclick='showTask("${t["Task ID"]}")'>ดู</button> <button class="btn primary" onclick='quickStatus("${t["Task ID"]}")'>สถานะ</button> <button class="btn danger" onclick='deleteRecord("Tasks","${t["Task ID"]}","${t["Task Name"]}")'>ลบ</button>`
  ]));
}
function tableHTML(head, rows){ return `<table class="data-table"><thead><tr>${head.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c??""}</td>`).join("")}</tr>`).join("")}</tbody></table>`; }
function badge(v){ return `<span class="badge ${statusClass(v)}">${v||"-"}</span>`; }
function renderDocuments(){ $("documentsList").innerHTML = STATE.documents.map(d=>`<div class="follow-item"><div><strong>${d["Document Name"]}</strong><small>${whName(d["Warehouse ID"])} · ${d["Document Type"]} · ${d["Document Status"]}</small></div><div><a class="btn ghost" href="${d["File Link"]||"#"}" target="_blank">เปิด</a> <button class="btn danger" onclick="deleteRecord('Documents','${d["Document ID"]}','${d["Document Name"]}')">ลบ</button></div></div>`).join("") || `<div class="empty">ยังไม่มีเอกสาร</div>`; }
function renderIssues(){ $("issuesList").innerHTML = STATE.issues.map(i=>`<div class="follow-item"><div><strong>${i["Issue Title"]}</strong><small>${whName(i["Warehouse ID"])} · Owner ${i.Owner||"-"} · Due ${i["Due Date"]||"-"}<br>${i.Impact||""}</small></div><div><span class="badge ${statusClass(i.Priority)}">${i.Status||"Open"}</span> <button class="btn danger" onclick="deleteRecord('Issues','${i["Issue ID"]}','${i["Issue Title"]}')">ลบ</button></div></div>`).join("") || `<div class="empty">ยังไม่มี Issue</div>`; }
function renderCalendar(){
  const d=STATE.calendarDate, y=d.getFullYear(), m=d.getMonth();
  $("calendarTitle").textContent = d.toLocaleString("th-TH",{month:"long",year:"numeric"});
  const first=new Date(y,m,1), start=new Date(first); start.setDate(first.getDate()-first.getDay());
  const events = [...STATE.calendar.map(e=>({...e,_kind:"calendar",_date:safe(e["Due Date"]||e["Start Date"])})), ...STATE.tasks.filter(t=>safe(t["Due Date"])).map(t=>({"Event Title":t["Task Name"],"Warehouse ID":t["Warehouse ID"],"Task ID":t["Task ID"],"Event Type":"Task Due","Due Date":t["Due Date"],Assignee:t.Assignee,_kind:"task",_date:t["Due Date"]}))];
  let html=""; ["อา","จ","อ","พ","พฤ","ศ","ส"].forEach(x=>html+=`<div class="cal-cell muted"><b>${x}</b></div>`);
  for(let i=0;i<42;i++){ const cur=new Date(start); cur.setDate(start.getDate()+i); const iso=cur.toISOString().slice(0,10); const ev=events.filter(e=>safe(e._date).slice(0,10)===iso); html+=`<div class="cal-cell ${cur.getMonth()!==m?"muted":""}" onclick="showDay('${iso}')"><div class="cal-date">${cur.getDate()}</div>${ev.slice(0,4).map(e=>`<div class="cal-event">${e["Event Title"]}</div>`).join("")}${ev.length>4?`<small>+${ev.length-4}</small>`:""}</div>`; }
  $("calendarGrid").innerHTML=html; $("calendarDayDetail").innerHTML=`<div class="empty">กดวันที่เพื่อดูรายละเอียด</div>`;
}
function showDay(iso){
  const ev = STATE.calendar.filter(e=>safe(e["Due Date"]||e["Start Date"]).slice(0,10)===iso);
  const tasks = STATE.tasks.filter(t=>safe(t["Due Date"]).slice(0,10)===iso);
  $("calendarDayDetail").innerHTML = `<h3>${iso}</h3>` + [...ev.map(e=>`<div class="follow-item"><div><strong>${e["Event Title"]}</strong><small>${whName(e["Warehouse ID"])} · ${e["Event Type"]} · ${e.Assignee||"-"}</small></div><span class="badge blue">Plan</span></div>`), ...tasks.map(t=>`<div class="follow-item"><div><strong>${t["Task ID"]} · ${t["Task Name"]}</strong><small>${whName(t["Warehouse ID"])} · ${t.Status}</small></div><button class="btn primary" onclick="quickStatus('${t["Task ID"]}')">แก้สถานะ</button></div>`)].join("") || `<div class="empty">ไม่มีรายการวันนี้</div>`;
}
function moveMonth(n){ STATE.calendarDate.setMonth(STATE.calendarDate.getMonth()+n); renderCalendar(); }
function renderTemplateList(){ $("templateList").innerHTML = tableHTML(["Phase","Task","Priority","Offset","Doc Required"], STATE.templates.map(t=>[t.Phase,t["Task Name"],t.Priority,t["Default Due Offset Days"],t["Document Required"]])); }
function renderReports(){
  const k=kpis(), f=followTasks();
  const lines = [
    `รายงานงานปิดคลังสินค้า SPX`,
    `วันที่: ${new Date().toLocaleString("th-TH")}`,
    ``,
    `สรุปภาพรวม`,
    `- คลังทั้งหมด: ${k.wh}`,
    `- งานทั้งหมด: ${k.total}`,
    `- งานปิดแล้ว: ${k.closed}`,
    `- งานค้าง: ${k.pending}`,
    `- งานเลยกำหนด: ${k.overdue}`,
    `- Issue เปิดอยู่: ${k.issues}`,
    `- ความคืบหน้ารวม: ${k.prog}%`,
    ``,
    `งานที่ต้องตามด่วน`,
    ...(f.length?f.map(t=>`- ${t["Task ID"]} | ${whName(t["Warehouse ID"])} | ${t["Task Name"]} | ${t.Status} | Due ${t["Due Date"]||"-"}`):["- ไม่มี"]),
    ``,
    `คลังที่มีความเสี่ยง`,
    ...STATE.warehouses.map(warehouseStats).filter(s=>s.pending||s.overdue||s.issues).map(s=>`- ${s.name}: ค้าง ${s.pending}, เลยกำหนด ${s.overdue}, Issue ${s.issues}`)
  ];
  $("reportBox").value = lines.join("\n");
}
function renderActivity(){ $("activityTable").innerHTML = tableHTML(["Time","Action","Sheet","Record","Warehouse","User","Details"], STATE.activity.slice().reverse().map(a=>[a.Timestamp,a.Action,a.Sheet,a["Record ID"],whName(a["Warehouse ID"]),a.User,a.Details])); }
function renderTrash(){ $("trashTable").innerHTML = tableHTML(["Time","Sheet","Record","Warehouse","Deleted By","Reason"], STATE.trash.slice().reverse().map(t=>[t.Timestamp,t["Source Sheet"],t["Record ID"],whName(t["Warehouse ID"]),t["Deleted By"],t.Reason])); }
function renderSettings(){
  $("settingSheetId").value=CONFIG.spreadsheetId; $("settingApiUrl").value=CONFIG.apiUrl;
  $("settingsLists").innerHTML = Object.entries(STATE.settings).map(([k,arr])=>`<div class="settings-col"><h4>${k}</h4>${(arr||[]).map(x=>`<span class="badge blue">${x}</span> `).join("")}</div>`).join("");
}
function renderAll(){ renderDashboard(); renderWarehouseStatus(); renderProfileHub(); renderTasks(); renderDocuments(); renderCalendar(); renderIssues(); renderTemplateList(); renderReports(); renderActivity(); renderTrash(); renderSettings(); }
function groupBy(arr,key){ return arr.reduce((a,x)=>{const k=safe(x[key])||"ไม่ระบุ";(a[k] ||= []).push(x); return a;},{}); }
function formData(form){ return Object.fromEntries(new FormData(form).entries()); }
function rememberForm(formId, keys){ const form=$(formId); keys.forEach(k=>{ const el=form?.querySelector(`[name="${k}"]`); const v=localStorage.getItem(`spx_${formId}_${k}`); if(el&&v) el.value=v; if(el) el.addEventListener("change",()=>localStorage.setItem(`spx_${formId}_${k}`,el.value)); }); }
function setupForms(){
  $("warehouseForm").addEventListener("submit",async e=>{ e.preventDefault(); try{ await apiPost("addWarehouse",{record:formData(e.target)}); toast("บันทึกคลังแล้ว"); e.target.reset(); await loadAllData(); }catch(err){ toast(err.message); }});
  $("taskForm").addEventListener("submit",async e=>{ e.preventDefault(); const data=formData(e.target); try{ await apiPost("addTask",{record:data, autoCalendar: !!e.target.autoCalendar.checked}); toast("บันทึกงานแล้ว"); e.target.reset(); await loadAllData(); }catch(err){ toast(err.message); }});
  $("documentForm").addEventListener("submit",async e=>{ e.preventDefault(); try{ await apiPost("addDocument",{record:formData(e.target)}); toast("เพิ่มเอกสารแล้ว"); e.target.reset(); await loadAllData(); }catch(err){ toast(err.message); }});
  $("calendarForm").addEventListener("submit",async e=>{ e.preventDefault(); const data=formData(e.target); try{ await apiPost("addCalendarEvent",{record:data}); toast("เพิ่มแผนงานแล้ว"); e.target.reset(); await loadAllData(); STATE.calendarDate=parseDate(data["Due Date"])||new Date(); renderCalendar(); }catch(err){ toast(err.message); }});
  $("issueForm").addEventListener("submit",async e=>{ e.preventDefault(); try{ await apiPost("addIssue",{record:formData(e.target)}); toast("เพิ่ม Issue แล้ว"); e.target.reset(); await loadAllData(); }catch(err){ toast(err.message); }});
  rememberForm("taskForm",["Warehouse ID","Phase","Assignee","Status","Priority"]);
}
async function createChecklist(){
  const warehouseId=safe($("checklistWarehouse").value), start=safe($("checklistStartDate").value)||todayISO(), assignee=safe($("checklistAssignee").value);
  if(!warehouseId) return toast("เลือกคลังก่อน");
  try{ await apiPost("createChecklistFromTemplate",{warehouseId,startDate:start,assignee}); toast("สร้าง Checklist แล้ว"); await loadAllData(); selectProfile(warehouseId); }catch(err){ toast(err.message); }
}
async function quickStatus(taskId){
  const t=byId(STATE.tasks,"Task ID",taskId); if(!t) return;
  const options=(STATE.settings["Task Status"]||[]).map(s=>`<option ${s===t.Status?"selected":""}>${s}</option>`).join("");
  $("dialogContent").innerHTML=`<h2>แก้สถานะ ${taskId}</h2><p>${t["Task Name"]}</p><label><span>สถานะใหม่</span><select id="dlgStatus">${options}</select></label><label><span>Progress %</span><input id="dlgProgress" type="number" min="0" max="100" value="${pct(t["Progress %"])}"></label><label><span>หมายเหตุ</span><textarea id="dlgNote"></textarea></label><button class="btn primary wide" onclick="submitStatus('${taskId}')">บันทึกสถานะ</button>`;
  $("detailDialog").showModal();
}
async function submitStatus(taskId){ try{ await apiPost("updateStatus",{taskId,status:$("dlgStatus").value,progress:$("dlgProgress").value,notes:$("dlgNote").value,user:"Web User"}); closeDialog(); toast("อัปเดตสถานะแล้ว"); await loadAllData(); }catch(err){ toast(err.message); } }
async function deleteRecord(sheet, id, name){
  if(!confirm(`ยืนยันลบ ${name || id} ?\nระบบจะเก็บ snapshot ไว้ในถังขยะ`)) return;
  try{ await apiPost("deleteRecord",{sheet, id, reason:"Deleted from web", user:"Web User"}); toast("ลบข้อมูลแล้ว"); await loadAllData(); }catch(err){ toast(err.message); }
}
function showTask(id){ const t=byId(STATE.tasks,"Task ID",id); $("dialogContent").innerHTML=`<h2>${id}</h2><pre>${JSON.stringify(t,null,2)}</pre>`; $("detailDialog").showModal(); }
function closeDialog(){ $("detailDialog").close(); }
function filterTasksByWarehouse(id){ openView("tasks"); $("taskWarehouseFilter").value=id; renderTasks(); }
function prefillTaskWarehouse(id){ openView("addTask"); $("taskWarehouseSelect").value=id; }
function prefillDocWarehouse(id){ openView("documents"); $("docWarehouseSelect").value=id; }
function prefillCalendarWarehouse(id){ openView("calendar"); $("calWarehouseSelect").value=id; }
function copyReport(){ navigator.clipboard.writeText($("reportBox").value); toast("Copy รายงานแล้ว"); }
function downloadReport(){ const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([$("reportBox").value],{type:"text/plain"})); a.download=`spx-report-${todayISO()}.txt`; a.click(); }
function saveConnection(){ CONFIG.spreadsheetId=$("settingSheetId").value.trim(); CONFIG.apiUrl=$("settingApiUrl").value.trim(); localStorage.setItem("spx_sheet_id",CONFIG.spreadsheetId); localStorage.setItem("spx_api_url",CONFIG.apiUrl); toast("บันทึกการเชื่อมต่อแล้ว"); loadAllData(true); }
async function testConnection(){ try{ const d=await apiGet("ping"); toast("API ใช้งานได้: "+(d?.status||"OK")); setConnected(true); }catch(e){ toast("ทดสอบไม่ผ่าน: "+e.message); } }
function initClock(){ setInterval(()=>$("clock").textContent=new Date().toLocaleTimeString("th-TH",{hour12:false,timeZone:"Asia/Bangkok"}),1000); }
function initNav(){ document.querySelectorAll(".nav button").forEach(b=>b.addEventListener("click",()=>openView(b.dataset.view))); }
document.addEventListener("DOMContentLoaded",()=>{ initClock(); initNav(); setupForms(); loadAllData(); });
