# ระบบติดตามงานปิดคลัง — SPX Express Theme

เว็บ UI สำหรับบันทึกและติดตามงานปิดคลังสินค้า ใช้โฮสต์บน GitHub Pages และเชื่อม Google Sheet ผ่าน Google Apps Script

## ไฟล์ที่เชื่อมไว้
Google Sheet หลัก: `ระบบติดตามงานปิดคลัง_Agile`  
Spreadsheet ID: `1sV6GP5swsuPnB8biAl7WfadzK7ISVKizYXCsIq4fsSA`

## วิธีลง GitHub Pages
1. สร้าง Repository ใหม่ใน GitHub เช่น `spx-warehouse-closure`
2. Upload ไฟล์ทั้งหมดในโฟลเดอร์นี้ขึ้น repo
3. ไปที่ Settings > Pages
4. Source เลือก `Deploy from a branch`
5. Branch เลือก `main` และ `/root`
6. กด Save แล้วรอ URL เว็บ

## วิธีเชื่อม Google Sheet
1. เปิด Google Sheet `ระบบติดตามงานปิดคลัง_Agile`
2. ไปที่ Extensions > Apps Script
3. วางโค้ดจากไฟล์ `apps-script.gs`
4. กด Deploy > New deployment > Web app
5. ตั้งค่า:
   - Execute as: Me
   - Who has access: Anyone with the link
6. Copy Web app URL ที่ลงท้ายด้วย `/exec`
7. เปิดเว็บ > เมนู `เชื่อมต่อ Sheet` > วาง URL > บันทึก
8. Refresh เว็บ

## หมายเหตุ
- ถ้ายังไม่ใส่ Apps Script URL เว็บจะทำงานเป็น Local Preview โดยเก็บข้อมูลใน browser
- เมื่อตั้งค่า Apps Script แล้ว ข้อมูลจะถูกส่งเข้า Google Sheet จริง
- สามารถปรับชื่อแท็บ Sheet ได้ในตัวแปร `DEFAULT_TAB_NAME` ของ `apps-script.gs`
