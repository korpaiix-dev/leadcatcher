# LeadCatcher — Phase 0 Spike

Proof-of-concept ก่อนสร้าง full Electron app — ทดสอบ 3 สมมุติฐานหลัก:

1. Playwright login Facebook ได้และ save session ข้ามรอบเปิดได้
2. เข้ากลุ่มที่เป็นสมาชิกแล้ว scroll หาโพสต์ที่ match keyword ได้
3. ค้นกลุ่มใหม่ + auto-join ได้ในขอบเขตที่ปลอดภัย

ถ้า 3 ข้อนี้ผ่านหมด → ลงทุนทำ Phase 1 MVP

---

## Setup

```bash
npm install
npx playwright install chromium

# คัดลอก config แล้วแก้ตามต้องการ
cp config.example.json config.json
```

แก้ `config.json`:
- `groups` — ใส่ URL กลุ่ม Facebook ที่คุณเป็นสมาชิกอยู่
- `keywords` — keyword ที่ต้องการ track

---

## วิธีใช้

### 1. Login (ทำครั้งเดียวต่อ session)

```bash
npm run login
```

Chromium จะเปิดขึ้น → login Facebook ในหน้าต่างนั้น → ระบบ detect login สำเร็จเอง → session ถูก save ไว้ใน `data/session/`

### 2. Scan กลุ่มที่ตั้งไว้ใน config

```bash
npm run scan
```

ระบบจะวนทุกกลุ่มใน `config.json`, scroll หาโพสต์ที่ match keyword, แล้วบันทึกผลที่ `data/results/scan-<timestamp>.json`

### 3. ค้นหากลุ่มใหม่จาก keyword

```bash
npm run search -- "งานแต่งงาน"
```

ระบบไปที่หน้า Facebook Groups Search, ดึงรายชื่อกลุ่ม + จำนวนสมาชิก, บันทึกที่ `data/results/search-<query>-<ts>.json`

### 4. Auto-join กลุ่ม

```bash
npm run join -- "https://www.facebook.com/groups/123456"
```

โหมดอ่านจาก `config.json` → `join.mode`:
- `safe` (default) — delay 30-90 วินาที, ให้ user ตอบ membership question เอง
- `normal` — delay 5-15 วินาที
- `aggressive` — delay 2-5 วินาที (เสี่ยงสูง — อย่าใช้ใน 7 วันแรกของ account)

---

## โครงสร้าง project

```
leadcatcher-spike/
├── src/
│   ├── lib/
│   │   ├── browser.ts       # Playwright context + persistent session
│   │   ├── human.ts         # Random delay, human-like scroll
│   │   ├── selectors.ts     # FB selectors (centralized)
│   │   ├── session.ts       # Config loader + result saver
│   │   └── logger.ts        # CLI logger
│   ├── types.ts             # TypeScript interfaces
│   ├── login.ts             # script 1
│   ├── scan-group.ts        # script 2
│   ├── search-groups.ts     # script 3
│   └── join-group.ts        # script 4
├── data/                    # gitignored — session + results
├── config.json              # gitignored — ของจริง
├── config.example.json      # template
└── package.json
```

---

## ⚠️ คำเตือน

- **ใช้ FB account สำรอง** ไม่ใช่ account หลัก
- **อย่ารัน aggressive mode ใน 7 วันแรก** ของ account ใหม่
- ทุก action มี random delay 3-15 วินาที — อย่าไปลด
- ถ้า FB ขึ้น CAPTCHA → หยุดใช้ทันที 24 ชั่วโมง
- ใช้กับกลุ่มที่ตัวเองเป็นสมาชิกเท่านั้น

## Limitations ของ Phase 0

- CLI only — ยังไม่มี UI
- ยังไม่มี scheduler
- Selectors hardcoded — เมื่อ FB เปลี่ยน DOM ต้อง update `src/lib/selectors.ts`
- ยังไม่ auto-fill membership question
- ยังไม่ screenshot โพสต์
