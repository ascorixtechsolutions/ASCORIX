# ASCORIX TECH SOLUTIONS - Hostinger MySQL Database Migration Plan

## 1. Current Supabase Architecture

The current system uses Supabase (PostgreSQL).
- **Primary Keys**: UUID (gen_random_uuid())
- **Timestamps**: timestamptz (now())
- **Arrays**: Native PostgreSQL `text[]` arrays (e.g., in `portfolio.tech`, `settings.custom_categories`)
- **JSON**: Native JSONB support (not heavily used, mostly flat tables)
- **RLS**: Row-Level Security is explicitly disabled because the backend Express.js server handles all authentication and authorization logic.

## 2. MySQL (Hostinger) Schema Strategy

MySQL differs slightly from PostgreSQL. We must normalize and adapt the schema without breaking existing API payloads.

### Data Type Mapping

| PostgreSQL (Supabase) | MySQL (Hostinger) | Notes |
| :--- | :--- | :--- |
| `uuid` | `CHAR(36)` | Standard MySQL UUID storage. |
| `text` | `TEXT` or `VARCHAR(255)` | `VARCHAR` used where uniqueness/indexing is needed (e.g., `email`). |
| `timestamptz` | `DATETIME` or `TIMESTAMP` | We'll use `DATETIME DEFAULT CURRENT_TIMESTAMP`. |
| `boolean` | `TINYINT(1)` | Standard MySQL representation of true/false. |
| `numeric` | `DECIMAL(10,2)` | For currency and financial amounts. |
| `serial` | `INT AUTO_INCREMENT` | For sequential IDs like invoice numbers. |
| `text[]` | `JSON` | Native MySQL JSON type. The backend must parse/stringify arrays. |

## 3. Data Migration (Export & Import) Strategy

To avoid destructive operations and preserve data integrity, perform the migration manually using Hostinger's phpMyAdmin.

### Step 1: Export from Supabase
1. Log into your Supabase Dashboard.
2. Navigate to **Table Editor**.
3. For each of the 21 tables, click **Export to CSV**.

### Step 2: Prepare the Hostinger Database
1. Log into Hostinger Control Panel (hPanel).
2. Go to **Databases** > **MySQL Databases**.
3. Create a new Database and Database User. Keep a record of the Name, User, and Password.
4. Open **phpMyAdmin**.
5. Select your newly created database.
6. Import and run the `hostinger_mysql_schema.sql` file provided to create the blank table structure.

### Step 3: Import Data via phpMyAdmin
1. In phpMyAdmin, click on a specific table (e.g., `users`).
2. Go to the **Import** tab.
3. Choose the CSV file exported from Supabase.
4. Make sure to check: *The first line of the file contains the table column names*.
5. Repeat for all tables. 
*Note on Arrays*: Ensure columns like `tech` in the `portfolio` table are properly formatted as JSON strings (e.g., `["Go", "React"]`) in the CSV before importing.

### Step 4: Switch the Application
1. Update your `.env` (or Hostinger environment variables) with:
   ```env
   DB_PROVIDER=mysql
   DB_HOST=localhost (or your Hostinger DB IP)
   DB_NAME=your_db_name
   DB_USER=your_db_user
   DB_PASSWORD=your_db_password
   ```
2. Restart the Node.js application.

## 4. Required Tables Overview

- **Auth & Core**: `users`, `settings`, `admins`, `email_verification`
- **Marketing**: `services`, `portfolio`, `offercodes`
- **CRM & Support**: `inquiries`, `tickets`, `leads`, `lead_notes`, `clients`
- **Project Management**: `projects`, `tasks`, `appointments`
- **Finance**: `quotations`, `quotation_items`, `invoices`, `invoice_items`, `payments`
- **System**: `notifications`
