
const DEFAULT_SHEET_ID = "1gNnjKeqxaE6TtCOOXOqnaG_E0v5dQtUmE_KfLgoo6hI";
const CONFIG = {
  sheetId: localStorage.getItem("spx_sheet_id") || DEFAULT_SHEET_ID,
  apiUrl: localStorage.getItem("spx_api_url") || ""
};

const defaults = {
  taskStatuses:["Backlog","To Do","กำลังดำเนินการ","รอเอกสาร","รอ Vendor","ติดขัด","ปิดแล้ว"],
  priorities:["สูงมาก","สูง","กลาง","ต่ำ"],
  warehouseStatuses:["ยังไม่เริ่ม","กำลังปิดคลัง","รอส่งมอบ","ส่งมอบแล้ว","ปิดโครงการแล้ว"],
  phases:["เฟส 1 · ตรวจสัญญาและแจ้งเลิก","เฟส 2 · วางแผนและตั้งทีม","เฟส 3 · เคลียร์ทรัพย์สินและสต๊อก","เฟส 4 · ยกเลิก Vendor และสาธารณูปโภค","เฟส 5 · คืนสภาพพื้นที่","เฟส 6 · ส่งมอบพื้นที่","เฟส 7 · ปิดการเงินและเงินประกัน"],
  documentTypes:["สัญญาเช่า","ใบส่งมอบพื้นที่","รูปภาพพื้นที่","ใบเสนอราคา","Invoice / PO","อื่น ๆ"],
  documentStatuses:["รอตรวจสอบ","ผ่าน","ต้องแก้ไข"],
  eventTypes:["กำหนดส่งงาน","นัดหมาย","ตรวจพื้นที่","ติดตามเอกสาร","แจ้งเตือน"]
};
const state = {warehouses:[],tasks:[],documents:[],calendar:[],activityLog:[],settings:{...defaults},calendarMonth:new Date().toISOString().slice(0,7),selectedCalendarDate:null,currentCalendarItemKey:null};
const settingsMeta = {
  taskStatuses:{label:"สถานะงาน", col:"A"},
  priorities:{label:"ความสำคัญ", col:"B"},
  warehouseStatuses:{label:"สถานะคลัง", col:"C"},
  phases:{label:"เฟสงาน", col:"D"},
  documentTypes:{label:"ประเภทเอกสาร", col:"E"},
  documentStatuses:{label:"สถานะเอกสาร", col:"F"},
  eventTypes:{label:"ประเภทแผนงาน", col:"G"},
  calendarStatuses:{label:"สถานะเตือน", col:"H"}
};
const appPrefs = () => ({
  defaultUser: localStorage.getItem("spx_user") || "",
  defaultReminderDays: Number(localStorage.getItem("spx_default_reminder_days") || 2),
  lookAheadDays: Number(localStorage.getItem("spx_lookahead_days") || 7),
  autoCalendarFromTask: localStorage.getItem("spx_auto_calendar") === "1"
});
const demo = {
  warehouses:[{warehouseId:"WH-0001",warehouseName:"คลังตัวอย่าง",locationZone:"บางนา / โซน A",owner:"Owner ตัวอย่าง",ownerPhone:"",startDate:"2026-05-22",targetHandoverDate:"2026-06-30",warehouseStatus:"กำลังปิดคลัง",documentFolderLink:"",notes:"Demo"}],
  tasks:[{taskId:"T-0001",createdDate:"2026-05-22",warehouseId:"WH-0001",phase:"เฟส 1 · ตรวจสัญญาและแจ้งเลิก",taskName:"ตรวจสัญญาเช่า",assignee:"Owner ตัวอย่าง",status:"กำลังดำเนินการ",priority:"สูง",dueDate:"2026-05-30",progress:"25",closedDate:"",evidenceLink:"",lastUpdated:"",notes:"Demo"}],
  documents:[],calendar:[],activityLog:[]
};
const $=s=>document.querySelector(s); const $$=s=>Array.from(document.querySelectorAll(s));

document.addEventListener("DOMContentLoaded",()=>{
  initEffects();
  tickClock();
  setInterval(tickClock, 1000);
  bindNav(); bindForms(); initConfig(); loadAll();
});

function initEffects(){
  const field=$("#particleField");
  if(field && !field.dataset.ready){
    field.dataset.ready="1";
    for(let i=0;i<46;i++){
      const p=document.createElement("span");
      p.className="particle";
      p.style.left=Math.random()*100+"vw";
      p.style.setProperty("--dx",(Math.random()*120-60)+"px");
      p.style.animationDuration=(8+Math.random()*14)+"s";
      p.style.animationDelay=(-Math.random()*18)+"s";
      p.style.opacity=(.22+Math.random()*.55).toFixed(2);
      field.appendChild(p);
    }
  }
}
function tickClock(){
  const el=$("#liveClock");
  if(!el)return;
  el.textContent=new Intl.DateTimeFormat("th-TH",{timeZone:"Asia/Bangkok",hour:"2-digit",minute:"2-digit",second:"2-digit"}).format(new Date());
}

function bindNav(){
  $$(".nav").forEach(b=>b.onclick=()=>show(b.dataset.view));
  $$("[data-go]").forEach(b=>b.onclick=()=>show(b.dataset.go));
  $("#refreshBtn").onclick=loadAll;
}
function show(v){
  $$(".nav").forEach(b=>b.classList.toggle("active",b.dataset.view===v));
  $$(".view").forEach(x=>x.classList.remove("active"));
  $("#"+v)?.classList.add("active");
  $("#title").textContent = document.querySelector(`[data-view="${v}"]`)?.textContent || "Dashboard";
}
function initConfig(){
  if($("#sheetId")) $("#sheetId").value=CONFIG.sheetId;
  if($("#apiUrl")) $("#apiUrl").value=CONFIG.apiUrl;
  const prefs=appPrefs();
  if($("#defaultUser")) $("#defaultUser").value=prefs.defaultUser;
  if($("#defaultReminderDays")) $("#defaultReminderDays").value=prefs.defaultReminderDays;
  if($("#lookAheadDays")) $("#lookAheadDays").value=prefs.lookAheadDays;
  if($("#autoCalendarFromTask")) $("#autoCalendarFromTask").checked=prefs.autoCalendarFromTask;
  $("#saveConfig").onclick=()=>{CONFIG.sheetId=$("#sheetId").value.trim();CONFIG.apiUrl=$("#apiUrl").value.trim();localStorage.setItem("spx_sheet_id",CONFIG.sheetId);localStorage.setItem("spx_api_url",CONFIG.apiUrl);toast("บันทึกการเชื่อมต่อแล้ว");loadAll();};
  $("#testApi").onclick=async()=>{const r=await apiGet("ping");toast(r?.success?"API ใช้งานได้":"ยังเชื่อมต่อไม่ได้");};
  if($("#savePreferences")) $("#savePreferences").onclick=()=>{
    localStorage.setItem("spx_user",$("#defaultUser").value.trim());
    localStorage.setItem("spx_default_reminder_days",$("#defaultReminderDays").value || 2);
    localStorage.setItem("spx_lookahead_days",$("#lookAheadDays").value || 7);
    localStorage.setItem("spx_auto_calendar",$("#autoCalendarFromTask").checked ? "1" : "0");
    toast("บันทึกค่าการใช้งานแล้ว");
    dashboard(); calendar();
  };
}
async function apiGet(action){
  if(!CONFIG.apiUrl)return null;
  const url=new URL(CONFIG.apiUrl); url.searchParams.set("action",action); url.searchParams.set("spreadsheetId",CONFIG.sheetId);
  return fetch(url).then(r=>r.json());
}
async function apiPost(action,payload){
  if(!CONFIG.apiUrl){toast("ยังไม่ได้ใส่ Apps Script URL");return {success:false};}
  return fetch(CONFIG.apiUrl,{method:"POST",body:JSON.stringify({action,spreadsheetId:CONFIG.sheetId,...payload})}).then(r=>r.json());
}
async function loadAll(){
  setConn(false,"กำลังโหลด...");
  try{
    const r=await apiGet("getAllData");
    if(r?.success){Object.assign(state,r.data);state.settings={...defaults,...(r.data.settings||{})};setConn(true,"เชื่อมต่อแล้ว");}
    else{Object.assign(state,demo);state.settings={...defaults};setConn(false,"Demo Mode");}
  }catch(e){console.error(e);Object.assign(state,demo);state.settings={...defaults};setConn(false,"Demo Mode");}
  renderAll();
}
function setConn(ok,text){$("#connDot").classList.toggle("ok",ok);$("#connText").textContent=text;}
function renderAll(){dropdowns();dashboard();warehouseStatus();warehouses();tasks();documents();calendar();logs();renderSettingsLists();}
function dropdowns(){
  fillWh("#warehouseSelect",true); fillWh("#taskWarehouse"); fillWh("#docWarehouse"); fillWh("#calWarehouse"); fillWh("#taskFilterWh",true,"ทุกคลัง"); fillWh("#calendarWhFilter",true,"ทุกคลัง");
  fill("#taskFilterStatus",["",...state.settings.taskStatuses],"ทุกสถานะ"); fill("#taskFilterPriority",["",...state.settings.priorities],"ทุกความสำคัญ");
  fill("#calendarTypeFilter",["",...state.settings.eventTypes,"Task Due"],"ทุกประเภท");
  fill("#warehouseStatusFilter",["",...state.settings.warehouseStatuses],"ทุกสถานะคลัง");
  $$("[data-list]").forEach(el=>{fillEl(el,state.settings[el.dataset.list]||[]);});
  const m=$("#calendarMonth"); if(m && !m.value) m.value=state.calendarMonth;
}
function fillWh(sel,blank=false,blankText="เลือกคลัง"){const e=$(sel); if(!e)return; e.innerHTML=""; if(blank)e.add(new Option(blankText,"")); state.warehouses.forEach(w=>e.add(new Option(`${w.warehouseId} · ${w.warehouseName}`,w.warehouseId)));}
function fill(sel,arr,blankText){const e=$(sel); if(!e)return; e.innerHTML=""; arr.forEach((v,i)=>e.add(new Option(i===0&&v===""?blankText:v,v)));}
function fillEl(e,arr){const old=e.value;e.innerHTML="";arr.filter(Boolean).forEach(v=>e.add(new Option(v,v)));if(old)e.value=old;}
function dashboard(){
  const total=state.tasks.length, closed=state.tasks.filter(t=>t.status==="ปิดแล้ว").length, overdue=state.tasks.filter(overdueTask).length, docs=state.documents.length;
  const running=state.tasks.filter(t=>["กำลังดำเนินการ","รอเอกสาร","รอ Vendor"].includes(t.status)).length;
  const avg=total?Math.round(state.tasks.reduce((s,t)=>s+Number(t.progress||0),0)/total):0;
  const k=[
    {label:"คลังทั้งหมด",value:state.warehouses.length,icon:"🏢",hint:"Warehouse profiles"},
    {label:"งานทั้งหมด",value:total,icon:"📦",hint:"Total tasks"},
    {label:"กำลังเดิน",value:running,icon:"🚚",hint:"In motion"},
    {label:"ปิดแล้ว",value:closed,icon:"✅",hint:"Completed"},
    {label:"เลยกำหนด",value:overdue,icon:"🔥",hint:"Need action"},
    {label:"ความคืบหน้า",value:avg+"%",icon:"📈",hint:"Average progress"}
  ];
  $("#kpis").innerHTML=k.map(x=>`<div class="kpi"><i>${x.icon}</i><span>${x.label}</span><strong>${x.value}</strong><em>${x.hint}</em></div>`).join("");
  const heroProgress=$("#heroProgress"); if(heroProgress) heroProgress.textContent=avg+"%";
  const heroSummary=$("#heroSummary"); if(heroSummary) heroSummary.textContent=`${state.warehouses.length} คลัง · ${total} งาน · ${overdue} งานต้องเร่ง`;
  const c=countBy(state.tasks,"status");
  $("#statusBars").innerHTML=Object.entries(c).map(([s,n])=>`<div class="barrow"><span>${s}</span><div class="track"><div class="fill" style="width:${total?Math.round(n/total*100):0}%"></div></div><b>${n}</b></div>`).join("")||empty("ยังไม่มีงาน");
  const follow=state.tasks.filter(t=>overdueTask(t)||soon(t)||["ติดขัด","รอเอกสาร","รอ Vendor"].includes(t.status));
  $("#todayTasks").innerHTML=follow.map(cardTask).join("")||empty("ยังไม่มีงานที่ต้องตาม");
}

function warehouseStatus(){
  const board = $("#warehouseStatusBoard");
  if(!board) return;
  const q=($("#warehouseStatusSearch")?.value||"").toLowerCase().trim();
  const statusFilter=$("#warehouseStatusFilter")?.value||"";
  const workFilter=$("#warehouseWorkFilter")?.value||"";
  let rows=state.warehouses.slice();
  if(q){
    rows=rows.filter(w=>[w.warehouseId,w.warehouseName,w.locationZone,w.owner,w.ownerPhone,w.warehouseStatus].join(" ").toLowerCase().includes(q));
  }
  if(statusFilter) rows=rows.filter(w=>w.warehouseStatus===statusFilter);
  if(workFilter){
    rows=rows.filter(w=>{
      const m=warehouseMetrics(w.warehouseId);
      if(workFilter==="pending") return m.pending>0;
      if(workFilter==="overdue") return m.overdue>0;
      if(workFilter==="blocked") return m.blocked>0;
      if(workFilter==="done") return m.total>0 && m.pending===0;
      return true;
    });
  }
  board.innerHTML = rows.length ? rows.map(warehouseStatusCard).join("") : empty("ไม่พบคลังตามเงื่อนไข");
}
function warehouseMetrics(warehouseId){
  const ts=state.tasks.filter(t=>t.warehouseId===warehouseId);
  const total=ts.length;
  const closed=ts.filter(t=>t.status==="ปิดแล้ว").length;
  const overdue=ts.filter(overdueTask).length;
  const blocked=ts.filter(t=>["ติดขัด","รอเอกสาร","รอ Vendor"].includes(t.status)).length;
  const pending=ts.filter(t=>t.status!=="ปิดแล้ว").length;
  const progress=total?Math.round(ts.reduce((sum,t)=>sum+Number(t.progress||0),0)/total):0;
  const nextDue=ts.filter(t=>t.status!=="ปิดแล้ว"&&t.dueDate).sort((a,b)=>String(a.dueDate).localeCompare(String(b.dueDate)))[0]?.dueDate||"-";
  return {tasks:ts,total,closed,overdue,blocked,pending,progress,nextDue};
}
function warehouseStatusCard(w){
  const m=warehouseMetrics(w.warehouseId);
  const pendingTasks=m.tasks.filter(t=>t.status!=="ปิดแล้ว");
  const critical=pendingTasks.filter(t=>overdueTask(t)||["ติดขัด","รอเอกสาร","รอ Vendor"].includes(t.status));
  const shown=(critical.length?critical:pendingTasks).slice(0,5);
  const statusClass=m.overdue?"danger":m.blocked?"warn":m.pending?"active":"done";
  return `<article class="warehouse-status-card ${statusClass}">
    <div class="ws-top">
      <div>
        <span class="ws-code">${esc(w.warehouseId||"-")}</span>
        <h3>${esc(w.warehouseName||"ไม่ระบุชื่อคลัง")}</h3>
        <small>${esc(w.locationZone||"-")} · Owner: ${esc(w.owner||"-")}</small>
      </div>
      <div class="ws-ring" style="--p:${m.progress}"><b>${m.progress}%</b><small>progress</small></div>
    </div>
    <div class="ws-metrics">
      <div><b>${m.total}</b><span>งานทั้งหมด</span></div>
      <div><b>${m.pending}</b><span>งานค้าง</span></div>
      <div><b>${m.overdue}</b><span>เลยกำหนด</span></div>
      <div><b>${m.nextDue}</b><span>Due ถัดไป</span></div>
    </div>
    <div class="ws-status-line"><span class="badge ${badgeClass(w.warehouseStatus)}">${esc(w.warehouseStatus||"ไม่ระบุสถานะคลัง")}</span><span>${m.closed}/${m.total} งานปิดแล้ว</span></div>
    <div class="pending-list">
      <b>งานที่ยังต้องตาม</b>
      ${shown.length?shown.map(t=>`<div class="pending-task ${overdueTask(t)?'late':''}"><div><strong>${esc(t.taskId)} · ${esc(t.taskName)}</strong><small>${esc(t.status||'-')} · ${esc(t.assignee||'-')} · Due ${esc(t.dueDate||'-')} · ${Number(t.progress||0)}%</small></div><button class="mini" onclick="openStatus('${t.taskId}')">แก้</button></div>`).join(""):`<p class="all-clear">ไม่มีงานค้าง 🎉</p>`}
      ${pendingTasks.length>shown.length?`<small class="more-pending">ยังมีงานค้างอีก ${pendingTasks.length-shown.length} รายการ</small>`:""}
    </div>
    <div class="ws-actions">
      <button class="mini" onclick="openWarehouseProfile('${w.warehouseId}')">ดูโปรไฟล์</button>
      <button class="mini" onclick="filterTasksByWarehouse('${w.warehouseId}')">ดูงานทั้งหมด</button>
      <button class="mini" onclick="prefillTaskWarehouse('${w.warehouseId}')">+ เพิ่มงาน</button>
      <button class="mini danger" onclick="confirmDelete('warehouse','${w.warehouseId}','คลัง ${esc(w.warehouseName||w.warehouseId)}')">ลบ</button>
    </div>
  </article>`;
}
function openWarehouseProfile(id){
  if($("#warehouseSelect")) $("#warehouseSelect").value=id;
  localStorage.setItem("spx_selected_warehouse",id);
  show("warehouses");
  warehouses();
}
function filterTasksByWarehouse(id){
  show("tasks");
  if($("#taskFilterWh")) $("#taskFilterWh").value=id;
  tasks();
}
function prefillTaskWarehouse(id){
  show("addTask");
  const el=$("#taskWarehouse");
  if(el) el.value=id;
  const taskName=$("#taskForm [name='taskName']");
  if(taskName) taskName.focus();
}
function warehouses(){
  const saved=localStorage.getItem("spx_selected_warehouse")||"";
  const dropdownVal=$("#warehouseSelect")?.value||"";
  const id=dropdownVal || saved || state.warehouses[0]?.warehouseId || "";
  if($("#warehouseSelect")) $("#warehouseSelect").value=id;
  renderWarehouseCards(id);
  const w=state.warehouses.find(x=>x.warehouseId===id);
  const delBtn=$("#deleteWarehouseBtn");
  if(delBtn){
    delBtn.disabled=!w;
    delBtn.onclick=()=> w && confirmDelete("warehouse", w.warehouseId, `คลัง ${w.warehouseName || w.warehouseId}`);
  }
  if(!w){$("#warehouseProfile").innerHTML=empty("ยังไม่มีคลัง");$("#warehouseTasks").innerHTML="";return;}
  localStorage.setItem("spx_selected_warehouse",id);
  const ts=state.tasks.filter(t=>t.warehouseId===id);
  const f=[["Warehouse ID",w.warehouseId],["ชื่อคลัง",w.warehouseName],["พื้นที่",w.locationZone],["Owner",w.owner],["เบอร์",w.ownerPhone],["สถานะ",w.warehouseStatus],["เริ่ม",w.startDate],["เป้าส่งมอบ",w.targetHandoverDate],["งานทั้งหมด",ts.length],["ปิดแล้ว",ts.filter(t=>t.status==="ปิดแล้ว").length],["หมายเหตุ",w.notes]];
  $("#warehouseProfile").innerHTML=f.map(x=>`<div class="field"><span>${x[0]}</span><b>${x[1]||"-"}</b></div>`).join("");
  $("#warehouseTasks").innerHTML=taskTable(ts);
}
function renderWarehouseCards(activeId){
  const box=$("#warehouseCards"); if(!box)return;
  if(!state.warehouses.length){box.innerHTML=empty("ยังไม่มีคลัง");return;}
  box.innerHTML=state.warehouses.map(w=>{
    const ts=state.tasks.filter(t=>t.warehouseId===w.warehouseId);
    const closed=ts.filter(t=>t.status==="ปิดแล้ว").length;
    const late=ts.filter(overdueTask).length;
    const progress=ts.length?Math.round(ts.reduce((sum,t)=>sum+Number(t.progress||0),0)/ts.length):0;
    return `<button type="button" class="warehouse-card ${w.warehouseId===activeId?'active':''}" onclick="selectWarehouse('${w.warehouseId}')"><b>${esc(w.warehouseName||w.warehouseId)}</b><span>${esc(w.locationZone||'-')} · ${esc(w.owner||'-')}</span><div class="stats"><i>${ts.length} งาน</i><i class="done">${closed} ปิด</i><i class="bad">${late} เลย</i><i>${progress}%</i></div></button>`;
  }).join("");
}
function selectWarehouse(id){
  if($("#warehouseSelect")) $("#warehouseSelect").value=id;
  localStorage.setItem("spx_selected_warehouse",id);
  warehouses();
}
function tasks(){
  const q=($("#taskSearch").value||"").toLowerCase(), wh=$("#taskFilterWh").value, st=$("#taskFilterStatus").value, pr=$("#taskFilterPriority").value;
  const data=state.tasks.filter(t=>(!q||[t.taskId,t.taskName,t.assignee,t.warehouseId].join(" ").toLowerCase().includes(q))&&(!wh||t.warehouseId===wh)&&(!st||t.status===st)&&(!pr||t.priority===pr));
  $("#taskTable").innerHTML=taskTable(data);
}
function taskTable(data){
 if(!data.length)return empty("ไม่พบงาน");
 return `<table><thead><tr><th>ID</th><th>งาน</th><th>คลัง</th><th>Owner</th><th>สถานะ</th><th>Due</th><th>%</th><th></th></tr></thead><tbody>`+data.map(t=>`<tr><td><b>${t.taskId}</b></td><td>${esc(t.taskName)}<br><small>${esc(t.phase||"")}</small></td><td>${whName(t.warehouseId)}</td><td>${esc(t.assignee||"-")}</td><td><span class="badge ${badgeClass(t.status)}">${t.status||"-"}</span></td><td>${t.dueDate||"-"}</td><td>${t.progress||0}%</td><td><div class="row-actions"><button class="mini" onclick="openStatus('${t.taskId}')">แก้สถานะ</button><button class="mini danger" onclick="confirmDelete('task','${t.taskId}','งาน ${esc(t.taskName)}')">ลบ</button></div></td></tr>`).join("")+`</tbody></table>`;
}
function documents(){ $("#docTable").innerHTML = state.documents.length ? `<table><thead><tr><th>ID</th><th>เอกสาร</th><th>คลัง</th><th>สถานะ</th><th>ลิงก์</th><th></th></tr></thead><tbody>`+state.documents.map(d=>`<tr><td>${d.documentId}</td><td>${esc(d.documentName)}</td><td>${whName(d.warehouseId)}</td><td>${d.documentStatus||"-"}</td><td>${d.fileLink?`<a href="${d.fileLink}" target="_blank">เปิด</a>`:"-"}</td><td><button class="mini danger" onclick="confirmDelete('document','${d.documentId}','เอกสาร ${esc(d.documentName)}')">ลบ</button></td></tr>`).join("")+`</tbody></table>` : empty("ยังไม่มีเอกสาร");}
function calendar(){
  const monthInput=$("#calendarMonth");
  if(monthInput && monthInput.value) state.calendarMonth=monthInput.value;
  if(monthInput) monthInput.value=state.calendarMonth;
  const grid=$("#calendarMonthGrid"); if(!grid)return;
  const [y,m]=state.calendarMonth.split("-").map(Number);
  const first=new Date(y,m-1,1), last=new Date(y,m,0);
  const startDay=(first.getDay()+6)%7; // Monday first
  const days=last.getDate();
  const wh=$("#calendarWhFilter")?.value||"";
  const type=$("#calendarTypeFilter")?.value||"";
  const urgency=$("#calendarUrgencyFilter")?.value||"";
  let items=getCalendarItems().filter(x=>inMonth(x.dueDate,state.calendarMonth));
  if(wh)items=items.filter(x=>x.warehouseId===wh);
  if(type)items=items.filter(x=>x.type===type);
  if(urgency)items=items.filter(x=>calendarUrgency(x)===urgency || (urgency==="week"&&withinDays(x.dueDate,7)));
  const byDay=countCalendarByDay(items);
  const dow=["จ","อ","พ","พฤ","ศ","ส","อา"];
  let html=dow.map(d=>`<div class="dow">${d}</div>`).join("");
  for(let i=0;i<startDay;i++) html+=`<div class="day muted-day"></div>`;
  for(let d=1;d<=days;d++){
    const date=`${state.calendarMonth}-${String(d).padStart(2,"0")}`;
    const list=byDay[date]||[];
    const cls=["day",date===todayISO()?"today":"",list.some(x=>calendarUrgency(x)==="overdue")?"danger":""].join(" ");
    html+=`<button class="${cls}" type="button" onclick="selectCalendarDate('${date}')"><span class="day-num">${d}</span>${list.slice(0,4).map(x=>`<em class="event-dot ${x.source==='task'?'task-dot':''}" onclick="event.stopPropagation();openCalendarItem('${x.key}')">${esc(shortTitle(x.title))}</em>`).join("")}${list.length>4?`<b class="more">+${list.length-4}</b>`:""}</button>`;
  }
  grid.innerHTML=html;
  renderSelectedDay(state.selectedCalendarDate||todayISO());
}
function getCalendarItems(){
  // Calendar fix: Apps Script may return dates as "YYYY-MM-DD HH:mm:ss".
  // Normalize every date to "YYYY-MM-DD" so month grid keys match correctly.
  const calendarItems=state.calendar.map(e=>{
    const startDate=normalizeDate(e.startDate);
    const dueDate=normalizeDate(e.dueDate) || startDate;
    return {source:"calendar",key:"cal:"+e.eventId,id:e.eventId,taskId:e.taskId,warehouseId:e.warehouseId,title:e.eventTitle,type:e.eventType||"กำหนดส่งงาน",startDate,dueDate,assignee:e.assignee,reminderDays:e.reminderDays,calendarStatus:e.calendarStatus,notes:e.notes};
  }).filter(e=>e.dueDate);
  const taskItems=state.tasks.map(t=>{
    const startDate=normalizeDate(t.createdDate);
    const dueDate=normalizeDate(t.dueDate);
    return {source:"task",key:"task:"+t.taskId,id:t.taskId,taskId:t.taskId,warehouseId:t.warehouseId,title:t.taskName,type:"Task Due",startDate,dueDate,assignee:t.assignee,reminderDays:"",calendarStatus:t.status,priority:t.priority,notes:t.notes,progress:t.progress,status:t.status};
  }).filter(t=>t.dueDate);
  return [...calendarItems,...taskItems];
}
function countCalendarByDay(items){return items.reduce((o,x)=>{const d=normalizeDate(x.dueDate||x.startDate);if(!d)return o;(o[d]=o[d]||[]).push(x);return o;},{});}
function normalizeDate(value){
  if(!value)return "";
  if(value instanceof Date && !isNaN(value)) return value.toISOString().slice(0,10);
  const raw=String(value).trim();
  if(!raw)return "";
  const iso=raw.match(/\d{4}-\d{2}-\d{2}/);
  if(iso)return iso[0];
  const dmy=raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if(dmy){
    const [,dd,mm,yyyy]=dmy;
    return `${yyyy}-${String(mm).padStart(2,"0")}-${String(dd).padStart(2,"0")}`;
  }
  const parsed=new Date(raw);
  return isNaN(parsed)?"":parsed.toISOString().slice(0,10);
}
function selectCalendarDate(date){state.selectedCalendarDate=date; renderSelectedDay(date);}
function renderSelectedDay(date){
  const title=$("#selectedDayTitle"), box=$("#selectedDayList"); if(!box)return;
  const selected=normalizeDate(date);
  title.textContent=`รายการวันที่ ${selected||"-"}`;
  const wh=$("#calendarWhFilter")?.value||"";
  const type=$("#calendarTypeFilter")?.value||"";
  const urgency=$("#calendarUrgencyFilter")?.value||"";
  let list=getCalendarItems().filter(x=>normalizeDate(x.dueDate)===selected && (!wh||x.warehouseId===wh));
  if(type)list=list.filter(x=>x.type===type);
  if(urgency)list=list.filter(x=>calendarUrgency(x)===urgency || (urgency==="week"&&withinDays(x.dueDate,7)));
  box.innerHTML=list.map(x=>calendarItemCard(x)).join("")||empty("ไม่มีงานหรือแผนงานในวันนี้");
}
function calendarItemCard(x){
  const urgency=calendarUrgency(x);
  return `<div class="calendar-item ${urgency}" onclick="openCalendarItem('${x.key}')"><b>${esc(x.title)}</b><span>${esc(x.type)} · ${whName(x.warehouseId)} · ${esc(x.assignee||"-")}</span><small>Due ${x.dueDate||"-"}${x.source==='task'?` · ${esc(x.status||"")} · ${x.progress||0}%`:""}</small></div>`;
}
function openCalendarItem(key){
  const item=getCalendarItems().find(x=>x.key===key); if(!item)return;
  state.currentCalendarItemKey=key;
  const task=item.taskId?state.tasks.find(t=>t.taskId===item.taskId):null;
  $("#calendarDetailTitle").textContent=item.source==="task"?"รายละเอียดงานจากปฏิทิน":"รายละเอียดแผนงาน";
  $("#calendarDetailBody").innerHTML=`<div class="detail-grid"><div><span>หัวข้อ</span><b>${esc(item.title)}</b></div><div><span>คลัง</span><b>${whName(item.warehouseId)}</b></div><div><span>ประเภท</span><b>${esc(item.type)}</b></div><div><span>วันครบกำหนด</span><b>${item.dueDate||"-"}</b></div><div><span>ผู้รับผิดชอบ</span><b>${esc(item.assignee||"-")}</b></div><div><span>สถานะ</span><b>${esc(item.calendarStatus||item.status||"-")}</b></div>${task?`<div><span>Task ID</span><b>${task.taskId}</b></div><div><span>Progress</span><b>${task.progress||0}%</b></div>`:""}<div class="wide"><span>หมายเหตุ</span><p>${esc(item.notes||task?.notes||"-")}</p></div></div>`;
  const btn=$("#calendarDetailTaskBtn");
  btn.style.display=task?"inline-flex":"none";
  btn.onclick=()=>{ $("#calendarDetailDialog").close(); openStatus(task.taskId); };
  const delBtn=$("#calendarDetailDeleteBtn");
  if(delBtn){
    delBtn.style.display=item.source==="calendar"?"inline-flex":"none";
    delBtn.onclick=()=>{ $("#calendarDetailDialog").close(); confirmDelete("calendar", item.id, `แผนงาน ${item.title}`); };
  }
  $("#calendarDetailDialog").showModal();
}
function inMonth(date,month){const d=normalizeDate(date);return d && d.slice(0,7)===month;}
function withinDays(date,days){const d=normalizeDate(date);if(!d)return false;const diff=(new Date(d+"T23:59:59")-new Date())/86400000;return diff>=0&&diff<=days;}
function calendarUrgency(x){const d=normalizeDate(x.dueDate||x.startDate);if(!d)return "";if(x.source==="task"&&x.status==="ปิดแล้ว")return "done";const diff=(new Date(d+"T23:59:59")-new Date())/86400000;if(diff<0)return "overdue";if(diff<=0.99)return "today";if(diff<=3)return "soon";return "normal";}
function todayISO(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Bangkok"}).format(new Date());}
function shortTitle(t){t=String(t||"");return t.length>18?t.slice(0,18)+"…":t;}

function logs(){ $("#logTable").innerHTML=state.activityLog.length?`<table><thead><tr><th>เวลา</th><th>Action</th><th>Record</th><th>คลัง</th><th>User</th><th>รายละเอียด</th></tr></thead><tbody>`+state.activityLog.slice().reverse().map(l=>`<tr><td>${l.timestamp||""}</td><td>${l.action||""}</td><td>${l.recordId||""}</td><td>${l.warehouseId||""}</td><td>${l.user||""}</td><td>${esc(l.details||"")}</td></tr>`).join("")+`</tbody></table>`:empty("ยังไม่มี Log");}
function renderSettingsLists(){
  const box=$("#settingsLists"); if(!box)return;
  box.innerHTML=Object.entries(settingsMeta).map(([key,meta])=>{
    const arr=state.settings[key]||[];
    return `<div class="settings-box"><div class="settings-head"><b>${meta.label}</b><small>${key}</small></div><div class="chips">${arr.filter(Boolean).map(v=>`<span>${esc(v)}</span>`).join("")||"<small>ยังไม่มีตัวเลือก</small>"}</div><div class="add-setting"><input id="add_${key}" placeholder="เพิ่ม${meta.label}"><button class="mini" onclick="addSettingOption('${key}')">เพิ่ม</button></div></div>`;
  }).join("");
}
async function addSettingOption(key){
  const input=$("#add_"+key); const value=(input?.value||"").trim(); if(!value)return toast("กรุณาใส่ค่าที่ต้องการเพิ่ม");
  const r=await apiPost("addSettingOption",{settingKey:key,value});
  if(r.success){toast("เพิ่มตัวเลือกแล้ว");input.value="";await loadAll();}else toast(r.message||"เพิ่มตัวเลือกไม่สำเร็จ");
}
function bindForms(){
  $("#warehouseSelect").onchange=warehouses; ["taskSearch","taskFilterWh","taskFilterStatus","taskFilterPriority"].forEach(id=>$("#"+id).oninput=tasks);
  ["warehouseStatusSearch","warehouseStatusFilter","warehouseWorkFilter"].forEach(id=>{const el=$("#"+id); if(el){el.oninput=warehouseStatus; el.onchange=warehouseStatus;}});
  ["calendarMonth","calendarWhFilter","calendarTypeFilter","calendarUrgencyFilter"].forEach(id=>{const el=$("#"+id); if(el)el.onchange=calendar;});
  if($("#calPrev")) $("#calPrev").onclick=()=>shiftCalendarMonth(-1);
  if($("#calNext")) $("#calNext").onclick=()=>shiftCalendarMonth(1);
  $("#warehouseForm").onsubmit=e=>submit(e,"addWarehouse","เพิ่มคลังแล้ว");
  $("#taskForm").onsubmit=e=>submit(e,"addTask","เพิ่มงานแล้ว",true);
  $("#docForm").onsubmit=e=>submit(e,"addDocument","เพิ่มเอกสารแล้ว");
  $("#calForm").onsubmit=e=>submit(e,"addCalendarEvent","เพิ่มแผนงานแล้ว");
  $("#saveStatus").onclick=saveStatus; loadMemory(); $("#taskForm").onchange=saveMemory; $("#taskForm").oninput=saveMemory;
}
function shiftCalendarMonth(delta){const [y,m]=state.calendarMonth.split("-").map(Number);const d=new Date(y,m-1+delta,1);state.calendarMonth=d.toISOString().slice(0,7);if($("#calendarMonth"))$("#calendarMonth").value=state.calendarMonth;calendar();}
async function submit(e,action,msg,remember=false){
  e.preventDefault();
  const payload=obj(e.target);
  const focusCalendarDate=action==="addCalendarEvent" ? normalizeDate(payload.dueDate||payload.startDate) : "";
  const r=await apiPost(action,payload);
  if(r.success){
    toast(msg);
    e.target.reset();
    if(remember)loadMemory();
    if(focusCalendarDate){
      state.calendarMonth=focusCalendarDate.slice(0,7);
      state.selectedCalendarDate=focusCalendarDate;
      if($("#calendarMonth"))$("#calendarMonth").value=state.calendarMonth;
    }
    await loadAll();
    if(action==="addCalendarEvent"){
      show("calendar");
      calendar();
    }
  }else toast(r.message||"บันทึกไม่สำเร็จ");
}
function openStatus(id){const t=state.tasks.find(x=>x.taskId===id); if(!t)return; const f=$("#statusForm"); f.taskId.value=id; f.status.value=t.status; f.progress.value=t.progress||0; f.user.value=localStorage.getItem("spx_user")||""; f.notes.value=""; $("#statusInfo").innerHTML=`<b>${t.taskId}</b> · ${esc(t.taskName)}<br><small>สถานะเดิม: ${t.status}</small>`; $("#statusDialog").showModal();}
async function saveStatus(e){e.preventDefault(); const p=obj($("#statusForm")); localStorage.setItem("spx_user",p.user||""); const r=await apiPost("updateStatus",p); if(r.success){toast("อัปเดตสถานะแล้ว");$("#statusDialog").close();await loadAll();}else toast(r.message||"อัปเดตไม่สำเร็จ");}
function obj(form){return Object.fromEntries(new FormData(form).entries());}
function saveMemory(){const o=obj($("#taskForm")); localStorage.setItem("spx_task_memory",JSON.stringify({warehouseId:o.warehouseId,phase:o.phase,assignee:o.assignee,status:o.status,priority:o.priority}));}
function loadMemory(){try{const m=JSON.parse(localStorage.getItem("spx_task_memory")||"{}");Object.entries(m).forEach(([k,v])=>{const el=$(`#taskForm [name="${k}"]`);if(el&&v)el.value=v;}); const prefs=appPrefs(); const calRem=$(`#calForm [name="reminderDays"]`); if(calRem)calRem.value=prefs.defaultReminderDays; const userInput=$(`#calForm [name="assignee"]`); if(userInput&&!userInput.value)userInput.value=prefs.defaultUser; const addCal=$(`#taskForm [name="addToCalendar"]`); if(addCal)addCal.checked=prefs.autoCalendarFromTask;}catch{}}
async function confirmDelete(recordType,id,label,cascade=false){
  if(!id)return;
  const typeText={warehouse:"คลัง",task:"งาน",document:"เอกสาร",calendar:"แผนงาน"}[recordType]||"ข้อมูล";
  const extra=recordType==="warehouse"&&!cascade?"\n\nถ้าคลังนี้มีงาน/เอกสาร/แผนงานผูกอยู่ ระบบจะถามยืนยันอีกครั้งก่อนลบแบบพ่วงข้อมูลที่เกี่ยวข้อง":"";
  if(!confirm(`ยืนยันลบ${typeText}: ${label || id}?${extra}`))return;
  const user=localStorage.getItem("spx_user")||"Web User";
  const r=await apiPost("deleteRecord",{recordType,id,user,cascade});
  if(r?.needsCascade){
    const ok=confirm(`${r.message}\n\nต้องการลบคลังพร้อมงาน เอกสาร และแผนงานที่เกี่ยวข้องทั้งหมดหรือไม่?`);
    if(ok)return confirmDelete(recordType,id,label,true);
    return;
  }
  if(r?.success){toast("ลบข้อมูลแล้ว");await loadAll();}
  else toast(r?.message||"ลบไม่สำเร็จ");
}

function overdueTask(t){return t.dueDate&&t.status!=="ปิดแล้ว"&&new Date(t.dueDate+"T23:59:59")<new Date();}
function soon(t){if(!t.dueDate||t.status==="ปิดแล้ว")return false; const d=(new Date(t.dueDate)-new Date())/86400000; return d>=0&&d<=appPrefs().lookAheadDays;}
function countBy(a,k){return a.reduce((o,x)=>(o[x[k]||"ไม่ระบุ"]=(o[x[k]||"ไม่ระบุ"]||0)+1,o),{});}
function whName(id){return state.warehouses.find(w=>w.warehouseId===id)?.warehouseName||id||"-";}
function cardTask(t){return `<div class="item"><b>${t.taskId} · ${esc(t.taskName)}</b><br><small>${whName(t.warehouseId)} · ${t.status} · Due ${t.dueDate||"-"}</small></div>`;}
function empty(t){return `<div class="item"><small>${t}</small></div>`;}
function badgeClass(s){if(s==="ปิดแล้ว")return"done";if(s==="ติดขัด")return"bad";if(["กำลังดำเนินการ","รอเอกสาร","รอ Vendor"].includes(s))return"warn";return"";}
function esc(s){return String(s||"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]));}
function toast(m){const t=$("#toast");t.textContent=m;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2500);}
