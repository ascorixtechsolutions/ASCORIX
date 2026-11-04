-- ASCORIX TECH SOLUTIONS - Hostinger MySQL Schema
-- This script creates the required MySQL tables for the application.

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(255) UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('client', 'admin') NOT NULL DEFAULT 'client',
  is_verified TINYINT(1) DEFAULT 0,
  verification_token VARCHAR(255) DEFAULT NULL,
  is_banned TINYINT(1) DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Services Table
CREATE TABLE IF NOT EXISTS services (
  id CHAR(36) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  cost VARCHAR(255) NOT NULL,
  category VARCHAR(255) NOT NULL,
  icon VARCHAR(255) DEFAULT 'code',
  original_price DECIMAL(10,2) DEFAULT 0.00,
  discount_percent DECIMAL(5,2) DEFAULT 0.00,
  discount_reason VARCHAR(255) DEFAULT ''
);

-- 3. Portfolio Table
CREATE TABLE IF NOT EXISTS portfolio (
  id CHAR(36) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(255) NOT NULL,
  tech JSON NOT NULL, -- Replaces PostgreSQL text[]
  image TEXT NOT NULL
);

-- 4. Settings Table
CREATE TABLE IF NOT EXISTS settings (
  id INT PRIMARY KEY DEFAULT 1,
  checkout_enabled TINYINT(1) DEFAULT 0,
  pricing_margin DECIMAL(5,2) DEFAULT 1.00,
  custom_categories JSON, -- Replaces PostgreSQL text[]
  company_name VARCHAR(255) DEFAULT 'ASCORIX TECH SOLUTIONS',
  company_email VARCHAR(255) DEFAULT 'contact@ascorix.com',
  company_phone VARCHAR(255) DEFAULT '',
  company_address TEXT,
  company_gst VARCHAR(255) DEFAULT '',
  invoice_prefix VARCHAR(50) DEFAULT 'INV',
  quotation_prefix VARCHAR(50) DEFAULT 'QUO',
  currency_symbol VARCHAR(10) DEFAULT '₹',
  whatsapp_number VARCHAR(50) DEFAULT '',
  upi_qr_code TEXT,
  maintenance_mode TINYINT(1) DEFAULT 0,
  maintenance_banner TEXT
);

-- 5. OfferCodes Table
CREATE TABLE IF NOT EXISTS offercodes (
  id CHAR(36) PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  discount INT NOT NULL CHECK (discount BETWEEN 1 AND 100),
  active TINYINT(1) DEFAULT 1
);

-- 6. Inquiries Table
CREATE TABLE IF NOT EXISTS inquiries (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) DEFAULT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  service VARCHAR(255) NOT NULL,
  message TEXT,
  status ENUM('Pending', 'Under Review', 'Completed') NOT NULL DEFAULT 'Pending',
  date DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 7. Admins Table
CREATE TABLE IF NOT EXISTS admins (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) UNIQUE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 8. Tickets Table
CREATE TABLE IF NOT EXISTS tickets (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) DEFAULT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  status ENUM('Open', 'In Progress', 'Resolved') NOT NULL DEFAULT 'Open',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 9. Email Verification Table
CREATE TABLE IF NOT EXISTS email_verification (
  id CHAR(36) PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  otp VARCHAR(10) NOT NULL,
  verified TINYINT(1) DEFAULT 0,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 10. Leads Table (CRM)
CREATE TABLE IF NOT EXISTS leads (
  id CHAR(36) PRIMARY KEY,
  lead_number INT AUTO_INCREMENT UNIQUE,
  name VARCHAR(255) NOT NULL,
  company_name VARCHAR(255) DEFAULT '',
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50) DEFAULT '',
  whatsapp VARCHAR(50) DEFAULT '',
  business_type VARCHAR(255) DEFAULT '',
  service VARCHAR(255) NOT NULL,
  budget VARCHAR(255) DEFAULT '',
  message TEXT,
  lead_source ENUM('Website Form','Referral','Social Media','Cold Call','Walk-in','Other') DEFAULT 'Website Form',
  assigned_to VARCHAR(255) DEFAULT '',
  priority ENUM('Low','Medium','High','Urgent') DEFAULT 'Medium',
  status ENUM('New','Contacted','Qualified','Proposal Sent','Negotiation','Won','Lost') DEFAULT 'New',
  follow_up_date DATETIME DEFAULT NULL,
  converted_to_client TINYINT(1) DEFAULT 0,
  client_id CHAR(36) DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 11. Lead Notes
CREATE TABLE IF NOT EXISTS lead_notes (
  id CHAR(36) PRIMARY KEY,
  lead_id CHAR(36),
  author VARCHAR(255) NOT NULL,
  type ENUM('Note','Call','Email','Meeting','Status Change') DEFAULT 'Note',
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);

-- 12. Clients Table
CREATE TABLE IF NOT EXISTS clients (
  id CHAR(36) PRIMARY KEY,
  client_number INT AUTO_INCREMENT UNIQUE,
  company_name VARCHAR(255) NOT NULL,
  contact_person VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50) DEFAULT '',
  whatsapp VARCHAR(50) DEFAULT '',
  address TEXT,
  city VARCHAR(255) DEFAULT '',
  state VARCHAR(255) DEFAULT '',
  country VARCHAR(255) DEFAULT 'India',
  gst VARCHAR(255) DEFAULT '',
  lead_id CHAR(36) DEFAULT NULL,
  notes TEXT,
  status ENUM('Active','Inactive','Churned') DEFAULT 'Active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 13. Projects Table
CREATE TABLE IF NOT EXISTS projects (
  id CHAR(36) PRIMARY KEY,
  project_number INT AUTO_INCREMENT UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  client_id CHAR(36),
  client_name VARCHAR(255) DEFAULT '',
  assigned_to VARCHAR(255) DEFAULT '',
  service_type VARCHAR(255) DEFAULT '',
  status ENUM('Pending','Planning','UI Design','Development','Testing','Review','Completed','Delivered') DEFAULT 'Pending',
  priority ENUM('Low','Medium','High','Urgent') DEFAULT 'Medium',
  progress INT DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  start_date DATE DEFAULT NULL,
  deadline DATE DEFAULT NULL,
  budget DECIMAL(12,2) DEFAULT 0.00,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
);

-- 14. Tasks Table
CREATE TABLE IF NOT EXISTS tasks (
  id CHAR(36) PRIMARY KEY,
  project_id CHAR(36),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  assigned_to VARCHAR(255) DEFAULT '',
  priority ENUM('Low','Medium','High','Urgent') DEFAULT 'Medium',
  status ENUM('Pending','In Progress','Completed') DEFAULT 'Pending',
  due_date DATE DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- 15. Appointments Table
CREATE TABLE IF NOT EXISTS appointments (
  id CHAR(36) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  client_id CHAR(36),
  client_name VARCHAR(255) DEFAULT '',
  client_email VARCHAR(255) DEFAULT '',
  appointment_date DATETIME NOT NULL,
  duration_minutes INT DEFAULT 60,
  type ENUM('Video Call','Phone Call','In Person','Other') DEFAULT 'Video Call',
  status ENUM('Upcoming','Completed','Cancelled','Rescheduled') DEFAULT 'Upcoming',
  meeting_link TEXT,
  notes TEXT,
  lead_id CHAR(36) DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
);

-- 16. Quotations Table
CREATE TABLE IF NOT EXISTS quotations (
  id CHAR(36) PRIMARY KEY,
  quotation_number INT AUTO_INCREMENT UNIQUE,
  client_id CHAR(36),
  client_name VARCHAR(255) NOT NULL,
  client_email VARCHAR(255) NOT NULL,
  client_address TEXT,
  client_gst VARCHAR(255) DEFAULT '',
  subtotal DECIMAL(12,2) DEFAULT 0.00,
  discount_percent DECIMAL(5,2) DEFAULT 0.00,
  discount_amount DECIMAL(12,2) DEFAULT 0.00,
  tax_percent DECIMAL(5,2) DEFAULT 18.00,
  tax_amount DECIMAL(12,2) DEFAULT 0.00,
  total DECIMAL(12,2) DEFAULT 0.00,
  notes TEXT,
  terms TEXT,
  valid_until DATE DEFAULT NULL,
  status ENUM('Draft','Sent','Accepted','Rejected','Expired') DEFAULT 'Draft',
  converted_to_invoice TINYINT(1) DEFAULT 0,
  invoice_id CHAR(36) DEFAULT NULL,
  project_id CHAR(36),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

-- 17. Quotation Items
CREATE TABLE IF NOT EXISTS quotation_items (
  id CHAR(36) PRIMARY KEY,
  quotation_id CHAR(36),
  description TEXT NOT NULL,
  quantity DECIMAL(10,2) DEFAULT 1.00,
  unit_price DECIMAL(12,2) DEFAULT 0.00,
  amount DECIMAL(12,2) DEFAULT 0.00,
  sort_order INT DEFAULT 0,
  service_name VARCHAR(255) DEFAULT '',
  FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE
);

-- 18. Invoices Table
CREATE TABLE IF NOT EXISTS invoices (
  id CHAR(36) PRIMARY KEY,
  invoice_number INT AUTO_INCREMENT UNIQUE,
  client_id CHAR(36),
  client_name VARCHAR(255) NOT NULL,
  client_email VARCHAR(255) NOT NULL,
  client_address TEXT,
  client_gst VARCHAR(255) DEFAULT '',
  quotation_id CHAR(36),
  project_id CHAR(36),
  subtotal DECIMAL(12,2) DEFAULT 0.00,
  discount_percent DECIMAL(5,2) DEFAULT 0.00,
  discount_amount DECIMAL(12,2) DEFAULT 0.00,
  tax_percent DECIMAL(5,2) DEFAULT 18.00,
  tax_amount DECIMAL(12,2) DEFAULT 0.00,
  total DECIMAL(12,2) DEFAULT 0.00,
  amount_paid DECIMAL(12,2) DEFAULT 0.00,
  balance_due DECIMAL(12,2) DEFAULT 0.00,
  notes TEXT,
  terms TEXT,
  due_date DATE DEFAULT NULL,
  payment_status ENUM('Pending','Partially Paid','Paid','Overdue','Cancelled') DEFAULT 'Pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
  FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE SET NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

-- 19. Invoice Items
CREATE TABLE IF NOT EXISTS invoice_items (
  id CHAR(36) PRIMARY KEY,
  invoice_id CHAR(36),
  description TEXT NOT NULL,
  quantity DECIMAL(10,2) DEFAULT 1.00,
  unit_price DECIMAL(12,2) DEFAULT 0.00,
  amount DECIMAL(12,2) DEFAULT 0.00,
  sort_order INT DEFAULT 0,
  service_name VARCHAR(255) DEFAULT '',
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);

-- 20. Payments Table
CREATE TABLE IF NOT EXISTS payments (
  id CHAR(36) PRIMARY KEY,
  invoice_id CHAR(36),
  client_id CHAR(36),
  client_name VARCHAR(255) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  payment_date DATE DEFAULT (CURRENT_DATE),
  method ENUM('Bank Transfer','UPI','Cash','Cheque','Razorpay','Other') DEFAULT 'Bank Transfer',
  reference VARCHAR(255) DEFAULT '',
  type ENUM('Advance','Partial','Full') DEFAULT 'Full',
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
);

-- 21. Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
  id CHAR(36) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type ENUM('info','success','warning','error','lead','payment','project') DEFAULT 'info',
  is_read TINYINT(1) DEFAULT 0,
  link VARCHAR(255) DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
