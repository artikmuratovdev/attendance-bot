# 📋 Student Attendance Bot

Telegram bot orqali talabalar davomatini boshqarish tizimi.  
O'qituvchi sessiya ochadi → Kod ekranda ko'rinadi → Talabalar kodni botga yuboradi → Davomat belgilanadi!

---

## ⚡ Qanday ishlaydi?

```
O'qituvchi           Bot              Talaba
    │                 │                  │
    ├─/start_session──►│                  │
    │◄── Kod: A7K9BQ ─┤                  │
    │  (ekranda ko'rs.)│                  │
    │                 │◄── "A7K9BQ" ─────┤
    │                 ├──── ✅ Belgilandi ►│
    │◄── 🔔 1 nafar ──┤                  │
    │  [30 soniyada]  │                  │
    │◄── Kod: X2MN7P ─┤                  │
    │                 │                  │
```

**Kod har 30 soniyada avtomatik yangilanadi** — eski kod ishlamaydi!

---

## 🚀 O'rnatish

### 1. Loyihani yuklab oling

```bash
git clone <repo>
cd attendance-bot
npm install
```

### 2. .env faylini sozlang

```bash
cp .env.example .env
```

`.env` faylini oching va to'ldiring:

```env
BOT_TOKEN=your_bot_token_here
MONGODB_URI=mongodb://localhost:27017/attendance_bot
TEACHER_IDS=123456789,987654321
CODE_INTERVAL_SECONDS=30
CODE_LENGTH=6
```

#### BOT_TOKEN olish:
1. Telegramda [@BotFather](https://t.me/BotFather) ga yozing
2. `/newbot` yuboring
3. Bot nomi va username bering
4. Token nusxa oling → `.env` ga joylashtiring

#### TEACHER_IDS olish:
1. [@userinfobot](https://t.me/userinfobot) ga `/start` yuboring
2. U sizning Telegram ID ingizni ko'rsatadi
3. Shu raqamni `TEACHER_IDS=` ga yozing

### 3. MongoDB

**Local:**
```bash
# MongoDB o'rnatilgan bo'lsa:
mongod --dbpath /data/db
```

**MongoDB Atlas (bepul cloud):**
1. [mongodb.com/atlas](https://www.mongodb.com/atlas) ga kiring
2. Bepul cluster yarating
3. Connection string ni `.env` ga qo'ying:
```env
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/attendance_bot
```

### 4. Ishga tushirish

```bash
# Production
npm start

# Development (auto-restart)
npm run dev
```

---

## 📱 Foydalanish

### O'qituvchi uchun:

| Buyruq | Vazifa |
|--------|--------|
| `/start_session` | Yangi dars sessiyasi boshlash |
| `/current_code` | Joriy kodni ko'rsatish |
| `/attendance` | Kim kelganini ko'rish |
| `/end_session` | Sessiyani yakunlash |
| `/sessions` | O'tgan sessiyalar tarixi |

### Talaba uchun:

| Buyruq / Harakat | Vazifa |
|--------|--------|
| `/start` | Ro'yxatdan o'tish |
| Kodni yuborish | Davomat belgilash |
| `/my_attendance` | O'z davomat tarixini ko'rish |

---

## 📁 Loyiha strukturasi

```
attendance-bot/
├── src/
│   ├── index.js              # Asosiy bot fayli
│   ├── models/
│   │   ├── Student.js        # Talaba modeli
│   │   └── Session.js        # Sessiya modeli
│   ├── handlers/
│   │   ├── teacherHandlers.js  # O'qituvchi handlerlari
│   │   └── studentHandlers.js  # Talaba handlerlari
│   └── utils/
│       ├── helpers.js         # Yordamchi funksiyalar
│       └── codeRotation.js    # Kod rotatsiyasi
├── config/
│   └── database.js            # MongoDB ulanish
├── .env.example               # .env namunasi
├── package.json
└── README.md
```

---

## 🔧 Konfiguratsiya

| O'zgaruvchi | Default | Izoh |
|-------------|---------|------|
| `BOT_TOKEN` | — | BotFather dan olingan token |
| `MONGODB_URI` | — | MongoDB ulanish manzili |
| `TEACHER_IDS` | — | Vergul bilan ajratilgan Telegram ID lar |
| `CODE_INTERVAL_SECONDS` | `30` | Kod yangilanish vaqti (soniyada) |
| `CODE_LENGTH` | `6` | Kod uzunligi (belgilar soni) |

---

## 🚀 Server Deploy (PM2 bilan)

```bash
npm install -g pm2
pm2 start src/index.js --name "attendance-bot"
pm2 save
pm2 startup
```

---

## 🔒 Xavfsizlik

- Kod faqat **harflar (O va I siz)** va **raqamlar (0 va 1 siz)** dan iborat — o'qishda chalkashlik yo'q
- Har bir talaba sessiyaga **faqat bir marta** qatnasha oladi
- Eski kod yangi generatsiyadan so'ng darhol **ishlamay qoladi**
