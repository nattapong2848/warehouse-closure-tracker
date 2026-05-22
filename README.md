# SPX Closure Simple App

เวอร์ชันนี้ตัดฟังก์ชันให้เหลือเฉพาะที่จำเป็นและเสถียรกว่าเดิม

## Google Sheet
ชื่อไฟล์: SPX Closure Simple Database  
Spreadsheet ID: `1diGx-RqNg1Kfb8u8YBfBNvem3lA-duLUT8iHoX9DDxQ`

## Tabs
- Warehouses
- Tasks
- Documents
- Calendar
- Settings
- Activity_Log

## วิธีใช้
1. อัปโหลด `index.html`, `style.css`, `script.js`, `README.md` ขึ้น GitHub Pages
2. เปิด Google Sheet > Extensions > Apps Script
3. วาง `apps-script.gs`
4. Deploy > New deployment > Web app
5. Execute as: Me
6. Who has access: Anyone
7. Copy URL ที่ลงท้าย `/exec`
8. เปิดเว็บ > Settings > ใส่ Spreadsheet ID + Apps Script URL
9. กดทดสอบ API และ Refresh

## ฟังก์ชันที่มี
- Dashboard
- เพิ่ม/ลบคลัง
- เพิ่ม/ลบงาน
- แก้สถานะงาน
- เพิ่ม/ลบเอกสารแยกตามคลัง
- เพิ่ม/ลบ Settings dropdown

## เพิ่มในเวอร์ชัน Calendar
- มีแท็บ Calendar
- เพิ่มแผนงาน/วันที่ต้องตามได้
- แสดงปฏิทินรายเดือนบนเว็บ
- งานที่มี Due Date ใน Tasks จะขึ้นบนปฏิทินด้วย
