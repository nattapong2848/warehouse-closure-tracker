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
