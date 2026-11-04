# Migration Plan: Supabase to Hostinger MySQL

## Overview
This document outlines the strict protocol for moving data from the legacy Supabase PostgreSQL database to the new Hostinger MySQL backend.

## Migration Script (`scripts/migrate-supabase-to-mysql.js`)
We have engineered a fully automated migration script that reads directly from the Supabase API and performs batched insertions into the MySQL database.

### Features
1. **Preservation**: Retains exact UUIDs, timestamps, and relationships.
2. **Topological Order**: Extracts data sequentially based on foreign-key dependency. (e.g., `users` before `admins`; `clients` before `projects`).
3. **Array Transformations**: Automatically converts PostgreSQL `text[]` fields into MySQL-compatible `JSON` strings (e.g. `portfolio.tech`).
4. **Resiliency**: Handles Duplicate IDs and Missing Foreign Keys gracefully without crashing.
5. **Security**: Retrieves credentials exclusively from `.env`. Zero hard-coded passwords. Reads from Supabase only (ZERO deletion or mutation of legacy data).

## Execution Guide

### 1. Pre-requisites
Ensure your `.env` contains valid credentials for both endpoints:
```env
SUPABASE_URL=...
SUPABASE_KEY=...
DB_PROVIDER=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=ascorix_db
DB_USER=root
DB_PASSWORD=secret
```
Run `npm install mysql2` to ensure the MySQL adapter is installed.
Ensure the `hostinger_mysql_schema.sql` has already been imported into your Hostinger database to create the empty tables.

### 2. Validation (Dry-Run Mode)
Before writing any data to Hostinger, test the connection and Supabase read logic.
```bash
node scripts/migrate-supabase-to-mysql.js --dry-run
```
*This fetches the data and prints a validation report without executing `INSERT` statements against MySQL.*

### 3. Actual Migration
Once the dry-run passes, execute the live migration:
```bash
node scripts/migrate-supabase-to-mysql.js
```
*The script will iteratively migrate all tables, catching specific duplicate/relationship errors and logging them to `migration-report.md`.*

### 4. Rollback & Recovery
Because this script only executes `SELECT` against Supabase, **Supabase is never harmed or modified**. 
If the Hostinger MySQL database receives malformed data, simply:
1. Drop and recreate the MySQL tables using `hostinger_mysql_schema.sql`.
2. Fix any transformation logic.
3. Re-run the migration script.

If the Hostinger database completely fails in production, you can switch the `.env` `DB_PROVIDER` back to `supabase` to immediately restore functionality via the legacy database.
