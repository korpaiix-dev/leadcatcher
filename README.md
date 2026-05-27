# LeadCatcher — Phase 0 Spike

Proof-of-concept ก่อนสร้าง full Electron app — ทดสอบ 3 สมมุติฐานหลัก:

1. Playwright login Facebook ได้และ save session ข้ามรอบเปิดได้
2. เข้ากลุ่มที่เป็นสมาชิกแล้ว scroll หาโพสต์ที่ match keyword ได้
3. ค้นกลุ่มใหม่ + auto-join ได้ในขอบเขตที่ปลอดภัย

ถ้า 3 ข้อนี้ผ่านหมด → ลงทุนทำ Phase 1 MVP

---

## Setup

### ครั้งแรก (one-time setup)

โปรเจ็คนี้สร้างจาก sandbox ที่ลบไฟล์บน Windows mount ไม่ได้ ทำให้มี `.git.broken*` กับ `.git_seed` ค้างอยู่ — รัน setup script ก่อนหนึ่งครั้งเพื่อจัดเรียบ:

**Windows:**
```cmd
setup.bat
```

**macOS / Linux:**
```bash
bash setup.sh
```

Script จะ:
- ลบโฟลเดอร์ `.git.broken*` ที่ค้างอยู่
- เปลี่ยน `.git_seed` → `.git` (เก็บ commit history ที่ Claude ทำให้)
- ถ้า seed ไม่อยู่ ก็ git init ใหม่และ commit แรก

### Dependencies

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

- **ใช้ FB account สำรอง** ไม่