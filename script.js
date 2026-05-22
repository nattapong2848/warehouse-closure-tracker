const DEFAULT_SHEET_ID='1diGx-RqNg1Kfb8u8YBfBNvem3lA-duLUT8iHoX9DDxQ';
const CONFIG={sheetId:localStorage.getItem('simple_sheet_id')||DEFAULT_SHEET_ID, apiUrl:localStorage.getItem('simple_api_url')||''};
let state={Warehouses:[],Tasks:[],Documents:[],Calendar:[],Settings:[],Activity_Log:[],settingsMap:{}};
const $=(s,r=document)=>r.querySelector(s); const $$=(s,r=document)=>[...r.querySelectorAll(s)];

document.addEventListener('DOMContentLoaded',()=>{bind(); loadData();});

function bind(){
  $$('.nav').forEach(b=>b.onclick=()=>show(b.dataset.view));
  $('#refreshBtn').onclick=loadData;
  $('#saveConfig').onclick=()=>{CONFIG.sheetId=$('#sheetId').value.trim();CONFIG.apiUrl=$('#apiUrl').value.trim();localStorage.setItem('simple_sheet_id',CONFIG.sheetId);localStorage.setItem('simple_api_url',CONFIG.apiUrl);toast('บันทึกแล้ว');loadData();};
  $('#testApi').onclick=async()=>{try{await api('ping',{},'GET');toast('API ใช้ได้');}catch(e){toast('API ใช้ไม่ได้: '+e.message)}};
  $('#warehouseForm').onsubmit=submitWarehouse; $('#taskForm').onsubmit=submitTask; $('#docForm').onsubmit=submitDoc; $('#calendarForm').onsubmit=submitCalendar;
  ['taskSearch','taskFilterWh','taskFilterStatus'].forEach(id=>$('#'+id)?.addEventListener('input',renderTasks)); $('#prevMonth').onclick=()=>changeMonth(-1); $('#nextMonth').onclick=()=>changeMonth(1); $('#calendarMonth').onchange=renderCalendar;
}
function show(v){$$('.nav').forEach(b=>b.classList.toggle('active',b.dataset.view===v));$$('.view').forEach(x=>x.classList.remove('active'));$('#'+v+'View').classList.add('active');$('#pageTitle').textContent=$(`button[data-view="${v}"]`).textContent;}
async function api(action,payload={},method='POST'){
  if(!CONFIG.apiUrl) throw new Error('ยังไม่ได้ใส่ Apps Script URL');
  const res=await fetch(method==='GET'?`${CONFIG.apiUrl}?action=${encodeURIComponent(action)}`:CONFIG.apiUrl, method==='GET'?{method:'GET'}:{method:'POST',body:JSON.stringify({action,...payload})});
  const j=await res.json(); if(!j.success) throw new Error(j.message||'API error'); return j;
}
async function loadData(){
  $('#sheetId').value=CONFIG.sheetId; $('#apiUrl').value=CONFIG.apiUrl;
  try{const j=await api('getAllData',{},'GET'); state={...state,...j.data}; if(!state.Calendar) state.Calendar=[]; $('#syncBox').textContent='เชื่อมต่อแล้ว';}
  catch(e){console.error(e); $('#syncBox').textContent=CONFIG.apiUrl?'เชื่อมต่อแล้ว แต่โหลดข้อมูลไม่ได้':'Demo Mode'; if(!state.Warehouses.length) seedDemo();}
  state.settingsMap=makeSettings(state.Settings); renderAll();
}
function makeSettings(rows){const out={}; if(!rows?.length) return defaultSettings(); Object.keys(rows[0]).forEach(k=>out[k]=rows.map(r=>r[k]).filter(Boolean)); return {...defaultSettings(),...out};}
function defaultSettings(){return {'Task Status':['To Do','กำลังดำเนินการ','รอเอกสาร','รอ Vendor','ติดขัด','ปิดแล้ว'],Priority:['สูง','กลาง','ต่ำ'],'Warehouse Status':['ยังไม่เริ่ม','กำลังปิดคลัง','รอส่งมอบ','ส่งมอบแล้ว','ปิดโครงการแล้ว'],'Document Type':['สัญญาเช่า','ใบส่งมอบพื้นที่','รูปภาพพื้นที่','Invoice / PO','อื่น ๆ'],'Document Status':['รอตรวจสอบ','ผ่าน','ต้องแก้ไข'],'Event Type':['กำหนดส่งงาน','นัดหมาย','ตรวจพื้นที่','ติดตามเอกสาร'],'Calendar Status':['ยังไม่เตือน','เตือนแล้ว','เสร็จสิ้น','ยกเลิก']}}
function renderAll(){fillDropdowns(); renderDashboard(); renderWarehouses(); renderTasks(); renderDocs(); renderCalendar(); renderSettings();}
function fillDropdowns(){
  $$('[data-setting]').forEach(s=>fill(s,state.settingsMap[s.dataset.setting]||[],s.dataset.setting));
  const wh=state.Warehouses.map(w=>({v:w['Warehouse ID'],t:`${w['Warehouse Name']} (${w['Warehouse ID']})`}));
  ['taskWh','docWh','calWh'].forEach(id=>fillObj($('#'+id),wh,'เลือกคลัง'));
  fillObj($('#taskFilterWh'),[{v:'',t:'ทุกคลัง'},...wh],'ทุกคลัง',false); fill($('#taskFilterStatus'),['',...state.settingsMap['Task Status']],'ทุกสถานะ',false);
}
function fill(s,arr,ph='เลือก',clear=true){if(!s)return; const old=s.value; s.innerHTML=(clear?`<option value="">${ph}</option>`:'')+[...new Set(arr)].map(x=>`<option>${esc(x)}</option>`).join(''); if([...s.options].some(o=>o.value===old))s.value=old;}
function fillObj(s,arr,ph='เลือก',clear=true){if(!s)return; const old=s.value; s.innerHTML=(clear?`<option value="">${ph}</option>`:'')+arr.map(o=>`<option value="${esc(o.v)}">${esc(o.t)}</option>`).join(''); if([...s.options].some(o=>o.value===old))s.value=old;}
function renderDashboard(){const tasks=state.Tasks, pending=tasks.filter(t=>t.Status!=='ปิดแล้ว'), done=tasks.filter(t=>t.Status==='ปิดแล้ว'), over=pending.filter(t=>diff(t['Due Date'])<0); $('#kWh').textContent=state.Warehouses.length;$('#kTasks').textContent=tasks.length;$('#kPending').textContent=pending.length;$('#kOverdue').textContent=over.length;$('#kDone').textContent=done.length; $('#followList').innerHTML=pending.filter(t=>diff(t['Due Date'])<=3||['ติดขัด','รอเอกสาร','รอ Vendor'].includes(t.Status)).map(taskItem).join('')||'<p>ยังไม่มีงานที่ต้องตาม</p>';}
function renderWarehouses(){$('#warehouseCards').innerHTML=state.Warehouses.map(w=>`<div class="item"><b>${esc(w['Warehouse Name'])}</b><small>${esc(w.Location)} · ${esc(w.Owner)} · ${esc(w.Status)}</small><div class="actions"><button class="tiny" onclick="quickAddTask('${w['Warehouse ID']}')">เพิ่มงาน</button><button class="tiny red" onclick="del('Warehouses','${w['Warehouse ID']}')">ลบ</button></div></div>`).join('')||'<p>ยังไม่มีคลัง</p>';}
function renderTasks(){const q=($('#taskSearch').value||'').toLowerCase(), wh=$('#taskFilterWh').value, st=$('#taskFilterStatus').value; const rows=state.Tasks.filter(t=>(!wh||t['Warehouse ID']===wh)&&(!st||t.Status===st)&&JSON.stringify(t).toLowerCase().includes(q)); $('#tasksTable').innerHTML=`<tr><th>ID</th><th>คลัง</th><th>งาน</th><th>Owner</th><th>Status</th><th>Due</th><th>Progress</th><th></th></tr>`+rows.map(t=>`<tr><td>${t['Task ID']}</td><td>${whName(t['Warehouse ID'])}</td><td>${esc(t['Task Name'])}</td><td>${esc(t.Assignee)}</td><td>${pill(t.Status)}</td><td>${esc(t['Due Date'])}</td><td>${t.Progress||0}%</td><td><button class="tiny" onclick="changeStatus('${t['Task ID']}')">แก้สถานะ</button><button class="tiny red" onclick="del('Tasks','${t['Task ID']}')">ลบ</button></td></tr>`).join('');}
function renderDocs(){const groups={}; state.Warehouses.forEach(w=>groups[w['Warehouse ID']]={w,docs:[]}); state.Documents.forEach(d=>(groups[d['Warehouse ID']]||={w:{'Warehouse Name':'ไม่ผูกคลัง','Warehouse ID':''},docs:[]}).docs.push(d)); $('#docsByWh').innerHTML=Object.values(groups).map(g=>`<div class="item"><b>${esc(g.w['Warehouse Name'])}</b><small>${g.docs.length} เอกสาร</small>${g.docs.map(d=>`<div class="item"><b>${esc(d['Document Name'])}</b><small>${esc(d['Document Type'])} · ${esc(d.Status)}</small><div class="actions"><a class="tiny gray" target="_blank" href="${d['File Link']||'#'}">เปิด</a><button class="tiny red" onclick="del('Documents','${d['Document ID']}')">ลบ</button></div></div>`).join('')||'<p>ยังไม่มีเอกสาร</p>'}</div>`).join('');}

let selectedDate = new Date().toISOString().slice(0,10);
function renderCalendar(){
  const input=$('#calendarMonth'); if(!input) return;
  if(!input.value) input.value=new Date().toISOString().slice(0,7);
  const [yy,mm]=input.value.split('-').map(Number);
  const first=new Date(yy,mm-1,1); const start=new Date(first); start.setDate(1-first.getDay());
  const names=['อา','จ','อ','พ','พฤ','ศ','ส'];
  const events=[...(state.Calendar||[]), ...(state.Tasks||[]).filter(t=>t['Due Date']).map(t=>({'Event ID':t['Task ID'],'Warehouse ID':t['Warehouse ID'],'Task ID':t['Task ID'],Title:t['Task Name'],Type:'Task Due','Due Date':t['Due Date'],Status:t.Status,Assignee:t.Assignee}))];
  const map={}; events.forEach(e=>{const d=dateISO(e['Due Date']||e['Start Date']); if(d)(map[d]??=[]).push(e);});
  let html=names.map(n=>`<div class="dayname">${n}</div>`).join('');
  const today=new Date().toISOString().slice(0,10);
  for(let i=0;i<42;i++){
    const d=new Date(start); d.setDate(start.getDate()+i); const iso=d.toISOString().slice(0,10);
    const arr=map[iso]||[];
    html += `<div class="daycell ${d.getMonth()!==mm-1?'other':''} ${iso===today?'today':''}" onclick="selectDate('${iso}')"><div class="daynum">${d.getDate()}</div>${arr.slice(0,3).map(e=>`<span class="calevent ${e.Status==='ปิดแล้ว'||e.Status==='เสร็จสิ้น'?'done':diff(iso)<0?'overdue':''}">${esc(e.Title)}</span>`).join('')}${arr.length>3?`<small>+${arr.length-3}</small>`:''}</div>`;
  }
  $('#monthGrid').innerHTML=html; renderSelectedEvents(map);
}
function selectDate(iso){selectedDate=iso; renderCalendar();}
function renderSelectedEvents(map){$('#selectedDateTitle').textContent='งานของวันที่ '+selectedDate; const arr=(map&&map[selectedDate])||[]; $('#selectedDateEvents').innerHTML=arr.map(e=>`<div class="item"><b>${esc(e.Title)}</b><small>${whName(e['Warehouse ID'])} · ${esc(e.Type)} · ${esc(e.Assignee)} · ${esc(e.Status)}</small>${e['Task ID']?`<div class="actions"><button class="tiny" onclick="changeStatus('${e['Task ID']}')">แก้สถานะงาน</button></div>`:''}</div>`).join('')||'<p>ไม่มีรายการในวันนี้</p>';}
function changeMonth(n){const i=$('#calendarMonth'); const [y,m]=i.value.split('-').map(Number); const d=new Date(y,m-1+n,1); i.value=d.toISOString().slice(0,7); renderCalendar();}
function dateISO(v){if(!v)return ''; const s=String(v); const iso=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if(iso)return `${iso[1]}-${String(iso[2]).padStart(2,'0')}-${String(iso[3]).padStart(2,'0')}`; const th=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); if(th)return `${th[3]}-${String(th[2]).padStart(2,'0')}-${String(th[1]).padStart(2,'0')}`; const d=new Date(s); return isNaN(d)?'':d.toISOString().slice(0,10);}
function renderSettings(){$('#settingEditor').innerHTML=Object.entries(state.settingsMap).map(([k,arr])=>`<div class="settingGroup"><h4>${k}</h4><div class="settingPills">${arr.map(v=>`<span>${esc(v)} <button onclick="delSetting('${k}','${v}')">x</button></span>`).join('')}</div><div class="filters"><input id="new_${k.replaceAll(' ','_')}" placeholder="เพิ่ม ${k}"><button onclick="addSetting('${k}')">เพิ่ม</button></div></div>`).join('');}
async function submitWarehouse(e){e.preventDefault(); const d=obj(e.target); await post('addWarehouse',{record:{'Warehouse ID':id('WH'),'Warehouse Name':d['Warehouse Name'],Location:d.Location,Owner:d.Owner,'Start Date':d['Start Date'],'Target Date':d['Target Date'],Status:d.Status,'Folder Link':d['Folder Link'],Notes:d.Notes}},'เพิ่มคลังแล้ว'); e.target.reset();}
async function submitTask(e){e.preventDefault(); const d=obj(e.target); await post('addTask',{record:{'Task ID':id('T'),'Warehouse ID':d['Warehouse ID'],'Task Name':d['Task Name'],Assignee:d.Assignee,Status:d.Status,Priority:d.Priority,'Due Date':d['Due Date'],Progress:d.Progress,'Evidence Link':d['Evidence Link'],Notes:d.Notes}},'เพิ่มงานแล้ว'); e.target.reset();}
async function submitDoc(e){e.preventDefault(); const d=obj(e.target); await post('addDocument',{record:{'Document ID':id('DOC'),'Warehouse ID':d['Warehouse ID'],'Task ID':d['Task ID'],'Document Type':d['Document Type'],'Document Name':d['Document Name'],'File Link':d['File Link'],Status:d.Status}},'เพิ่มเอกสารแล้ว'); e.target.reset();}
async function submitCalendar(e){e.preventDefault(); const d=obj(e.target); await post('addCalendar',{record:{'Event ID':id('EV'),'Warehouse ID':d['Warehouse ID'],'Task ID':d['Task ID'],Title:d.Title,Type:d.Type,'Start Date':d['Start Date'],'Due Date':d['Due Date'],Assignee:d.Assignee,'Reminder Days':d['Reminder Days'],Status:d.Status,Notes:d.Notes}},'เพิ่มแผนงานแล้ว'); e.target.reset();}
async function post(action,payload,msg){try{await api(action,payload); toast(msg); await loadData();}catch(e){toast('ไม่สำเร็จ: '+e.message)}}
function changeStatus(taskId){const t=state.Tasks.find(x=>x['Task ID']===taskId); const s=prompt('สถานะใหม่',t?.Status||''); if(!s)return; post('updateTaskStatus',{taskId,status:s},'อัปเดตสถานะแล้ว');}
function del(sheet,idv){if(confirm('ยืนยันลบ '+idv+' ?'))post('deleteRecord',{sheet,recordId:idv},'ลบแล้ว')}
function addSetting(k){const inp=$('#new_'+k.replaceAll(' ','_')); if(inp?.value)post('addSetting',{category:k,value:inp.value},'เพิ่ม setting แล้ว')}
function delSetting(k,v){if(confirm('ลบ '+v+' ?'))post('deleteSetting',{category:k,value:v},'ลบ setting แล้ว')}
function quickAddTask(wh){show('tasks');$('#taskWh').value=wh}
function obj(form){return Object.fromEntries(new FormData(form).entries())} function id(p){return p+'-'+Math.floor(1000+Math.random()*9000)} function whName(id){return state.Warehouses.find(w=>w['Warehouse ID']===id)?.['Warehouse Name']||id||'-'} function esc(x){return String(x||'').replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]))} function pill(s){let c=s==='ปิดแล้ว'?'done':['ติดขัด','รอเอกสาร','รอ Vendor'].includes(s)?'danger':'warn';return `<span class="pill ${c}">${esc(s)}</span>`} function taskItem(t){return `<div class="item"><b>${t['Task ID']} · ${esc(t['Task Name'])}</b><small>${whName(t['Warehouse ID'])} · ${esc(t.Status)} · Due ${esc(t['Due Date'])}</small></div>`} function diff(v){if(!v)return 9999;const d=new Date(v); if(isNaN(d))return 9999; const n=new Date(); n.setHours(0,0,0,0); return Math.floor((d-n)/86400000)} function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2500)}
function seedDemo(){state.Warehouses=[{'Warehouse ID':'WH-0001','Warehouse Name':'คลังตัวอย่าง',Location:'กรุงเทพฯ',Owner:'Earth',Status:'กำลังปิดคลัง'}];state.Tasks=[{'Task ID':'T-0001','Warehouse ID':'WH-0001','Task Name':'ตรวจสัญญาเช่า',Assignee:'Earth',Status:'To Do',Priority:'สูง','Due Date':'2026-05-30',Progress:0}];state.Documents=[];state.Calendar=[];state.Settings=[];state.settingsMap=defaultSettings();}
