# College ERP

![College ERP Banner](https://capsule-render.vercel.app/api?type=waving&height=220&color=0:0f172a,40:1e3a8a,80:0ea5e9,100:22d3ee&text=COLLEGE%20ERP&reversal=false&textBg=false&fontColor=ffffff&fontAlignY=38&fontSize=64&desc=Unified%20Academic%20Management%20Platform&descAlignY=62&animation=fadeIn)

![Typing Hero](https://readme-typing-svg.demolab.com?font=Poppins&weight=700&size=24&pause=1200&color=0EA5E9&center=true&vCenter=true&width=900&lines=Centralized+ERP+for+Students%2C+Teachers%2C+Admins%2C+and+Guests;Track+Progress+%E2%80%A2+Manage+Attendance+%E2%80%A2+Share+Notices+%E2%80%A2+Publish+Results)

![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=nextdotjs)
![React](https://img.shields.io/badge/React-19-0EA5E9?style=for-the-badge&logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-2563EB?style=for-the-badge&logo=typescript&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?style=for-the-badge&logo=prisma)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-1D4ED8?style=for-the-badge&logo=postgresql&logoColor=white)

## Overview

College ERP is a unified and centralized academic software system designed to manage day-to-day college operations in one place.

It supports:

- Student progress tracking
- Notice and announcement publishing/viewing
- Attendance marking and privilege-based attendance visibility
- Admin management of student and teacher accounts
- Semester-wise historical exam results
- Public access for guest users (no authentication required) to view public-domain information such as notices, course structure, fee structure, and syllabuses

## Core User Roles

| Role | Access Scope |
| --- | --- |
| Student | View personal progress, attendance, results, notices |
| Teacher | Mark attendance, manage class-side academic updates, view relevant student records |
| Admin | Full control, including adding/removing students and teachers, and administrative oversight |
| Guest | No account required; can access public information only |

## Feature Highlights

- Centralized portal for academic operations
- Role-based access control by privilege
- Auth APIs scaffolded under App Router
- Prisma + PostgreSQL data layer
- Modern Next.js + TypeScript stack

## Tech Stack

- Next.js
- React
- TypeScript
- Prisma ORM
- PostgreSQL
- Tailwind CSS

## Project Structure

```text
app/
  api/
    auth/
    user/
  generated/prisma/
prisma/
  schema.prisma
```

## Prerequisites

Before running this project locally, make sure you have:

1. Node.js 20+ and npm
2. PostgreSQL 14+
3. Git

You can verify your setup:

```bash
node -v
npm -v
psql --version
git --version
```

## Getting Started (Step-by-Step)

### 1. Clone the repository

```bash
git clone https://github.com/mnojz/college-erp.git
cd college-erp
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up PostgreSQL

Create a database and user (adjust as needed):

```sql
CREATE USER admin WITH PASSWORD 'admin';
CREATE DATABASE college_erp OWNER admin;
GRANT ALL PRIVILEGES ON DATABASE college_erp TO admin;
```

### 4. Configure environment variables

Create or update `.env` in the project root:

```env
DATABASE_URL="postgresql://admin:admin@localhost:5432/college_erp?schema=public"

# Optional but recommended for Prisma shadow operations
SHADOW_DATABASE_URL="postgresql://admin:admin@localhost:5432/college_erp_shadow?schema=public"
```

If you use `SHADOW_DATABASE_URL`, create the shadow database too:

```sql
CREATE DATABASE college_erp_shadow OWNER admin;
```

### 5. Sync Prisma schema to database

```bash
npm run db:push
npm run db:generate
```

### 6. Start development server

```bash
npm run dev
```

Open the app at:

```text
http://localhost:3000
```

## Available Scripts

- `npm run dev` - Run Next.js dev server
- `npm run build` - Build for production
- `npm run start` - Start production build
- `npm run lint` - Run ESLint
- `npm run db:push` - Push Prisma schema to PostgreSQL

## Access Model (At a Glance)

```mermaid
flowchart LR
    Guest[Guest User] --> Public[Public Information]
    Student[Student] --> Academic[Academic Dashboard]
    Teacher[Teacher] --> Teaching[Teaching and Attendance]
    Admin[Admin] --> Control[Admin Control Panel]

    Public --> Notices[Notices and Announcements]
    Public --> Courses[Course Structure]
    Public --> Fees[Fee Structure]
    Public --> Syllabus[Syllabuses]

    Academic --> Progress[Progress Tracking]
    Academic --> Results[Past Semester Results]
    Academic --> AttendanceView[Attendance View]

    Teaching --> AttendanceMark[Mark Attendance]
    Teaching --> ClassUpdates[Class Updates]

    Control --> ManageUsers[Add or Delete Students and Teachers]
    Control --> Governance[System Governance]
```

## Security Notes

- Enforce authentication and authorization on backend APIs
- Keep role checks centralized and consistent
- Never expose privileged data in guest/public endpoints

## Troubleshooting

- If Prisma cannot connect, verify your `DATABASE_URL`, PostgreSQL host/port, and credentials.
- If `db:push` fails, confirm database exists and user has permissions.
- If generated client issues appear, run:

```bash
npx prisma generate
```

## Roadmap Ideas

- Fine-grained permission matrix per module
- Notifications center for targeted announcements
- Result analytics and performance trends
- Document upload workflows for academic records

---

### Final Note

To every student, teacher, admin, and guest using this platform: all the best for a smooth and successful academic journey.
