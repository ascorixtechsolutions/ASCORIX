# ASCORIX TECH SOLUTIONS — Private Repository & Deployment Blueprint

High-performance, enterprise-grade software development & IT architectures platform. This repository contains the complete frontend UI, backend API service, authentication module, database server layer, and Business Management System (BMS) admin control portal for **ASCORIX TECH SOLUTIONS**.

---

## 1. Project Overview

ASCORIX TECH SOLUTIONS is a modern digital solutions portal offering custom website development, enterprise software engineering, mobile applications, cloud infrastructure, and AI consulting services. 

Key capabilities include:
- **Public Client Interface**: Interactive service catalog, interactive project scoping calculator, demo portfolio showcase, live chat assistant, and client dashboard.
- **Client Control Portal**: Real-time consultation inquiry tracking, project milestone view, and profile management.
- **Business Management System (BMS) Admin Portal**: Comprehensive administrative dashboard for CRM lead tracking, user management, appointment booking, project publishing, quotation generation, invoice creation, and payment auditing.
- **Unified Multi-Database Engine**: Abstracted server layer supporting Supabase (PostgreSQL), MongoDB (Mongoose), or zero-dependency Local JSON database persistence.

---

## 2. Technology Stack

- **Frontend**: HTML5 (Semantic), Vanilla JavaScript (ES6+ Modules), Custom CSS3 (CSS Variables, Flexbox/Grid, Glassmorphism, Micro-animations).
- **Backend / API**: Node.js, Express.js.
- **Database Engine**: Abstracted DB Server (`dbServer.js`) with support for:
  - Supabase (`@supabase/supabase-js`)
  - MongoDB / Mongoose (`mongoose`)
  - Local JSON File Engine (`/data/*.json`)
- **Authentication**: JWT (JSON Web Tokens) with 7-day expiration, `bcryptjs` password hashing, and OTP (One-Time Password) email verification.
- **Mailing**: Nodemailer (SMTP / Gmail App Passwords).

---

## 3. Folder Structure

```
ASCORIX/
├── admin/                        # BMS Admin Portal Modules
│   ├── ai-assistant.js           # Admin AI helper module
│   ├── appointments.js           # Appointment booking manager
│   ├── charts.js                 # Dashboard chart visualization engine
│   ├── clients.js                # Client directory module
│   ├── crm.js                    # CRM & lead management module
│   ├── invoices.js               # Invoice generation & billing
│   ├── notifications.js          # System alert notifications
│   ├── payments.js               # Payment history & audit log
│   ├── projects.js               # Project publishing & tracking
│   ├── quotations.js             # Price quote calculator & generator
│   └── reports.js                # Financial & business report generator
├── data/                         # Local JSON Database Store (Fallback)
│   ├── dbConfig.json             # Runtime database provider config
│   ├── users.json                # User accounts store
│   ├── inquiries.json            # Client consultation inquiries
│   ├── services.json             # Service catalog items
│   ├── portfolio.json            # Demo project showcase items
│   └── ...                       # CRM/BMS datasets
├── demo/                         # External Demo Landing Pages
│   └── index.html                # Sample live demo target
├── uploads/                      # Dynamic File Upload Directory
│   └── projects/                 # Uploaded project attachments
├── .env.example                  # Environment variable template (no real secrets)
├── .gitignore                    # Git ignore file for security & repository hygiene
├── admin-portal.js               # Core BMS Admin Portal script
├── admin.css                     # BMS Admin Panel design system
├── admin.html                    # BMS Admin Panel main template
├── app.js                        # Client website interactivity & dashboard logic
├── db.js                         # Frontend API connector & client-side auth layer
├── dbServer.js                   # Unified Database Server Layer (Supabase/Mongo/Local)
├── index.html                    # Public ASCORIX website main page
├── package.json                  # Node.js project manifest & scripts
├── portfolio.js                  # Demo project showcase & popup modal logic
├── server.js                     # Core Express.js HTTP Server & API endpoints
├── services.js                   # Service catalog loader & scope calculator
├── style.css                     # Main ASCORIX web app styling & theme engine
└── supabase_schema.sql           # Database SQL schema for Supabase / PostgreSQL
```

---

## 4. Required Node.js Version

- **Node.js**: `v18.x` or `v20.x` LTS recommended (Minimum: `v16.14.0`).
- **npm**: `v9.x` or `v10.x`.

---

## 5. Installation

1. **Clone Repository**:
   ```bash
   git clone git@github.com:your-organization/ascorix.git
   cd ascorix
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment**:
   Copy `.env.example` to `.env` and populate environment variables:
   ```bash
   cp .env.example .env
   ```

---

## 6. Environment Variables

All sensitive values, credentials, API keys, and connection strings must be configured via environment variables.

| Variable | Description | Required | Default |
|---|---|---|---|
| `PORT` | HTTP server port | No | `3000` |
| `NODE_ENV` | Environment identifier (`development`, `staging`, `production`) | Recommended | `development` |
| `DB_PROVIDER` | Database engine (`supabase`, `mongodb`, `local`) | Recommended | `local` |
| `JWT_SECRET` | Secret key for signing authentication JWT tokens | **Yes** | — |
| `SUPABASE_URL` | Supabase project URL (if `DB_PROVIDER=supabase`) | Conditional | — |
| `SUPABASE_KEY` | Supabase anon/public key (if `DB_PROVIDER=supabase`) | Conditional | — |
| `MONGODB_URI` | MongoDB connection URI (if `DB_PROVIDER=mongodb`) | Conditional | — |
| `EMAIL_USER` | SMTP email address for system emails | Conditional | — |
| `EMAIL_PASS` | SMTP email password / App Password | Conditional | — |
| `GMAIL_USER` | Gmail address for OTP & notification emails | Conditional | — |
| `GMAIL_APP_PASSWORD` | Gmail App Password | Conditional | — |
| `OWNER_EMAIL` | Owner email address for consultation alerts | Optional | — |

---

## 7. Local Development

Run the development server using Node.js:

```bash
# Start local development server
npm run dev
```

The application will start at `http://localhost:3000`.
- **Main Website**: `http://localhost:3000/`
- **BMS Admin Panel**: `http://localhost:3000/admin.html`

---

## 8. Development Branch Workflow

Maintain the repository using Git branching standards:

```
[Feature Branch]  --->  [development Branch]  --->  [Testing/Staging]  --->  [main (Production)]
```

### Workflow Rules:
1. **Never commit directly to `main`**.
2. Create topic/feature branches off `development`:
   ```bash
   git checkout development
   git pull origin development
   git checkout -b feature/new-client-feature
   ```
3. Test locally, commit cleanly, and push to GitHub:
   ```bash
   git add .
   git commit -m "feat: implement requested feature"
   git push origin feature/new-client-feature
   ```
4. Open a Pull Request (PR) into `development`.
5. After verification, merge `development` into `main` for release.

---

## 9. Staging Workflow

Staging allows testing features on a live server environment separate from production:

- **Staging URL Example**: `https://staging.ascorixtechsolutions.com`
- **Configuration**:
  - `NODE_ENV=staging`
  - Separate database (e.g. Supabase staging project or distinct MongoDB database `ascorix_staging`).
  - Staging environment variables set in Hostinger / hosting environment.

---

## 10. Production Workflow

Production represents the live user-facing application:

- **Production URL**: `https://ascorixtechsolutions.com`
- **Branch**: `main`
- **Deployment**: Automatic or manual Git deployment from `main` branch.
- **Environment**: `NODE_ENV=production` with production database credentials.

---

## 11. Build Commands

As a Node.js Express application serving modern JavaScript modules and assets, no separate compilation step is required.

- **Build Check**:
  ```bash
  npm run build
  ```
  *(Returns code 0 indicating asset readiness)*

- **Start Command**:
  ```bash
  npm start
  ```

---

## 12. Database Setup

### Option A: Local JSON File Engine (Zero Setup)
No database server required. Data is automatically persisted in `/data/*.json`. Ideal for offline development and quick local testing.

### Option B: Supabase (PostgreSQL)
1. Log into Supabase Console and create a project.
2. Open **SQL Editor** in Supabase console.
3. Run the complete SQL setup script located at `supabase_schema.sql`.
4. Copy Project URL and Anon API Key to `.env`:
   ```env
   DB_PROVIDER=supabase
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_KEY=your-anon-key
   ```

### Option C: MongoDB Atlas / Managed MongoDB
1. Create a MongoDB database cluster.
2. Obtain connection string and update `.env`:
   ```env
   DB_PROVIDER=mongodb
   MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/ascorix?retryWrites=true&w=majority
   ```

---

## 13. Database Migration Procedure

1. **Non-Destructive Migrations Only**: All database migrations must be additive (e.g., `ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone text;`).
2. **Never drop production tables** or delete data during deployment.
3. Apply SQL updates from `supabase_schema.sql` via Supabase SQL Editor before deploying code that depends on new columns.

---

## 14. Deployment Procedure (Hostinger Git Deployment)

### Hostinger Setup Steps:
1. Log into Hostinger **hPanel**.
2. Navigate to **Websites** -> Select `ascorixtechsolutions.com` -> **Advanced** -> **Git**.
3. Add Repository Details:
   - **Repository URL**: `git@github.com:your-organization/ascorix.git` (Private SSH) or HTTPS URL with access token.
   - **Branch**: `main`
   - **Target Directory**: `/public_html` or Node.js application root.
4. Set Up Node.js Application in hPanel:
   - **Application Root**: `ascorix`
   - **Application Startup File**: `server.js`
   - **Node.js Version**: `18.x` or `20.x`
5. Configure Environment Variables in Hostinger Node.js configuration panel matching `.env.example`.
6. Click **Deploy**. Hostinger will clone `main` branch, execute `npm install`, and start `server.js`.

---

## 15. Rollback Procedure

If a deployment issues occur, revert safely without losing data:

1. **Identify Previous Stable Commit**:
   ```bash
   git log --oneline -n 5
   ```
2. **Revert Deployment in Git**:
   ```bash
   git revert HEAD --no-edit
   git push origin main
   ```
3. **Hostinger Rollback**:
   In Hostinger hPanel -> **Git** -> Click **Auto Deployment / Deploy** on the new reverted commit, or check out the previous release tag.

---

## 16. Security Precautions

- **Never Commit Secrets**: Ensure `.env` is listed in `.gitignore`.
- **Enforce Environment Variables**: Never hard-code passwords, private keys, or API tokens in code files.
- **Account Protection**: Email & Mobile Number uniqueness is enforced on registration to prevent duplicate accounts.
- **JWT Security**: Always configure a strong, random `JWT_SECRET` string in production environments.

---

## 17. GitHub Setup Requirements

1. **Create Private GitHub Repository**: Set visibility to **Private**.
2. **Push Local Code**:
   ```bash
   git init
   git branch -M main
   git remote add origin git@github.com:your-org/ascorix.git
   git add .
   git commit -m "chore: initial production repository setup"
   git push -u origin main
   ```
3. **Configure Branch Protection Rules**:
   - Go to **Settings** -> **Branches** -> Add rule for `main`.
   - Enable *Require a pull request before merging*.
   - Enable *Require status checks to pass before merging*.

---

© 2026 ASCORIX TECH SOLUTIONS. All Rights Reserved.
