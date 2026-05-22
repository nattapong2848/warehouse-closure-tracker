# SPX Warehouse Closure V3.4.1 Fixed UI

ชุดนี้แก้ปัญหาหน้าเว็บแตก / ปุ่มเป็น default browser / layout ไม่ขึ้น

## ใช้กับ Spreadsheet ID
`1gNnjKeqxaE6TtCOOXOqnaG_E0v5dQtUmE_KfLgoo6hI`

## วิธีอัปเดต
1. อัปโหลด `index.html`, `style.css`, `script.js`, `README.md` ไปทับไฟล์เดิมใน GitHub
2. นำ `apps-script.gs` ไปวางทับใน Google Apps Script
3. Deploy > Manage deployments > Edit > New version > Deploy
4. เปิดเว็บแล้วกด Command + Shift + R
5. ไปหน้า ตั้งค่า ใส่ Apps Script URL ที่ลงท้าย `/exec`

## สาเหตุที่หน้าเดิมแตก
โดยมากเกิดจาก CSS/JS ไม่ตรงกับ HTML หรือไฟล์ style.css ไม่ได้ถูกอัปเดตทับครบ ทำให้ปุ่ม navigation กลายเป็นปุ่ม default


## V3.4.2 Documents by Warehouse
- ปรับหน้าเอกสารเป็นศูนย์เอกสารรายคลัง
- แสดงเอกสารแยกตาม Warehouse ID
- แยกกลุ่มย่อยตามประเภทเอกสาร
- เพิ่ม filter คลัง / ประเภทเอกสาร / ค้นหา
- กดเพิ่มเอกสารเข้าคลังนั้นได้ทันที


## V3.4.3 Editable Settings Manager
- หน้า Settings เพิ่ม/ลบค่าจาก Google Sheet ได้
- รองรับหมวด Task Status, Priority, Warehouse Status, Phase, Document Type, Document Status, Event Type, Calendar Status
- ค่าที่เพิ่ม/ลบจะถูกใช้เป็น dropdown บนเว็บหลัง Sync/Refresh
- ต้องอัปเดต apps-script.gs และ Deploy New version เพราะมี action ใหม่: addSettingOption, deleteSettingOption


## V3.4.4 Editable Checklist Builder
- หน้า Checklist เพิ่ม/แก้ไข/ลบ Template ได้จากหน้าเว็บ
- รองรับ Case Type เช่น Standard, Urgent, Small Site, Large Warehouse, Custom
- สร้าง Checklist ให้แต่ละคลังได้ตาม Case Type
- Template ถูกบันทึกใน Sheet `Checklist_Templates`
- การลบ Template เข้า `Trash` และบันทึก `Activity_Log`
- ต้องอัปเดต apps-script.gs และ Deploy New version


## V3.4.5 Stable Settings + Checklist
- แก้ปัญหา Settings dropdown ไม่ขึ้น/ว่าง
- ปรับ normalizeSettings ให้รองรับข้อมูลจาก Apps Script หลายรูปแบบ
- หน้า Checklist ใช้ fallback dropdown ได้ แม้ Sheet Settings โหลดไม่ครบ
- เพิ่มความเสถียรของ Checklist Template: Case Type, Active, Due Offset, Document Required
- Apps Script ปรับ ensureSheet ให้เติม header ที่ขาดโดยไม่ทำลายข้อมูลเดิม
- อัปเดต Sheet Settings และ Checklist_Templates เริ่มต้นให้แล้ว


## V3.4.6 Data Render Fix
แก้ปัญหาเชื่อมต่อสำเร็จแต่หน้าเว็บไม่มีข้อมูล

สาเหตุหลักที่เจอ:
- `renderAll()` เรียก `renderDropdowns()` แต่ไฟล์ script.js เวอร์ชันก่อนหน้าขาดฟังก์ชันนี้ ทำให้ JavaScript error และหยุด render ข้อมูลทั้งหน้า
- วันที่จาก Google Sheet เป็นรูปแบบ `22/5/2026, 12:51:48` ทำให้ JS บาง browser parse ไม่ได้ จึงกระทบงานที่ต้องตาม/ปฏิทิน
- เพิ่ม fallback และ try/catch ให้แต่ละ section render แยกกัน ไม่ให้จุดเดียวพังแล้วทั้งเว็บว่าง

วิธีอัปเดต:
1. อัปโหลด `index.html`, `style.css`, `script.js`, `README.md` ไปทับใน GitHub
2. อัปเดต `apps-script.gs` ใน Apps Script แล้ว Deploy New version
3. เปิดเว็บ กด `Command + Shift + R`
4. ไปที่ Settings ตรวจว่า Spreadsheet ID และ Apps Script URL /exec ถูกต้อง
