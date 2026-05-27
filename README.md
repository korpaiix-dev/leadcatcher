# LeadCatcher

เครื่องมือช่วย SME หา Lead จาก Facebook Groups — สแกนโพสต์ตาม keyword ที่ตั้งไว้ในกลุ่มที่เลือก เพื่อให้เข้าไปคอมเมนต์/inbox ได้เร็วกว่าคู่แข่ง

มี **dashboard เว็บ local** ที่ทำงานบนเครื่องคุณเอง — ไม่ส่งข้อมูลออกนอก ไม่ต้องสมัครบริการ

---

## ก่อนเริ่ม — สิ่งที่ต้องติดตั้งก่อน (one-time)

ติดตั้ง 2 อย่างนี้บน Windows ก่อน:

1. **Node.js LTS** → [nodejs.org](https://nodejs.org/) (กด Download LTS แล้วติดตั้งแบบ Next-Next-Next)
2. **Git for Windows** → [git-scm.com/downloads/win](https://git-scm.com/downloads/win)

ทดสอบใน CMD ว่าใช้ได้:
```cmd
node --version
git --version
```
ถ้าทั้งคู่แสดงเวอร์ชั่น = พร้อม

---

## วิธีติดตั้งโปรเจ็ค

```cmd
git clone <repo URL ที่เพื่อนส่งให้>
cd leadcatcher
setup.bat
```

`setup.bat` จะ:
- ลง dependencies (npm + Playwright + Chromium ~130MB) — รอบแรกใช้ 1-3 นาที
- สร้าง `config.json` ให้ (จาก template)
- **เปิด Dashboard อัตโนมัติ** ที่ `http://localhost:3737`

หลังจากนั้นทุกครั้งที่เปิด — แค่ดับเบิ้ลคลิก `launch.bat` อย่างเดียว

---

## วิธีใช้ Dashboard

ที่หน้า dashboard มี **Setup Checklist** ติ๊กให้ครบ 4 ข้อ:

### 1. Login Facebook
- กดปุ่ม **Login Facebook** ที่หน้า Overview
- Chromium เปิดขึ้น → login ในนั้น (ใช้ **account สำรอง** ดีกว่า account หลัก)
- Login เสร็จ ระบบ detect เอง — ปิด Chromium ได้

### 2. เลือกกลุ่ม
ไป tab **Groups** มี 3 ทาง:
- **กลุ่มที่ฉันเข้าอยู่** — กด "โหลดกลุ่มของฉัน" → เลือกหลายกลุ่ม → กด "+ เพิ่มที่เลือก"
- **ค้นหากลุ่มใหม่** — พิมพ์ keyword หากลุ่มใหม่ → เลือก → กด "Join + Add ที่เลือก" (ระบบ join ให้)
- **วาง URL เอง** — paste link กลุ่มใส่ตรงๆ

### 3. ใส่ Keyword
ไป tab **Keywords** → พิมพ์คำที่อยากตามหา → กด Enter ทีละคำ

### 4. Scan
กลับ Overview → กด **▶ Scan Groups** สีเขียว → รอผล (Chromium จะ scroll เอง)

ผลลัพธ์ออกที่ tab **Lead Posts** — มีปุ่ม "เปิดใน Facebook" + ปุ่ม "ติดต่อแล้ว / ปิดดีล / ไม่สนใจ"

---

## ⚠️ คำเตือนสำคัญ

- **ใช้ FB account สำรอง** ไม่ใช่ account หลัก
- **อย่ารัน aggressive mode** ใน 7 วันแรกของ account ใหม่
- ทุก action มี random delay 3-15 วินาที — **อย่าลด**
- ถ้า FB ขึ้น **CAPTCHA** → หยุดใช้ทันที 24 ชั่วโมง
- ระบบ **ไม่ comment แทน** — เตรียมโพสต์ + ลิงก์ให้คุณไปคอมเมนต์เอง

---

## CLI (ทางเลือก ไม่ต้องใช้ dashboard)

```cmd
npm run login                 :: login FB ครั้งเดียว
npm run mygroups              :: ดึงรายชื่อกลุ่มที่เข้าอยู่
npm run search -- "งานแต่ง"   :: ค้นกลุ่มใหม่
npm run join -- "<url>"       :: ขอเข้ากลุ่ม
npm run scan                  :: สแกนตาม config
npm run dashboard             :: เปิด dashboard
```

---

## License & Disclaimer

ใช้งานบนความรับผิดชอบของผู้ใช้เอง — โปรเจ็คนี้ไม่ใช่ official Facebook tool การใช้ Playwright อัตโนมัติบน Facebook อาจขัด ToS ใช้กับ account สำรองและในขอบเขตที่สมเหตุสมผลเสมอ
