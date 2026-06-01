// ══════════════════════════════════════════════════════════════
//  SHOPEE TERMINATE — Warehouse Manager  Apps Script  v4.1
//  แก้ไข: ค้นหา header row จริงใน Sheet (รองรับแถว decorative)
// ══════════════════════════════════════════════════════════════

// Sheet ID เริ่มต้น — client ส่ง sheetId มาด้วยทุก request
const DEFAULT_SPREADSHEET_ID = '1NOBa-cFOiarcPzqe2i9IkpU7IkgV9ndUd6_0jpJdx9w';
let _activeSheetId = DEFAULT_SPREADSHEET_ID;

// นิยามโครงสร้างของแต่ละ Sheet
const SHEETS = {
  Warehouses:          { id: 'Warehouse ID',  headers: ['Warehouse ID','Warehouse Name','Location / Zone','Owner','Owner Phone','Start Date','Target Handover Date','Warehouse Status','Document Folder Link','Notes','Created At','Updated At'] },
  Tasks:               { id: 'Task ID',       headers: ['Task ID','Created Date','Warehouse ID','Phase','Task Name','Assignee','Status','Priority','Due Date','Closed Date','Evidence Link','Last Updated','Notes'] },
  Documents:           { id: 'Document ID',   headers: ['Document ID','Warehouse ID','Task ID','Document Type','Document Name','File Link','Document Status','Uploaded By','Uploaded Date','Notes'] },
  Calendar:            { id: 'Event ID',      headers: ['Event ID','Warehouse ID','Task ID','Event Title','Event Type','Start Date','Due Date','Start Time','End Time','Assignee','Reminder Days','Calendar Status','Notes'] },
  Activity_Log:        { id: 'Log ID',        headers: ['Log ID','Timestamp','Action','Sheet','Record ID','Warehouse ID','User','Details'] },
  Issues:              { id: 'Issue ID',      headers: ['Issue ID','Warehouse ID','Task ID','Issue Title','Impact','Owner','Status','Priority','Due Date','Solution','Created Date','Closed Date','Notes'] },
  Checklist_Templates: { id: 'Template ID',   headers: ['Template ID','Phase','Task Name','Default Assignee','Priority','Default Status','Default Due Offset Days','Document Required','Notes','Case Type','Active'] },
  Trash:               { id: 'Trash ID',      headers: ['Trash ID','Timestamp','Source Sheet','Record ID','Warehouse ID','Deleted By','Reason','Snapshot JSON'] },
  Users:               { id: 'Username',      headers: ['Username','Password Hash','Role','Created At','Updated At','Active'] },
  Settings:            { id: '',              headers: ['Task Status','Priority','Warehouse Status','Phase','Document Type','Document Status','Event Type','Calendar Status'] }
};

/* ──────────────────────────────────────────────────────────────
   ENTRY POINTS
────────────────────────────────────────────────────────────── */
function doGet(e) {
  if (e.parameter.sheetId) _activeSheetId = e.parameter.sheetId;
  else _activeSheetId = DEFAULT_SPREADSHEET_ID;

  const action = e.parameter.action || 'ping';
  try {
    if (action === 'ping')           return json({ success: true, message: 'pong', sheetId: _activeSheetId });
    if (action === 'getUsers')       return json({ success: true, users: getUsersData(), sheetId: _activeSheetId });
    if (action === 'getAllData')      return json({ success: true, data: getAllData() });
    if (action === 'getWarehouses')  return json({ success: true, data: getRows('Warehouses') });
    return json({ success: false, message: 'Unknown GET action: ' + action });
  } catch (err) {
    return json({ success: false, message: String(err) });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    _activeSheetId = (body.sheetId && String(body.sheetId).trim()) ? String(body.sheetId).trim() : DEFAULT_SPREADSHEET_ID;
    const action = body.action;
    if (action === 'getWarehouses')            return json({ success: true, data: getRows('Warehouses') });
    if (action === 'addWarehouse')             return json(addRecord('Warehouses', body));
    if (action === 'addTask')                  return json(addTask(body));
    if (action === 'addDocument')              return json(addRecord('Documents', body));
    if (action === 'addCalendarEvent')         return json(addRecord('Calendar', body));
    if (action === 'addIssue')                 return json(addRecord('Issues', body));
    if (action === 'updateStatus')             return json(updateStatus(body));
    if (action === 'updateWarehouse')          return json(updateWarehouse(body));
    if (action === 'updateTask')               return json(updateTask(body));
    if (action === 'updateCalendarEvent')      return json(updateCalendarEvent(body));
    if (action === 'deleteRecord')             return json(deleteRecord(body));
    if (action === 'createChecklist')          return json(createChecklist(body));
    if (action === 'saveUsers')                return json(saveUsersData(body));
    if (action === 'addSettingOption')         return json(addSettingOption(body));
    if (action === 'deleteSettingOption')      return json(deleteSettingOption(body));
    if (action === 'addChecklistTemplate')     return json(addChecklistTemplate(body));
    if (action === 'updateChecklistTemplate')  return json(updateChecklistTemplate(body));
    if (action === 'deleteChecklistTemplate')  return json(deleteChecklistTemplate(body));
    return json({ success: false, message: 'Unknown POST action: ' + action });
  } catch (err) {
    return json({ success: false, message: String(err) });
  }
}

/* ──────────────────────────────────────────────────────────────
   CORE HELPERS — หา Header Row จริง (ข้ามแถว decorative)
────────────────────────────────────────────────────────────── */

// คืน index (0-based) ของแถว header จริงในอาเรย์ allValues
// วิธี: สแกน 8 แถวแรก หาแถวที่ cell[0] ตรงกับ headers[0] ของ config
function findHeaderRowIndex(sheetName, allValues) {
  const config = SHEETS[sheetName];
  if (!config || !config.headers || !config.headers[0]) return 0;
  const expected = config.headers[0].trim();
  for (let i = 0; i < Math.min(allValues.length, 8); i++) {
    if (String(allValues[i][0] || '').trim() === expected) return i;
  }
  return 0; // fallback: ใช้แถวแรก
}

// คืน object sheet — ถ้าไม่มีให้สร้างใหม่พร้อม header
function ensureSheet(name) {
  const ss = SpreadsheetApp.openById(_activeSheetId);
  let sh   = ss.getSheetByName(name);
  if (!sh) {
    // สร้าง sheet ใหม่พร้อมเขียน header ที่แถว 1
    sh = ss.insertSheet(name);
    const headers = SHEETS[name] && SHEETS[name].headers;
    if (headers && headers.length) {
      sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
  }
  // ไม่แก้ไข sheet ที่มีอยู่แล้ว — ป้องกันการเขียนทับแถว decorative
  return sh;
}

// อ่านแถวข้อมูลจาก sheet — ข้าม decorative rows และ filter เฉพาะคอลัมน์ที่ถูกต้อง
function getRows(sheetName) {
  const sh  = ensureSheet(sheetName);
  const all = sh.getDataRange().getDisplayValues();
  if (!all || all.length < 1) return [];

  const hi = findHeaderRowIndex(sheetName, all);
  if (all.length <= hi + 1) return []; // ไม่มีแถวข้อมูล

  const config       = SHEETS[sheetName];
  const validHeaders = config ? new Set(config.headers) : null;
  const rawHeaders   = all[hi].map(h => String(h || '').trim());

  return all.slice(hi + 1)
    .filter(r => r.some(c => String(c).trim()))
    .map(row => {
      const obj = {};
      rawHeaders.forEach((h, i) => {
        // เก็บเฉพาะคอลัมน์ที่อยู่ใน config.headers (กรองคอลัมน์ที่เพิ่มโดยพลาด)
        if (h && (!validHeaders || validHeaders.has(h))) {
          obj[h] = String(row[i] || '').trim();
        }
      });
      return obj;
    });
}

// หาเลขแถว (1-based) ของ record ที่มี idField === idValue
function findRow(sheetName, idField, idValue) {
  const sh  = ensureSheet(sheetName);
  const all = sh.getDataRange().getDisplayValues();
  if (!all || all.length < 2) return null;

  const hi      = findHeaderRowIndex(sheetName, all);
  const headers = all[hi].map(h => String(h || '').trim());
  const colIdx  = headers.indexOf(idField);
  if (colIdx < 0) return null;

  const target = String(idValue || '').trim();
  for (let i = hi + 1; i < all.length; i++) {
    if (all[i].some(c => String(c).trim()) && String(all[i][colIdx]).trim() === target) {
      return i + 1; // คืน row number แบบ 1-based
    }
  }
  return null;
}

// Auto-assign ID ให้แถวข้อมูลที่ยังไม่มี (ไม่แตะแถว decorative)
function patchMissingIds(sheetName, idField, prefix) {
  try {
    const sh  = ensureSheet(sheetName);
    const all = sh.getDataRange().getDisplayValues();
    if (!all || all.length < 2) return;

    const hi      = findHeaderRowIndex(sheetName, all);
    const headers = all[hi].map(h => String(h || '').trim());
    const colIdx  = headers.indexOf(idField);
    if (colIdx < 0) return;

    for (let i = hi + 1; i < all.length; i++) {
      // ข้ามแถวที่ว่างทั้งหมด
      if (!all[i].some(c => String(c).trim())) continue;
      // ถ้ายังไม่มี ID — assign ใหม่
      if (!String(all[i][colIdx]).trim()) {
        sh.getRange(i + 1, colIdx + 1).setValue(generateId(prefix, sheetName));
      }
    }
  } catch (e) {
    // ไม่หยุดกระบวนการถ้า patch ล้มเหลว
  }
}

// หา index แถว header (1-based) ของ Settings sheet
function getSettingsHeaderRow1Based(sh) {
  const all      = sh.getDataRange().getDisplayValues();
  const expected = SHEETS.Settings.headers[0]; // 'Task Status'
  for (let i = 0; i < Math.min(all.length, 8); i++) {
    if (String(all[i][0] || '').trim() === expected) return i + 1;
  }
  return 1;
}

/* ──────────────────────────────────────────────────────────────
   DATA — READ / WRITE
────────────────────────────────────────────────────────────── */
function getAllData() {
  // Auto-patch IDs ให้แถวที่ไม่มี (patch เฉพาะแถวข้อมูล ไม่แตะ decorative)
  [
    { sheet: 'Warehouses', idField: 'Warehouse ID', prefix: 'WH'  },
    { sheet: 'Tasks',      idField: 'Task ID',      prefix: 'T'   },
    { sheet: 'Calendar',   idField: 'Event ID',     prefix: 'EV'  },
    { sheet: 'Issues',     idField: 'Issue ID',     prefix: 'ISS' },
    { sheet: 'Documents',  idField: 'Document ID',  prefix: 'DOC' },
  ].forEach(function(cfg) { patchMissingIds(cfg.sheet, cfg.idField, cfg.prefix); });

  const out = {};
  Object.keys(SHEETS).forEach(name => out[name] = getRows(name));
  return out;
}

function addRecord(sheetName, data) {
  const sh      = ensureSheet(sheetName);
  const config  = SHEETS[sheetName];
  const headers = config.headers;
  const idField = config.id;
  if (idField && !data[idField]) data[idField] = generateId(prefixFor(sheetName), sheetName);
  const row = headers.map(h => data[h] !== undefined ? data[h] : '');
  sh.appendRow(row);
  if (sheetName !== 'Activity_Log') {
    logActivity('ADD_' + sheetName, sheetName, data[idField] || '', data['Warehouse ID'] || '', data.user || 'System', 'Added record');
  }
  return { success: true, data };
}

function addTask(body) {
  const task = body.task || body;
  if (!task['Task ID']) task['Task ID'] = generateId('T', 'Tasks');
  delete task['Progress %'];
  addRecord('Tasks', task);
  if (body.createCalendar && task['Due Date']) {
    addRecord('Calendar', {
      'Event ID':        generateId('EV', 'Calendar'),
      'Warehouse ID':    task['Warehouse ID'],
      'Task ID':         task['Task ID'],
      'Event Title':     task['Task Name'],
      'Event Type':      'กำหนดส่งงาน',
      'Start Date':      task['Created Date'] || '',
      'Due Date':        task['Due Date'],
      'Start Time':      '',
      'End Time':        '',
      'Assignee':        task['Assignee'],
      'Reminder Days':   2,
      'Calendar Status': 'ยังไม่เตือน',
      'Notes':           'สร้างจากงาน ' + task['Task ID']
    });
  }
  return { success: true, data: task };
}

/* ──────────────────────────────────────────────────────────────
   UPDATE FUNCTIONS
────────────────────────────────────────────────────────────── */
function updateStatus(data) {
  // รองรับทั้ง field name: id, taskId, recordId
  const recordId   = String(data.id || data.taskId || data.recordId || '').trim();
  const sheetName  = data.sheet || 'Tasks';
  const config     = SHEETS[sheetName];
  if (!config) return { success: false, message: 'ไม่พบ sheet: ' + sheetName };
  if (!recordId)  return { success: false, message: 'ไม่มี ID ในคำขอ' };

  const sh      = ensureSheet(sheetName);
  const headers  = config.headers;
  const idField  = headers[0]; // คอลัมน์แรกเสมอ = ID
  const row      = findRow(sheetName, idField, recordId);
  if (!row) return { success: false, message: 'ไม่พบ ' + idField + ': ' + recordId };

  const field          = data.field || 'Status';
  const fieldCol       = headers.indexOf(field) + 1;
  if (fieldCol < 1)    return { success: false, message: 'ไม่พบ field: ' + field };
  const oldVal         = sh.getRange(row, fieldCol).getValue();
  sh.getRange(row, fieldCol).setValue(data.status || data.value || oldVal);

  const lastUpdIdx = headers.indexOf('Last Updated');
  if (lastUpdIdx >= 0) sh.getRange(row, lastUpdIdx + 1).setValue(new Date());

  const closedIdx  = headers.indexOf('Closed Date');
  const closedStatuses = ['ปิดแล้ว', 'เสร็จสิ้น', 'ปิดงาน', 'Closed'];
  if (closedIdx >= 0 && closedStatuses.includes(data.status || data.value || '')) {
    sh.getRange(row, closedIdx + 1).setValue(new Date());
  }

  const whIdx = headers.indexOf('Warehouse ID');
  const warehouseId = whIdx >= 0 ? sh.getRange(row, whIdx + 1).getValue() : '';
  if (data.note) {
    const noteIdx = headers.indexOf('Notes');
    if (noteIdx >= 0) sh.getRange(row, noteIdx + 1).setValue(data.note);
  }
  logActivity('UPDATE_STATUS', sheetName, recordId, warehouseId, data.user || 'System', oldVal + ' -> ' + (data.status || data.value));
  return { success: true };
}

function updateWarehouse(data) {
  const sh      = ensureSheet('Warehouses');
  const headers = SHEETS.Warehouses.headers;
  const idx     = f => headers.indexOf(f);
  let whId      = String(data['Warehouse ID'] || data.warehouseId || '').trim();
  let row       = whId ? findRow('Warehouses', 'Warehouse ID', whId) : null;

  // Fallback: ถ้าไม่มี ID หรือหาไม่เจอ → ค้นด้วยชื่อคลัง
  if (!row && data['Warehouse Name']) {
    row = findRow('Warehouses', 'Warehouse Name', String(data['Warehouse Name']).trim());
    if (row) {
      // ตรวจสอบว่ามี ID อยู่แล้วหรือยัง
      const existingId = String(sh.getRange(row, idx('Warehouse ID') + 1).getValue()).trim();
      whId = existingId || generateId('WH', 'Warehouses');
      if (!existingId) sh.getRange(row, idx('Warehouse ID') + 1).setValue(whId);
    }
  }
  if (!row) return { success: false, message: 'ไม่พบคลัง "' + (data['Warehouse Name'] || whId) + '" ใน Sheet' };

  const colCount  = headers.length;
  const rowValues = sh.getRange(row, 1, 1, colCount).getValues()[0];
  const editable  = ['Warehouse Name','Location / Zone','Owner','Owner Phone','Start Date','Target Handover Date','Warehouse Status','Document Folder Link','Notes'];
  editable.forEach(f => { if (data[f] !== undefined) rowValues[idx(f)] = data[f]; });
  rowValues[idx('Updated At')] = new Date();
  sh.getRange(row, 1, 1, colCount).setValues([rowValues]);
  logActivity('UPDATE_WAREHOUSE', 'Warehouses', whId, whId, data.user || 'System', 'Updated: ' + String(data['Warehouse Name'] || ''));
  return { success: true };
}

function updateTask(data) {
  const sh      = ensureSheet('Tasks');
  const headers = SHEETS.Tasks.headers;
  const taskId  = String(data['Task ID'] || data.taskId || '').trim();
  if (!taskId) return { success: false, message: 'ไม่มี Task ID ในคำขอ' };
  const row = findRow('Tasks', 'Task ID', taskId);
  if (!row) return { success: false, message: 'ไม่พบงาน ID: "' + taskId + '" ใน Sheet' };
  const idx       = f => headers.indexOf(f);
  const colCount  = headers.length;
  const rowValues = sh.getRange(row, 1, 1, colCount).getValues()[0];
  const editable  = ['Task Name','Assignee','Status','Priority','Due Date','Phase','Evidence Link','Notes'];
  editable.forEach(f => { if (data[f] !== undefined) rowValues[idx(f)] = data[f]; });
  rowValues[idx('Last Updated')] = new Date();
  if (['ปิดแล้ว','เสร็จสิ้น','Completed'].includes(data['Status'])) {
    rowValues[idx('Closed Date')] = new Date();
  }
  sh.getRange(row, 1, 1, colCount).setValues([rowValues]);
  const warehouseId = rowValues[idx('Warehouse ID')] || '';
  logActivity('UPDATE_TASK', 'Tasks', taskId, warehouseId, data.user || 'System', 'Updated: ' + String(data['Task Name'] || ''));
  return { success: true };
}

function updateCalendarEvent(data) {
  const sh      = ensureSheet('Calendar');
  const headers = SHEETS.Calendar.headers;
  const eventId = String(data['Event ID'] || data.eventId || '').trim();
  if (!eventId) return { success: false, message: 'ไม่มี Event ID ในคำขอ' };
  const row = findRow('Calendar', 'Event ID', eventId);
  if (!row) return { success: false, message: 'ไม่พบกิจกรรม ID: "' + eventId + '" ใน Sheet' };
  const idx       = f => headers.indexOf(f);
  const colCount  = headers.length;
  const rowValues = sh.getRange(row, 1, 1, colCount).getValues()[0];
  const editable  = ['Event Title','Event Type','Start Date','Due Date','Start Time','End Time','Assignee','Reminder Days','Calendar Status','Notes'];
  editable.forEach(f => { if (data[f] !== undefined) rowValues[idx(f)] = data[f]; });
  sh.getRange(row, 1, 1, colCount).setValues([rowValues]);
  logActivity('UPDATE_CALENDAR', 'Calendar', eventId, rowValues[idx('Warehouse ID')] || '', data.user || 'System', 'Updated event');
  return { success: true };
}

/* ──────────────────────────────────────────────────────────────
   DELETE
────────────────────────────────────────────────────────────── */
function deleteRecord(data) {
  const sheetName = data.sheet;
  if (!sheetName || !SHEETS[sheetName]) return { success: false, message: 'ไม่รู้จัก Sheet: ' + sheetName };
  const sh        = ensureSheet(sheetName);
  const idField   = SHEETS[sheetName].id;
  // JS ส่งมาเป็น data.id — รองรับทั้ง data.recordId (เก่า) และ data.id (ใหม่)
  const recordId  = String(data.recordId || data.id || '').trim();
  if (!recordId) return { success: false, message: 'ไม่มี ID ในคำขอ' };
  const row       = findRow(sheetName, idField, recordId);
  if (!row) return { success: false, message: 'ไม่พบรายการ ID: "' + recordId + '" ใน ' + sheetName };

  // ใช้ config headers เป็น reference (ไม่ใช้แถว 1 ซึ่งอาจเป็น decorative)
  const headers  = SHEETS[sheetName].headers;
  const colCount = headers.length;
  const values   = sh.getRange(row, 1, 1, colCount).getDisplayValues()[0];
  const snap     = {};
  headers.forEach((h, i) => snap[h] = values[i]);

  ensureSheet('Trash').appendRow([
    generateId('TR','Trash'), new Date(), sheetName,
    recordId, snap['Warehouse ID'] || recordId,
    data.user || 'System', data.reason || '', JSON.stringify(snap)
  ]);
  sh.deleteRow(row);
  logActivity('DELETE_RECORD', sheetName, recordId, snap['Warehouse ID'] || '', data.user || 'System', data.reason || '');
  return { success: true };
}

/* ──────────────────────────────────────────────────────────────
   CHECKLIST
────────────────────────────────────────────────────────────── */
function createChecklist(data) {
  const templates = getRows('Checklist_Templates').filter(t => {
    const active    = String(t.Active || 'TRUE').toUpperCase() !== 'FALSE';
    const matchCase = !data.caseType || String(t['Case Type'] || 'Standard') === String(data.caseType);
    return active && matchCase;
  });
  const today = new Date();
  templates.forEach(t => {
    const due = new Date(today);
    due.setDate(today.getDate() + Number(t['Default Due Offset Days'] || 7));
    addRecord('Tasks', {
      'Task ID':      generateId('T','Tasks'),
      'Created Date': today,
      'Warehouse ID': data.warehouseId,
      'Phase':        t.Phase,
      'Task Name':    t['Task Name'],
      'Assignee':     t['Default Assignee'] || '',
      'Status':       t['Default Status'] || 'To Do',
      'Priority':     t.Priority || 'Medium',
      'Due Date':     due,
      'Last Updated': today,
      'Notes':        t.Notes || ''
    });
  });
  logActivity('CREATE_CHECKLIST', 'Tasks', '', data.warehouseId, data.user || 'System', 'Created checklist: ' + (data.caseType || 'All'));
  return { success: true, count: templates.length };
}

function addChecklistTemplate(data) {
  const template = data.template || {};
  if (!template['Template ID']) template['Template ID'] = generateId('TPL', 'Checklist_Templates');
  if (!template.Active)         template.Active = 'TRUE';
  if (!template['Case Type'])   template['Case Type'] = 'Standard';
  const result = addRecord('Checklist_Templates', template);
  logActivity('ADD_CHECKLIST_TEMPLATE', 'Checklist_Templates', template['Template ID'], '', data.user || 'System', template['Task Name'] || '');
  return result;
}

function updateChecklistTemplate(data) {
  const template = data.template || {};
  const id       = template['Template ID'];
  if (!id) return { success: false, message: 'ไม่พบ Template ID' };
  const sh      = ensureSheet('Checklist_Templates');
  const headers = SHEETS.Checklist_Templates.headers;
  const row     = findRow('Checklist_Templates', 'Template ID', id);
  if (!row) return addChecklistTemplate(data);
  headers.forEach((h, i) => sh.getRange(row, i + 1).setValue(template[h] !== undefined ? template[h] : ''));
  logActivity('UPDATE_CHECKLIST_TEMPLATE', 'Checklist_Templates', id, '', data.user || 'System', template['Task Name'] || '');
  return { success: true, data: template };
}

function deleteChecklistTemplate(data) {
  const id = data.templateId;
  if (!id) return { success: false, message: 'ไม่พบ Template ID' };
  const sh      = ensureSheet('Checklist_Templates');
  const headers = SHEETS.Checklist_Templates.headers;
  const row     = findRow('Checklist_Templates', 'Template ID', id);
  if (!row) return { success: false, message: 'ไม่พบ Template' };
  const values = sh.getRange(row, 1, 1, headers.length).getDisplayValues()[0];
  const snap   = {};
  headers.forEach((h, i) => snap[h] = values[i]);
  ensureSheet('Trash').appendRow([generateId('TR','Trash'), new Date(), 'Checklist_Templates', id, '', data.user || 'System', 'Delete checklist template', JSON.stringify(snap)]);
  sh.deleteRow(row);
  logActivity('DELETE_CHECKLIST_TEMPLATE', 'Checklist_Templates', id, '', data.user || 'System', snap['Task Name'] || '');
  return { success: true };
}

/* ──────────────────────────────────────────────────────────────
   SETTINGS (ใช้ getSettingsHeaderRow1Based เพื่อหา header row จริง)
────────────────────────────────────────────────────────────── */
function addSettingOption(data) {
  const category = String(data.category || '').trim();
  const value    = String(data.value || '').trim();
  if (!category || !value) return { success: false, message: 'category/value ไม่ครบ' };

  const sh         = ensureSheet('Settings');
  const headerRow  = getSettingsHeaderRow1Based(sh); // 1-based row ที่มี headers จริง
  const dataStart  = headerRow + 1;                  // แถวแรกของข้อมูล
  const headers    = sh.getRange(headerRow, 1, 1, Math.max(sh.getLastColumn(), 1)).getDisplayValues()[0].map(h => String(h).trim());

  let col = headers.indexOf(category) + 1;
  if (col < 1) {
    // เพิ่มหมวดใหม่ที่ท้ายของ header row
    col = headers.length + 1;
    sh.getRange(headerRow, col).setValue(category);
  }

  const lastRow = Math.max(sh.getLastRow(), dataStart);
  const rowCount = Math.max(lastRow - headerRow, 1);
  const values  = sh.getRange(dataStart, col, rowCount, 1).getDisplayValues().flat().filter(String);
  if (values.indexOf(value) >= 0) return { success: true, message: 'มีตัวเลือกนี้อยู่แล้ว' };
  sh.getRange(values.length + dataStart, col).setValue(value);
  logActivity('ADD_SETTING_OPTION', 'Settings', category, '', data.user || 'System', value);
  return { success: true, message: 'เพิ่มตัวเลือกแล้ว' };
}

function deleteSettingOption(data) {
  const category = String(data.category || '').trim();
  const value    = String(data.value || '').trim();
  if (!category || !value) return { success: false, message: 'category/value ไม่ครบ' };

  const sh         = ensureSheet('Settings');
  const headerRow  = getSettingsHeaderRow1Based(sh);
  const dataStart  = headerRow + 1;
  const headers    = sh.getRange(headerRow, 1, 1, Math.max(sh.getLastColumn(), 1)).getDisplayValues()[0].map(h => String(h).trim());
  const col        = headers.indexOf(category) + 1;
  if (col < 1) return { success: false, message: 'ไม่พบหมวด: ' + category };

  const lastRow = sh.getLastRow();
  if (lastRow < dataStart) return { success: true };
  const rowCount = lastRow - headerRow;
  const values   = sh.getRange(dataStart, col, rowCount, 1).getDisplayValues().flat();
  for (let i = 0; i < values.length; i++) {
    if (String(values[i]).trim() === value) {
      sh.getRange(i + dataStart, col).clearContent();
      compactSettingsColumn(sh, col, dataStart, lastRow);
      logActivity('DELETE_SETTING_OPTION', 'Settings', category, '', data.user || 'System', value);
      return { success: true };
    }
  }
  return { success: false, message: 'ไม่พบตัวเลือกนี้' };
}

function compactSettingsColumn(sh, col, dataStart, lastRow) {
  const rowCount = Math.max(lastRow - dataStart + 1, 1);
  const values   = sh.getRange(dataStart, col, rowCount, 1).getDisplayValues().flat().filter(String);
  sh.getRange(dataStart, col, rowCount, 1).clearContent();
  if (values.length) sh.getRange(dataStart, col, values.length, 1).setValues(values.map(v => [v]));
}


/* ──────────────────────────────────────────────────────────────
   USERS — เก็บผู้ใช้ลง Google Sheets เพื่อให้ Settings จำค่าแบบออนไลน์
────────────────────────────────────────────────────────────── */
function defaultUsersData() {
  // simpleHash('admin') from the browser code = 92668751
  return [{ username: 'admin', passwordHash: '92668751', role: 'admin' }];
}

function normalizeUsersData(arr) {
  const clean = (Array.isArray(arr) ? arr : [])
    .map(function(u) {
      return {
        username: String(u.username || u.Username || '').trim(),
        passwordHash: String(u.passwordHash || u['Password Hash'] || '').trim(),
        role: String(u.role || u.Role || 'user').trim() || 'user'
      };
    })
    .filter(function(u) { return u.username && u.passwordHash; });

  if (!clean.some(function(u) { return u.username === 'admin'; })) {
    clean.unshift(defaultUsersData()[0]);
  }
  return clean;
}

function getUsersData() {
  ensureSheet('Users');
  let rows = getRows('Users');
  if (!rows || rows.length === 0) {
    saveUsersData({ users: defaultUsersData(), user: 'System' });
    rows = getRows('Users');
  }
  return normalizeUsersData(rows.filter(function(r) {
    return String(r.Active || 'TRUE').toUpperCase() !== 'FALSE';
  }));
}

function saveUsersData(data) {
  const users = normalizeUsersData(data.users || []);
  const sh = ensureSheet('Users');
  const headers = SHEETS.Users.headers;
  const all = sh.getDataRange().getDisplayValues();
  const hi = findHeaderRowIndex('Users', all);
  const headerRow = hi + 1;       // 1-based
  const dataStart = headerRow + 1;
  const lastRow = sh.getLastRow();

  if (lastRow >= dataStart) {
    sh.getRange(dataStart, 1, lastRow - dataStart + 1, headers.length).clearContent();
  }

  const now = new Date();
  const values = users.map(function(u) {
    return [u.username, u.passwordHash, u.role, now, now, 'TRUE'];
  });
  if (values.length) {
    sh.getRange(dataStart, 1, values.length, headers.length).setValues(values);
  }
  logActivity('SAVE_USERS', 'Users', 'ALL', '', data.user || 'System', 'Saved users: ' + users.length);
  return { success: true, users: users };
}

/* ──────────────────────────────────────────────────────────────
   UTILITY
────────────────────────────────────────────────────────────── */
function generateId(prefix, sheetName) {
  return prefix + '-' + Utilities.formatString('%04d', Math.floor(Math.random() * 9000) + 1000);
}

function prefixFor(sheetName) {
  return { Warehouses:'WH', Documents:'DOC', Calendar:'EV', Issues:'ISS', Trash:'TR' }[sheetName] || 'ID';
}

function logActivity(action, sheet, recordId, warehouseId, user, details) {
  ensureSheet('Activity_Log').appendRow([
    generateId('LOG','Activity_Log'), new Date(), action, sheet, recordId, warehouseId, user, details
  ]);
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
