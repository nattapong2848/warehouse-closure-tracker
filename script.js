const CONFIG = {
  spreadsheetId: localStorage.getItem('spx_sheet_id') || '1sV6GP5swsuPnB8biAl7WfadzK7ISVKizYXCsIq4fsSA',
  apiUrl: localStorage.getItem('spx_api_url') || 'https://script.google.com/macros/s/AKfycbw6IT1EP4h_XU1u3gMYaeH8kHr_r1n_q1mCB7-Yad51tHHt9WNefYUbQYEndooHT4LTCg/exec'
};

const sampleTasks = [
  {id:'SPX-0001',date:'2026-05-21',warehouse:'คลังบางนา',zone:'Inbound',type:'ตรวจนับทรัพย์สิน',detail:'ตรวจนับอุปกรณ์ก่อนส่งคืนพื้นที่',owner:'คุณเอก',department:'Operation',priority:'สูง',status:'กำลังดำเนินการ',dueDate:'2026-05-28',closedDate:'',progress:65,risk:'รอ vendor ยืนยันจำนวน',solution:'ตามเอกสาร PO และนัดเข้าพื้นที่'},
  {id:'SPX-0002',date:'2026-05-21',warehouse:'คลังลาดกระบัง',zone:'Outbound',type:'คืนพื้นที่',detail:'ตรวจความเรียบร้อยก่อนส่งมอบ landlord',owner:'คุณมีน',department:'Facility',priority:'กลาง',status:'รอตรวจสอบ',dueDate:'2026-06-03',closedDate:'',progress:35,risk:'รอใบเสนอราคาซ่อมพื้น',solution:'ให้ช่างเข้าประเมิน'},
  {id:'SPX-0003',date:'2026-05-21',warehouse:'คลังรังสิต',zone:'Office',type:'เอกสาร / สัญญา',detail:'รวบรวมเอกสารส่งคืนพื้นที่',owner:'คุณนัท',department:'Legal',priority:'สูง',status:'รอเอกสาร',dueDate:'2026-05-24',closedDate:'',progress:45,risk:'เอกสาร landlord ยังไม่ครบ',solution:'ตาม owner ทุกวัน'},
  {id:'SPX-0004',date:'2026-05-21',warehouse:'คลังบางพลี',zone:'Facility',type:'ซ่อมแซม / Facility',detail:'เก็บ defect list หลังรื้อถอน',owner:'คุณบี',department:'Facility',priority:'ต่ำ',status:'ปิดแล้ว',dueDate:'2026-05-20',closedDate:'2026-05-20',progress:100,risk:'',solution:'ปิดงานแล้ว'}
];

let tasks = [];
let statusChart, priorityChart;

const $ = (id) => document.getElementById(id);
const toast = (msg) => {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2600);
};

function normalizeTask(row){
  return {
    id: row.id || row.ID || row['ID'] || `SPX-${Date.now()}`,
    date: row.date || row['วันที่บันทึก'] || new Date().toISOString().slice(0,10),
    warehouse: row.warehouse || row['ชื่อคลัง'] || '',
    zone: row.zone || row['พื้นที่/โซน'] || '',
    type: row.type || row['ประเภทงาน'] || '',
    detail: row.detail || row['รายละเอียดงาน'] || '',
    owner: row.owner || row['ผู้รับผิดชอบ'] || '',
    department: row.department || row['ฝ่ายที่เกี่ยวข้อง'] || '',
    priority: row.priority || row['ความสำคัญ'] || 'กลาง',
    status: row.status || row['สถานะ'] || 'กำลังดำเนินการ',
    dueDate: row.dueDate || row['วันที่ครบกำหนด'] || '',
    closedDate: row.closedDate || row['วันที่ปิดงาน'] || '',
    progress: Number(row.progress || row['ความคืบหน้า (%)'] || 0),
    risk: row.risk || row['ปัญหา/ความเสี่ยง'] || '',
    solution: row.solution || row['แนวทางแก้ไข'] || ''
  };
}

async function fetchTasks(){
  if(!CONFIG.apiUrl){
    tasks = JSON.parse(localStorage.getItem('spx_local_tasks') || 'null') || sampleTasks;
    $('connectionStatus').textContent = 'Local Preview';
    renderAll();
    return;
  }
  try{
    $('connectionStatus').textContent = 'กำลังเชื่อมต่อ...';
    const url = `${CONFIG.apiUrl}?action=list&sheetId=${encodeURIComponent(CONFIG.spreadsheetId)}`;
    const res = await fetch(url);
    const json = await res.json();
    tasks = (json.data || []).map(normalizeTask);
    $('connectionStatus').textContent = 'Google Sheet Connected';
    renderAll();
  }catch(err){
    console.error(err);
    $('connectionStatus').textContent = 'เชื่อมต่อไม่สำเร็จ';
    tasks = JSON.parse(localStorage.getItem('spx_local_tasks') || 'null') || sampleTasks;
    renderAll();
    toast('เชื่อมต่อ Sheet ไม่สำเร็จ แสดงข้อมูลตัวอย่างแทน');
  }
}

async function submitTask(task){
  if(!CONFIG.apiUrl){
    const local = JSON.parse(localStorage.getItem('spx_local_tasks') || 'null') || sampleTasks;
    local.unshift(task);
    localStorage.setItem('spx_local_tasks', JSON.stringify(local));
    tasks = local;
    renderAll();
    toast('บันทึกใน Local Preview แล้ว');
    return;
  }
  const res = await fetch(CONFIG.apiUrl, {
    method: 'POST',
    mode: 'cors',
    headers: {'Content-Type':'text/plain;charset=utf-8'},
    body: JSON.stringify({action:'create', sheetId: CONFIG.spreadsheetId, data: task})
  });
  const json = await res.json();
  if(!json.ok) throw new Error(json.error || 'Save failed');
  await fetchTasks();
  toast('บันทึกเข้า Google Sheet แล้ว');
}

function isOverdue(t){
  if(!t.dueDate || t.status === 'ปิดแล้ว') return false;
  const today = new Date(); today.setHours(0,0,0,0);
  return new Date(t.dueDate) < today;
}
function countBy(key){
  return tasks.reduce((acc,t)=>{acc[t[key]]=(acc[t[key]]||0)+1; return acc;},{});
}
function renderStats(){
  $('totalTasks').textContent = tasks.length;
  $('inProgressTasks').textContent = tasks.filter(t => t.status !== 'ปิดแล้ว').length;
  $('overdueTasks').textContent = tasks.filter(isOverdue).length;
  $('doneTasks').textContent = tasks.filter(t => t.status === 'ปิดแล้ว').length;
}
function renderCharts(){
  if(typeof Chart === 'undefined') return;
  const statusData = countBy('status');
  const priorityData = countBy('priority');
  if(statusChart) statusChart.destroy();
  if(priorityChart) priorityChart.destroy();
  statusChart = new Chart($('statusChart'), {type:'doughnut', data:{labels:Object.keys(statusData), datasets:[{data:Object.values(statusData)}]}, options:{plugins:{legend:{position:'bottom'}}, cutout:'62%'}});
  priorityChart = new Chart($('priorityChart'), {type:'bar', data:{labels:Object.keys(priorityData), datasets:[{label:'จำนวนงาน', data:Object.values(priorityData), borderRadius:12}]}, options:{plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true,ticks:{precision:0}}}}});
}
function badgeClass(t){
  if(t.status === 'ปิดแล้ว') return 'green';
  if(isOverdue(t) || t.priority === 'สูง') return 'red';
  return 'orange';
}
function renderUrgent(){
  const urgent = tasks.filter(t => t.status !== 'ปิดแล้ว').sort((a,b)=>{
    const pa = a.priority === 'สูง' ? 0 : a.priority === 'กลาง' ? 1 : 2;
    const pb = b.priority === 'สูง' ? 0 : b.priority === 'กลาง' ? 1 : 2;
    return pa - pb || new Date(a.dueDate) - new Date(b.dueDate);
  }).slice(0,6);
  $('urgentLane').innerHTML = urgent.map(t => `
    <div class="task-card">
      <div class="task-meta">
        <span class="badge ${badgeClass(t)}">${isOverdue(t) ? 'เลยกำหนด' : t.priority}</span>
        <span class="badge">${t.status}</span>
      </div>
      <h4>${t.warehouse || '-'}</h4>
      <p>${t.detail || t.type || '-'}</p>
      <div class="task-meta"><span>Owner: ${t.owner || '-'}</span><span>Due: ${t.dueDate || '-'}</span></div>
      <div class="progress"><i style="width:${Math.min(100, Math.max(0,t.progress))}%"></i></div>
    </div>
  `).join('') || '<p>ยังไม่มีงานที่ต้องตาม</p>';
}
function renderTable(){
  const q = $('searchInput').value.trim().toLowerCase();
  const status = $('statusFilter').value;
  const filtered = tasks.filter(t => {
    const hay = `${t.id} ${t.warehouse} ${t.owner} ${t.detail} ${t.risk}`.toLowerCase();
    return (!q || hay.includes(q)) && (!status || t.status === status);
  });
  $('taskTable').innerHTML = filtered.map(t => `
    <tr>
      <td><strong>${t.id}</strong></td>
      <td>${t.warehouse}<br><small>${t.zone || ''}</small></td>
      <td>${t.type || '-'}</td>
      <td>${t.owner || '-'}</td>
      <td><span class="badge ${badgeClass(t)}">${t.status}</span></td>
      <td>${t.dueDate || '-'}</td>
      <td>${t.progress}%<div class="progress"><i style="width:${Math.min(100, Math.max(0,t.progress))}%"></i></div></td>
      <td>${t.risk || '-'}</td>
    </tr>
  `).join('') || '<tr><td colspan="8">ไม่พบข้อมูล</td></tr>';
}
function renderAll(){renderStats();renderCharts();renderUrgent();renderTable();}

function switchView(name){
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(n => n.classList.toggle('active', n.dataset.view === name));
  $(`${name}View`).classList.add('active');
  $('pageTitle').textContent = {dashboard:'ภาพรวมงานปิดคลัง',form:'เพิ่มงานใหม่',tasks:'รายการงานทั้งหมด',settings:'ตั้งค่าการเชื่อมต่อ'}[name];
}

document.addEventListener('DOMContentLoaded', () => {
  $('sheetIdLabel').textContent = `${CONFIG.spreadsheetId.slice(0,4)}...${CONFIG.spreadsheetId.slice(-4)}`;
  $('sheetIdInput').value = CONFIG.spreadsheetId;
  $('apiUrlInput').value = CONFIG.apiUrl;
  document.querySelectorAll('.nav-link').forEach(btn => btn.addEventListener('click', () => switchView(btn.dataset.view)));
  document.querySelectorAll('[data-jump]').forEach(btn => btn.addEventListener('click', () => switchView(btn.dataset.jump)));
  $('refreshBtn').addEventListener('click', fetchTasks);
  $('searchInput').addEventListener('input', renderTable);
  $('statusFilter').addEventListener('change', renderTable);
  $('saveSettingsBtn').addEventListener('click', () => {
    localStorage.setItem('spx_api_url', $('apiUrlInput').value.trim());
    localStorage.setItem('spx_sheet_id', $('sheetIdInput').value.trim());
    toast('บันทึกการตั้งค่าแล้ว รีเฟรชหน้าเว็บเพื่อใช้ค่าใหม่');
  });
  $('taskForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const task = Object.fromEntries(form.entries());
    task.id = `SPX-${String(Date.now()).slice(-6)}`;
    task.date = new Date().toISOString().slice(0,10);
    task.progress = Number(task.progress || 0);
    try{ await submitTask(task); e.target.reset(); switchView('dashboard'); }
    catch(err){ console.error(err); toast('บันทึกไม่สำเร็จ ตรวจสอบ Apps Script URL'); }
  });
  fetchTasks();
});
