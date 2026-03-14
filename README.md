# 🎓 SSMLS — Smart School Management & Learning System

A full-stack web application for Senior High School management built as a capstone project.

---

## 🏗 Tech Stack

| Layer      | Technology                                   |
|------------|----------------------------------------------|
| Frontend   | React 18 + Vite + Tailwind CSS + React Query |
| Backend    | Node.js + Express.js                         |
| Database   | MySQL 8+                                     |
| Auth       | JWT (jsonwebtoken) + bcryptjs                |
| QR Codes   | `qrcode` npm package (server-side generator) |
| QR Scanner | `html5-qrcode` (browser camera)              |
| Hosting    | Vercel (frontend + backend) + PlanetScale/Railway (MySQL) |

---

## 📁 Project Structure

```
ssmls-fullstack/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.js       ← MySQL pool connection
│   │   │   ├── migrate.js        ← Creates all 15 tables
│   │   │   └── seed.js           ← Demo users & data
│   │   ├── controllers/
│   │   │   ├── auth.controller.js
│   │   │   ├── attendance.controller.js  ← QR generate + scan
│   │   │   ├── schedule.controller.js    ← Conflict detection
│   │   │   ├── student.controller.js
│   │   │   └── main.controller.js        ← Dashboard, grades, etc.
│   │   ├── middleware/
│   │   │   └── auth.middleware.js  ← JWT verify + RBAC
│   │   ├── routes/               ← One file per resource
│   │   ├── utils/
│   │   │   └── audit.js          ← Activity logger
│   │   ├── app.js                ← Express setup
│   │   └── server.js             ← Entry point
│   ├── .env.example
│   ├── package.json
│   └── vercel.json
├── frontend/
│   ├── src/
│   │   ├── api/client.js         ← Axios instance + interceptors
│   │   ├── context/AuthContext.jsx
│   │   ├── components/layout/AppLayout.jsx
│   │   ├── pages/
│   │   │   ├── auth/LoginPage.jsx
│   │   │   ├── DashboardPage.jsx       ← Role-aware dashboard
│   │   │   ├── AttendancePage.jsx      ← QR generator + live log
│   │   │   ├── SchedulesPage.jsx       ← Weekly view + conflict UI
│   │   │   ├── AssignmentsPage.jsx
│   │   │   ├── GradesPage.jsx
│   │   │   ├── MaterialsPage.jsx
│   │   │   ├── AnnouncementsPage.jsx
│   │   │   ├── student/QRScannerPage.jsx  ← Camera QR scanner
│   │   │   └── admin/
│   │   │       ├── StudentsPage.jsx
│   │   │       ├── TeachersPage.jsx
│   │   │       ├── SectionsPage.jsx
│   │   │       └── AuditLogsPage.jsx
│   │   ├── App.jsx               ← Routes + role guards
│   │   └── main.jsx
│   ├── vercel.json
│   └── package.json
└── README.md
```

---

## ⚡ Local Development Setup

### Prerequisites
- Node.js 18+
- MySQL 8+ running locally
- Git

### Step 1 — Clone & Install

```bash
git clone https://github.com/YOUR_USERNAME/ssmls.git
cd ssmls
npm install          # installs concurrently at root
cd backend && npm install
cd ../frontend && npm install
cd ..
```

### Step 2 — Configure Backend Environment

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env`:
```env
PORT=5000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=ssmls_db

JWT_SECRET=your_very_long_random_secret_key_here
JWT_EXPIRES_IN=7d

QR_SECRET=another_secret_key_for_qr_tokens

FRONTEND_URL=http://localhost:5173
```

### Step 3 — Configure Frontend Environment

```bash
cd frontend
cp .env.example .env
```

Edit `frontend/.env`:
```env
VITE_API_URL=http://localhost:5000/api
```

### Step 4 — Run Database Migrations

```bash
cd backend
npm run migrate
```

Expected output:
```
✅ Table "roles" ready
✅ Table "users" ready
...
✅ Table "audit_logs" ready
🎉 All migrations completed successfully!
```

### Step 5 — Seed Demo Data

```bash
npm run seed
```

This creates:
- Admin: `admin@ssmls.edu.ph` / `Admin@2026`
- Teachers (3): password `Teacher@2026`
- Students (7): password `Student@2026`
- Sample sections, subjects

### Step 6 — Run Both Servers

```bash
cd ..   # back to root
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:5000/api
- Health check: http://localhost:5000/api/health

---

## 🚀 Deploying to Vercel

### Database — Use PlanetScale (Free MySQL-compatible)

1. Go to https://planetscale.com → Create free account
2. Create new database → name it `ssmls_db`
3. Click **Connect** → Choose **Node.js** → Copy the connection string
4. Note down: `host`, `username`, `password`

> **Alternative:** Railway.app also offers free MySQL.

---

### Backend Deployment

1. Push your code to GitHub

2. Go to https://vercel.com → **Add New Project**

3. Import your repo → Select the **`backend`** folder as root directory

4. Add Environment Variables in Vercel dashboard:
   ```
   DB_HOST=your_planetscale_host
   DB_PORT=3306
   DB_USER=your_planetscale_user
   DB_PASSWORD=your_planetscale_password
   DB_NAME=ssmls_db
   JWT_SECRET=your_production_jwt_secret
   QR_SECRET=your_production_qr_secret
   FRONTEND_URL=https://your-frontend.vercel.app
   NODE_ENV=production
   ```

5. Deploy → Note your backend URL (e.g. `https://ssmls-api.vercel.app`)

6. Run migrations on production:
   - Temporarily set env vars locally pointing to PlanetScale
   - Run `npm run migrate` and `npm run seed`

---

### Frontend Deployment

1. Go to Vercel → **Add New Project** again

2. Import same repo → Select **`frontend`** folder as root directory

3. Add Environment Variables:
   ```
   VITE_API_URL=https://ssmls-api.vercel.app/api
   ```

4. Deploy → Your app is live!

---

## 👥 User Roles & Demo Credentials

| Role    | Email                              | Password      |
|---------|------------------------------------|---------------|
| Admin   | admin@ssmls.edu.ph                 | Admin@2026    |
| Teacher | mlcruz@ssmls.edu.ph                | Teacher@2026  |
| Teacher | jdelavega@ssmls.edu.ph             | Teacher@2026  |
| Student | juan.dela@student.ssmls.edu.ph     | Student@2026  |

---

## 🔐 Security Features Implemented

| Layer | Feature |
|-------|---------|
| Auth | bcryptjs password hashing (cost 12) |
| Auth | JWT with 7-day expiry |
| Auth | Rate limiter: 5 attempts / 10 min lockout |
| Auth | Token validation on every request |
| RBAC | Role-based route guards (admin/teacher/student) |
| QR | SHA-256 HMAC token, 60-second expiry |
| QR | One-scan-per-student enforcement |
| QR | Late detection (>15 min after class start) |
| API | Helmet.js security headers |
| API | CORS restricted to frontend URL |
| API | Global rate limit: 100 req/15 min |
| Data | All user actions logged to audit_logs |
| DB | Parameterized queries (SQL injection prevention) |

---

## 📊 API Endpoints Reference

### Auth
```
POST   /api/auth/login
GET    /api/auth/me
PUT    /api/auth/change-password
```

### Attendance (QR System)
```
POST   /api/attendance/generate-qr    ← Teacher: generate QR
POST   /api/attendance/scan           ← Student: scan QR
GET    /api/attendance/class/:classId ← Live attendance log
GET    /api/attendance/student/:id    ← Student history
PATCH  /api/attendance/close/:classId ← End session
```

### Schedules
```
POST   /api/schedules                 ← Create (with conflict check)
GET    /api/schedules/teacher/:id
GET    /api/schedules/section/:id
GET    /api/schedules/pending         ← Admin approval queue
PATCH  /api/schedules/:id/approve
DELETE /api/schedules/:id
```

### Students / Teachers / Sections
```
GET/POST         /api/students
GET/PUT/DELETE   /api/students/:id
GET/POST         /api/teachers
GET/POST         /api/sections
```

### Learning
```
GET/POST   /api/assignments
POST       /api/assignments/submit
PATCH      /api/assignments/submissions/:id/grade
GET/POST   /api/grades
GET/POST   /api/materials
GET/POST   /api/announcements
```

### Admin
```
GET   /api/admin/stats
GET   /api/admin/audit-logs
GET   /api/dashboard
```

---

## 🧩 Key Feature: Dynamic QR Attendance

The QR code system works as follows:

1. **Teacher** clicks "Generate QR" → backend creates `SHA256(classId|timestamp|secret)` token
2. QR image is generated server-side using the `qrcode` package and returned as base64 PNG
3. Frontend auto-refreshes QR every 60 seconds by calling the API again
4. **Student** opens QR Scanner page → `html5-qrcode` library accesses device camera
5. On scan → token sent to `POST /api/attendance/scan`
6. Backend validates: token not expired, student enrolled, no duplicate scan
7. If >15 min after class start → marked **Late**, otherwise **Present**

---

## 🛠 Troubleshooting

| Problem | Solution |
|---------|----------|
| DB connection fails | Check `DB_HOST`, `DB_PASSWORD` in `.env` |
| QR camera not working | Must use HTTPS in production (Vercel handles this) |
| CORS error | Set `FRONTEND_URL` in backend `.env` to match your frontend URL exactly |
| Migration fails | Make sure MySQL is running and credentials are correct |
| JWT errors | Ensure `JWT_SECRET` is the same in both dev and production |

---

## 📝 Capstone Information

- **Project Name:** Smart School Management & Learning System (SSMLS)
- **Type:** Senior High School Capstone Project
- **School Year:** 2025–2026
- **Stack:** React + Node.js + MySQL + Vercel
