const { createClient } = require('@supabase/supabase-js');
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const DRY_RUN = process.argv.includes('--dry-run');

// Table migration order (Topological sort to respect foreign keys)
const TABLES = [
  'users',
  'settings',
  'services',
  'portfolio',
  'offercodes',
  'inquiries',
  'admins',
  'tickets',
  'email_verification',
  'leads',
  'lead_notes',
  'clients',
  'projects',
  'tasks',
  'appointments',
  'quotations',
  'quotation_items',
  'invoices',
  'invoice_items',
  'payments',
  'notifications'
];

async function runMigration() {
  console.log(`\n==========================================`);
  console.log(`ASCORIX DB MIGRATION: SUPABASE -> MYSQL`);
  console.log(`==========================================`);
  
  if (DRY_RUN) {
    console.log(`⚠️ DRY RUN MODE ENABLED - No records will be inserted into MySQL.\n`);
  }

  // 1. Initialize Clients
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error('ERROR: Missing SUPABASE_URL or SUPABASE_KEY in .env');
    process.exit(1);
  }

  const dbHost = process.env.DB_HOST;
  const dbName = process.env.DB_NAME;
  const dbUser = process.env.DB_USER;
  const dbPass = process.env.DB_PASSWORD;

  if (!dbHost || !dbName || !dbUser) {
    console.error('ERROR: Missing MySQL database credentials in .env');
    console.error('Ensure DB_HOST, DB_NAME, DB_USER, and DB_PASSWORD are set.');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  let pool = null;

  try {
    console.log(`Connecting to MySQL at ${dbHost}...`);
    pool = mysql.createPool({
      host: dbHost,
      user: dbUser,
      password: dbPass,
      database: dbName,
      port: process.env.DB_PORT || 3306,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
    // Test Connection
    await pool.query('SELECT 1');
    console.log(`✓ MySQL Connection Successful.\n`);
  } catch (err) {
    console.error('ERROR: Failed to connect to MySQL.', err.message);
    process.exit(1);
  }

  const report = {
    totalRecordsFetched: 0,
    totalRecordsMigrated: 0,
    totalErrors: 0,
    tables: {}
  };

  for (const table of TABLES) {
    console.log(`Migrating table: [${table}]...`);
    report.tables[table] = { fetched: 0, inserted: 0, errors: [] };

    try {
      // 2. Read from Supabase
      const { data, error } = await supabase.from(table).select('*');
      if (error) {
        throw new Error(`Supabase Fetch Error: ${error.message}`);
      }

      const records = data || [];
      report.tables[table].fetched = records.length;
      report.totalRecordsFetched += records.length;

      if (records.length === 0) {
        console.log(`   - 0 records found. Skipping.`);
        continue;
      }

      // 3. Transform & Validate
      for (const record of records) {
        const row = { ...record };

        // Data Type Conversions (PostgreSQL Arrays -> MySQL JSON)
        if (table === 'portfolio' && Array.isArray(row.tech)) {
          row.tech = JSON.stringify(row.tech);
        }
        if (table === 'settings' && Array.isArray(row.custom_categories)) {
          row.custom_categories = JSON.stringify(row.custom_categories);
        }

        // Clean up NULL relationships mapping issues
        Object.keys(row).forEach(key => {
          if (row[key] === null || row[key] === undefined) {
             // Let MySQL schema defaults handle NULLs gracefully where permitted
          } else if (typeof row[key] === 'object' && !(row[key] instanceof Date)) {
             // Fallback for nested objects
             row[key] = JSON.stringify(row[key]);
          }
        });

        // 4. Insert into MySQL (if not dry run)
        if (!DRY_RUN) {
          try {
            const columns = Object.keys(row);
            const values = Object.values(row);
            const placeholders = columns.map(() => '?').join(', ');
            const query = `INSERT INTO \`${table}\` (${columns.map(c => `\`${c}\``).join(', ')}) VALUES (${placeholders})`;
            
            await pool.execute(query, values);
            report.tables[table].inserted++;
            report.totalRecordsMigrated++;
          } catch (insertErr) {
            // Detect duplicates or FK errors
            if (insertErr.code === 'ER_DUP_ENTRY') {
               report.tables[table].errors.push(`Duplicate ID ignored: ${row.id}`);
            } else if (insertErr.code === 'ER_NO_REFERENCED_ROW_2') {
               report.tables[table].errors.push(`Missing relationship for record ${row.id || 'N/A'}: ${insertErr.message}`);
               report.totalErrors++;
            } else {
               report.tables[table].errors.push(`Failed to insert record: ${insertErr.message}`);
               report.totalErrors++;
            }
          }
        }
      }

      console.log(`   - Fetched: ${records.length} | Inserted: ${report.tables[table].inserted} | Errors: ${report.tables[table].errors.length}`);

    } catch (err) {
      console.error(`   - ERROR processing table ${table}: ${err.message}`);
      report.tables[table].errors.push(err.message);
      report.totalErrors++;
    }
  }

  // 5. Generate Report
  console.log(`\n==========================================`);
  console.log(`MIGRATION COMPLETE ${DRY_RUN ? '(DRY RUN)' : ''}`);
  console.log(`==========================================`);
  console.log(`Total Records Fetched : ${report.totalRecordsFetched}`);
  console.log(`Total Records Migrated: ${report.totalRecordsMigrated}`);
  console.log(`Total Errors          : ${report.totalErrors}`);

  const reportPath = path.join(__dirname, '../migration/migration-report.md');
  
  let reportMd = `# Database Migration Report\n\n`;
  reportMd += `**Date:** ${new Date().toISOString()}\n`;
  reportMd += `**Mode:** ${DRY_RUN ? 'DRY-RUN (Validation Only)' : 'PRODUCTION'}\n\n`;
  reportMd += `## Summary\n`;
  reportMd += `- **Total Fetched from Supabase:** ${report.totalRecordsFetched}\n`;
  reportMd += `- **Total Inserted into MySQL:** ${report.totalRecordsMigrated}\n`;
  reportMd += `- **Total Errors Encountered:** ${report.totalErrors}\n\n`;
  reportMd += `## Table Breakdown\n\n`;
  
  for (const table of TABLES) {
    const t = report.tables[table];
    reportMd += `### ${table}\n`;
    reportMd += `- Fetched: ${t.fetched}\n`;
    reportMd += `- Inserted: ${t.inserted}\n`;
    if (t.errors.length > 0) {
      reportMd += `- Errors:\n`;
      t.errors.slice(0, 50).forEach(e => reportMd += `  - ${e}\n`);
      if (t.errors.length > 50) reportMd += `  - ...and ${t.errors.length - 50} more.\n`;
    }
    reportMd += `\n`;
  }

  fs.writeFileSync(reportPath, reportMd);
  console.log(`\nFull migration report saved to: migration/migration-report.md`);
  
  // Cleanup
  if (pool) {
    await pool.end();
  }
}

runMigration().catch(console.error);
