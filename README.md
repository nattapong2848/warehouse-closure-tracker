# ระบบปิดคลังสินค้า SPX V3 Web Package

ใช้กับ Google Sheet Clean Database:

Spreadsheet ID:
1gNnjKeqxaE6TtCOOXOqnaG_E0v5dQtUmE_KfLgoo6hI

Google Sheet:
https://docs.google.com/spreadsheets/d/1gNnjKeqxaE6TtCOOXOqnaG_E0v5dQtUmE_KfLgoo6hI/edit

## ไฟล์
- index.html
- style.css
- script.js
- apps-script.gs
- README.md

## วิธีใช้
1. อัปโหลด index.html, style.css, script.js, README.md ขึ้น GitHub repository
2. เปิด GitHub Pages ที่ Settings > Pages > Deploy from branch > main / root
3. เปิด Google Sheet > Extensions > Apps Script
4. วางโค้ดจาก apps-script.gs
5. Deploy > New deployment > Web app
6. ตั้งค่า Execute as: Me และ Who has access: Anyone
7. Copy URL ที่ลงท้าย /exec
8. เปิดเว็บ GitHub Pages > เมนูตั้งค่า > ใส่ Spreadsheet ID และ Apps Script URL
9. กดทดสอบ API

## โครงสร้างฐานข้อมูล
- Warehouses
- Tasks
- Documents
- Calendar
- Activity_Log
- Settings

หมายเหตุ: เอกสารใช้การวางลิงก์ Google Drive ก่อน ยังไม่อัปโหลดไฟล์จริงจากหน้าเว็บ

## Ultra UI Version

แพ็กนี้เป็นเวอร์ชันกราฟิกจัดเต็มของ SPX Warehouse Closure V3 เพิ่ม:

- Animated aurora background
- Floating particle effect
- SPX route mini-map บน sidebar
- Hero command center panel
- Radar progress animation
- KPI cards แบบ glow/animated
- Glassmorphism cards
- Animated status bars
- Responsive layout สำหรับ desktop และมือถือ

การติดตั้งเหมือนเดิม:
1. อัปโหลด `index.html`, `style.css`, `script.js`, `README.md` ขึ้น GitHub Pages
2. วาง `apps-script.gs` ใน Google Apps Script
3. Deploy เป็น Web App แล้วใช้ URL ที่ลงท้าย `/exec`
4. ใส่ Spreadsheet ID: `1gNnjKeqxaE6TtCOOXOqnaG_E0v5dQtUmE_KfLgoo6hI`
