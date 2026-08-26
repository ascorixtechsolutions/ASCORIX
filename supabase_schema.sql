-- supabase_schema.sql
-- Run this script inside the SQL Editor of your Supabase console.

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Create Users Table
create table if not exists public.users (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  email text unique not null,
  phone text unique,
  password text not null,
  role text not null default 'client' check (role in ('client', 'admin')),
  is_verified boolean default false,
  verification_token text default null,
  is_banned boolean default false,
  created_at timestamptz default now()
);

-- 2. Create Services Table
create table if not exists public.services (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text not null,
  cost text not null,
  category text not null,
  icon text not null default 'code',
  original_price numeric default 0,
  discount_percent numeric default 0,
  discount_reason text default ''
);

-- 3. Create Portfolio Table
create table if not exists public.portfolio (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text not null,
  category text not null,
  tech text[] default '{}'::text[] not null,
  image text not null
);

-- 4. Create Settings Table
create table if not exists public.settings (
  id int primary key default 1 check (id = 1),
  checkout_enabled boolean default false,
  pricing_margin numeric default 1.0,
  custom_categories text[] default '{}'::text[],
  company_name text default 'ASCORIX TECH SOLUTIONS',
  company_email text default 'contact@ascorix.com',
  company_phone text default '',
  company_address text default '',
  company_gst text default '',
  invoice_prefix text default 'INV',
  quotation_prefix text default 'QUO',
  currency_symbol text default '₹',
  whatsapp_number text default '',
  upi_qr_code text default '',
  maintenance_mode boolean default false,
  maintenance_banner text default '🚧 We are currently undergoing scheduled maintenance. We will be back shortly. Thank you for your patience.'
);

-- If the settings table already exists, run these to add the new columns:
-- ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS maintenance_mode boolean default false;
-- ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS maintenance_banner text default '🚧 We are currently undergoing scheduled maintenance. We will be back shortly.';

-- 5. Create OfferCodes Table
create table if not exists public.offercodes (
  id uuid default gen_random_uuid() primary key,
  code text unique not null,
  discount int not null check (discount between 1 and 100),
  active boolean default true
);

-- 6. Create Inquiries Table
create table if not exists public.inquiries (
  id uuid default gen_random_uuid() primary key,
  user_id text default null,
  name text not null,
  email text not null,
  service text not null,
  message text default '',
  status text not null default 'Pending' check (status in ('Pending', 'Under Review', 'Completed')),
  date timestamptz default now()
);

-- 7. Create Admins Table
create table if not exists public.admins (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade unique,
  name text not null,
  email text not null,
  created_at timestamptz default now()
);

-- Trigger to automatically populate public.admins when a user is created or updated as admin
create or replace function public.sync_admins_on_users_change()
returns trigger as $$
begin
  if (TG_OP = 'INSERT' or TG_OP = 'UPDATE') then
    if NEW.role = 'admin' then
      insert into public.admins (user_id, name, email)
      values (NEW.id, NEW.name, NEW.email)
      on conflict (user_id) do update
      set name = EXCLUDED.name, email = EXCLUDED.email;
    else
      delete from public.admins where user_id = NEW.id;
    end if;
  elsif (TG_OP = 'DELETE') then
    delete from public.admins where user_id = OLD.id;
  end if;
  return null;
end;
$$ language plpgsql security definer;

drop trigger if exists sync_admins_trigger on public.users;
create trigger sync_admins_trigger
after insert or update or delete
on public.users
for each row
execute function public.sync_admins_on_users_change();

-- 8. Create Tickets Table
create table if not exists public.tickets (
  id uuid default gen_random_uuid() primary key,
  user_id text default null,
  name text not null,
  email text not null,
  subject text not null,
  description text not null,
  status text not null default 'Open' check (status in ('Open', 'In Progress', 'Resolved')),
  created_at timestamptz default now()
);

-- 9. Create Email Verification Table
create table if not exists public.email_verification (
  id uuid default gen_random_uuid() primary key,
  email text not null,
  otp text not null,
  verified boolean default false,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

-- ==========================================
-- BMS MODULE TABLES (NEW)
-- ==========================================

-- 10. Leads Table (CRM)
create table if not exists public.leads (
  id uuid default gen_random_uuid() primary key,
  lead_number serial unique,
  name text not null,
  company_name text default '',
  email text not null,
  phone text default '',
  whatsapp text default '',
  business_type text default '',
  service text not null,
  budget text default '',
  message text default '',
  lead_source text default 'Website Form' check (lead_source in ('Website Form','Referral','Social Media','Cold Call','Walk-in','Other')),
  assigned_to text default '',
  priority text default 'Medium' check (priority in ('Low','Medium','High','Urgent')),
  status text default 'New' check (status in ('New','Contacted','Qualified','Proposal Sent','Negotiation','Won','Lost')),
  follow_up_date timestamptz default null,
  converted_to_client boolean default false,
  client_id uuid default null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 11. Lead Notes / Activity Log
create table if not exists public.lead_notes (
  id uuid default gen_random_uuid() primary key,
  lead_id uuid references public.leads(id) on delete cascade,
  author text not null,
  type text default 'Note' check (type in ('Note','Call','Email','Meeting','Status Change')),
  content text not null,
  created_at timestamptz default now()
);

-- 12. Clients Table
create table if not exists public.clients (
  id uuid default gen_random_uuid() primary key,
  client_number serial unique,
  company_name text not null,
  contact_person text not null,
  email text not null,
  phone text default '',
  whatsapp text default '',
  address text default '',
  city text default '',
  state text default '',
  country text default 'India',
  gst text default '',
  lead_id uuid default null,
  notes text default '',
  status text default 'Active' check (status in ('Active','Inactive','Churned')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 13. Projects Table
create table if not exists public.projects (
  id uuid default gen_random_uuid() primary key,
  project_number serial unique,
  name text not null,
  description text default '',
  client_id uuid references public.clients(id) on delete set null,
  client_name text default '',
  assigned_to text default '',
  service_type text default '',
  status text default 'Pending' check (status in ('Pending','Planning','UI Design','Development','Testing','Review','Completed','Delivered')),
  priority text default 'Medium' check (priority in ('Low','Medium','High','Urgent')),
  progress integer default 0 check (progress between 0 and 100),
  start_date date default null,
  deadline date default null,
  budget numeric default 0,
  notes text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 14. Tasks Table
create table if not exists public.tasks (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade,
  title text not null,
  description text default '',
  assigned_to text default '',
  priority text default 'Medium' check (priority in ('Low','Medium','High','Urgent')),
  status text default 'Pending' check (status in ('Pending','In Progress','Completed')),
  due_date date default null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 15. Appointments Table
create table if not exists public.appointments (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  client_id uuid references public.clients(id) on delete set null,
  client_name text default '',
  client_email text default '',
  appointment_date timestamptz not null,
  duration_minutes integer default 60,
  type text default 'Video Call' check (type in ('Video Call','Phone Call','In Person','Other')),
  status text default 'Upcoming' check (status in ('Upcoming','Completed','Cancelled','Rescheduled')),
  meeting_link text default '',
  notes text default '',
  lead_id uuid default null,
  created_at timestamptz default now()
);

-- 16. Quotations Table
create table if not exists public.quotations (
  id uuid default gen_random_uuid() primary key,
  quotation_number serial unique,
  client_id uuid references public.clients(id) on delete set null,
  client_name text not null,
  client_email text not null,
  client_address text default '',
  client_gst text default '',
  subtotal numeric default 0,
  discount_percent numeric default 0,
  discount_amount numeric default 0,
  tax_percent numeric default 18,
  tax_amount numeric default 0,
  total numeric default 0,
  notes text default '',
  terms text default 'Payment is due within 7 days of acceptance.',
  valid_until date default null,
  status text default 'Draft' check (status in ('Draft','Sent','Accepted','Rejected','Expired')),
  converted_to_invoice boolean default false,
  invoice_id uuid default null,
  project_id uuid references public.projects(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 17. Quotation Items
create table if not exists public.quotation_items (
  id uuid default gen_random_uuid() primary key,
  quotation_id uuid references public.quotations(id) on delete cascade,
  description text not null,
  quantity numeric default 1,
  unit_price numeric default 0,
  amount numeric default 0,
  sort_order integer default 0,
  service_name text default ''
);

-- 18. Invoices Table
create table if not exists public.invoices (
  id uuid default gen_random_uuid() primary key,
  invoice_number serial unique,
  client_id uuid references public.clients(id) on delete set null,
  client_name text not null,
  client_email text not null,
  client_address text default '',
  client_gst text default '',
  quotation_id uuid references public.quotations(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  subtotal numeric default 0,
  discount_percent numeric default 0,
  discount_amount numeric default 0,
  tax_percent numeric default 18,
  tax_amount numeric default 0,
  total numeric default 0,
  amount_paid numeric default 0,
  balance_due numeric default 0,
  notes text default '',
  terms text default 'Payment is due within 7 days.',
  due_date date default null,
  payment_status text default 'Pending' check (payment_status in ('Pending','Partially Paid','Paid','Overdue','Cancelled')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 19. Invoice Items
create table if not exists public.invoice_items (
  id uuid default gen_random_uuid() primary key,
  invoice_id uuid references public.invoices(id) on delete cascade,
  description text not null,
  quantity numeric default 1,
  unit_price numeric default 0,
  amount numeric default 0,
  sort_order integer default 0,
  service_name text default ''
);

-- 20. Payments Table
create table if not exists public.payments (
  id uuid default gen_random_uuid() primary key,
  invoice_id uuid references public.invoices(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  client_name text not null,
  amount numeric not null,
  payment_date date default now(),
  method text default 'Bank Transfer' check (method in ('Bank Transfer','UPI','Cash','Cheque','Razorpay','Other')),
  reference text default '',
  type text default 'Full' check (type in ('Advance','Partial','Full')),
  notes text default '',
  created_at timestamptz default now()
);

-- 21. Notifications Table
create table if not exists public.notifications (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  message text not null,
  type text default 'info' check (type in ('info','success','warning','error','lead','payment','project')),
  is_read boolean default false,
  link text default '',
  created_at timestamptz default now()
);

-- ==========================================
-- DISABLE RLS (managed by backend auth)
-- ==========================================
alter table public.users disable row level security;
alter table public.services disable row level security;
alter table public.portfolio disable row level security;
alter table public.settings disable row level security;
alter table public.offercodes disable row level security;
alter table public.inquiries disable row level security;
alter table public.admins disable row level security;
alter table public.tickets disable row level security;
alter table public.email_verification disable row level security;
alter table public.leads disable row level security;
alter table public.lead_notes disable row level security;
alter table public.clients disable row level security;
alter table public.projects disable row level security;
alter table public.tasks disable row level security;
alter table public.appointments disable row level security;
alter table public.quotations disable row level security;
alter table public.quotation_items disable row level security;
alter table public.invoices disable row level security;
alter table public.invoice_items disable row level security;
alter table public.payments disable row level security;
alter table public.notifications disable row level security;

-- ==========================================
-- SEED INITIAL DATA
-- ==========================================

insert into public.settings (id, checkout_enabled, pricing_margin)
values (1, false, 1.0)
on conflict (id) do nothing;

insert into public.offercodes (code, discount, active)
values 
  ('LAUNCH50', 50, true),
  ('ASCORIX10', 10, true)
on conflict (code) do nothing;

insert into public.services (title, description, cost, category, icon)
values
  ('Starter Website', '1–3 Pages, Mobile Responsive, WhatsApp Button, Contact Form, Basic SEO, Delivery: 3–5 Days, Regular Price: ₹4,999', '₹2,499', 'Website Development', 'code'),
  ('Business Website Development', 'Up to 10 pages, premium design, SEO setup, blog section, WhatsApp integration, lead capture forms, Google Analytics, and 30 days support. Best for manufacturers, service companies, and educational institutions.', '₹14,999 base', 'Website Development', 'code'),
  ('Premium Corporate Website Development', 'Custom design, unlimited pages, advanced SEO, speed optimization, AI chat assistant, CRM integration, and analytics dashboard. Best for growing companies, exporters, and industrial businesses.', '₹24,999 base', 'Website Development', 'code'),
  ('Starter Package', '12 Posts/Month, Captions, Hashtags, Basic Design, Monthly Report, Regular Price: ₹5,999/month', '₹2,999/mo', 'Digital Marketing', 'cloud'),
  ('Growth Social Media Plan', '20 custom posts, 4 reels, content calendar development, competitor analysis, and monthly analytics report for active business growth.', '₹5,999/mo', 'Digital Marketing', 'cloud'),
  ('Premium Social Media Plan', '30 custom posts, 8 reels, story designs, complete content strategy development, and lead-oriented content creation.', '₹9,999/mo', 'Digital Marketing', 'cloud'),
  ('Starter Automation', 'WhatsApp Auto Replies, Lead Collection Form, Instagram DM Automation, Basic Business Workflow, Regular Price: ₹7,999+', '₹3,999', 'AI Automation', 'cpu'),
  ('Business AI Automation', 'Instagram Auto Replies, WhatsApp customer workflow automation, automated email notifications, and basic CRM integrations.', '₹9,999 base', 'AI Automation', 'cpu'),
  ('Advanced AI Automation', 'Custom multi-step business workflows, autonomous AI chat assistants, and cross-platform automation pipelines.', '₹19,999 base', 'AI Automation', 'cpu'),
  ('Google Business Profile Optimization', 'Profile setup, category optimization, business description writing, Google Maps visibility optimization, and customer review strategy setup.', '₹1,999 base', 'Google Business Profile', 'shield'),
  ('Launch Bundle Package', 'All-in-one setup including website development, Google Business Profile optimization, and WhatsApp Business workflow setup.', '₹9,999 base', 'Bundle Packages', 'shield'),
  ('Growth Bundle Package', 'Accelerate your business with a responsive website, Google Business Profile optimization, complete social media setup, and 10 custom social posts.', '₹14,999 base', 'Bundle Packages', 'shield'),
  ('ASCORIX Business Growth Package', 'Our ultimate growth engine: Premium corporate website, 1 month of Digital Marketing, AI Automation setup, and Google Business Profile optimization.', '₹24,999 base', 'Bundle Packages', 'shield')
on conflict do nothing;

insert into public.portfolio (title, description, category, tech, image)
values
  ('Aetheria Analytics Platform', 'A secure dashboard tracking high-volume real-time IoT sensor telemetry using cloud-native microservices.', 'Cloud', array['Go', 'Kubernetes', 'React', 'Kafka'], 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80'),
  ('NeuraFlow Finance Agent', 'An automated intelligent workflow system parsing complex PDF audits and forecasting credit risk with machine learning models.', 'AI', array['Python', 'FastAPI', 'PyTorch', 'Tailwind'], 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80'),
  ('Fortress Guard Compliance', 'A unified cybersecurity management console enforcing zero-trust access control policies across remote workforce nodes.', 'Security', array['Rust', 'TypeScript', 'eBPF', 'WebAssembly'], 'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=800&q=80')
on conflict do nothing;

update public.users set role = 'admin' where role = 'admin';
