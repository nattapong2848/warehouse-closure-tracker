# SPX Warehouse Closure V3.4 Legendary Control Tower

เว็บระบบปิดคลังสินค้าแบบจัดเต็มสำหรับ GitHub Pages + Google Apps Script + Google Sheet

## ใช้กับ Google Sheet

Spreadsheet ID:

```text
1gNnjKeqxaE6TtCOOXOqnaG_E0v5dQtUmE_KfLgoo6hI
```

ไฟล์ฐานข้อมูล: `ระบบปิดคลังสินค้า SPX V3 - Clean Database`

เวอร์ชันนี้รองรับเพิ่ม:
- Warehouse Status Dashboard ช่องละคลัง
- Warehouse Profile Hub แบบเลือกคลังเป็นการ์ด
- งานค้าง / งานเลยกำหนด / Issue ของแต่ละคลัง
- เอกสารแยกตามคลังและประเภทเอกสาร
- ปฏิทินรายเดือน กดวันที่ดูงานได้
- Risk & Issue Tracker
- Checklist Template ปิดคลังอัตโนมัติ
- รายงานอัตโนมัติสำหรับส่ง LINE/Email
- Soft Delete + Trash
- Activity Log ทุก action
- Ultra UI เอฟเฟกต์ Control Tower

## ไฟล์ในแพ็ก

```text
index.html
style.css
script.js
apps-script.gs
README.md
```

## วิธีติดตั้งบน GitHub Pages

1. แตกไฟล์ zip
2. อัปโหลด `index.html`, `style.css`, `script.js`, `README.md` เข้า GitHub repository
3. ไปที่ Settings > Pages
4. เลือก Deploy from branch: `main` และ `/root`
5. รอจนได้ URL ของ GitHub Pages

## วิธีติดตั้ง Apps Script

1. เปิด Google Sheet
2. Extensions > Apps Script
3. ลบโค้ดเดิมใน `Code.gs`
4. วางโค้ดจาก `apps-script.gs`
5. Save
6. Deploy > New deployment > Web app
7. ตั้งค่า:
   - Execute as: Me
   - Who has access: Anyone
8. กด Deploy
9. Copy Web App URL ที่ลงท้าย `/exec`

## วิธีเชื่อมเว็บ

1. เปิดหน้าเว็บ
2. ไปเมนู `ตั้งค่า`
3. ใส่ Spreadsheet ID:
   `1gNnjKeqxaE6TtCOOXOqnaG_E0v5dQtUmE_KfLgoo6hI`
4. ใส่ Apps Script URL ที่ลงท้าย `/exec`
5. กดบันทึกการเชื่อมต่อ
6. กดทดสอบ API

## หมายเหตุสำคัญ

- ถ้าแก้ `apps-script.gs` ต้อง Deploy > Manage deployments > Edit > New version > Deploy ทุกครั้ง
- การแนบเอกสารใช้วิธีวาง Google Drive link ก่อน เพื่อความเสถียรบน GitHub Pages
- ถ้าขึ้น Demo Mode แปลว่ายังไม่ได้ใส่ Apps Script URL หรือ API ยังไม่ผ่าน
