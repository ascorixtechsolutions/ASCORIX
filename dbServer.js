// dbServer.js - Unified Database Server-Side Layer for ASCORIX
const { createClient } = require('@supabase/supabase-js');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DB_CONFIG_PATH = path.join(DATA_DIR, 'dbConfig.json');
let isMongoConnected = false;
let isMysqlConnected = false;
let mysqlPool = null;

function loadDbConfig() {
  if (fs.existsSync(DB_CONFIG_PATH)) {
    try { return JSON.parse(fs.readFileSync(DB_CONFIG_PATH, 'utf8')); }
    catch(e) { console.error('Error parsing dbConfig.json', e); }
  }
  return null;
}

function getDbConfig() {
  const envProvider = (process.env.DB_PROVIDER || '').toLowerCase();
  if (envProvider === 'supabase' && process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
    return { provider: 'supabase', supabaseUrl: process.env.SUPABASE_URL, supabaseKey: process.env.SUPABASE_KEY };
  } else if (envProvider === 'mongodb' && process.env.MONGODB_URI) {
    return { provider: 'mongodb', mongoUri: process.env.MONGODB_URI };
  } else if (envProvider === 'mysql') {
    return { 
      provider: 'mysql', 
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 3306,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD
    };
  } else if (envProvider === 'local') {
    return { provider: 'local' };
  }

  const custom = loadDbConfig();
  if (custom && custom.provider) return custom;
  if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
    return { provider: 'supabase', supabaseUrl: process.env.SUPABASE_URL, supabaseKey: process.env.SUPABASE_KEY };
  } else if (process.env.MONGODB_URI) {
    return { provider: 'mongodb', mongoUri: process.env.MONGODB_URI };
  }
  return { provider: 'local' };
}

async function updateDbConfig(configObj) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_CONFIG_PATH, JSON.stringify(configObj, null, 2));
  
  if (isMongoConnected && mongoose.connection.readyState === 1) {
    await mongoose.disconnect();
  }
  isMongoConnected = false;
  isSupabaseConnected = false;
  isMysqlConnected = false;
  supabase = null;
  mysqlPool = null;
  
  await dbConnect();
}

// Default Seed Data (aligned with client-side db.js defaults)
const DEFAULT_SERVICES = [
  {
    title: "Starter Website",
    description: "1–3 Pages, Mobile Responsive, WhatsApp Button, Contact Form, Basic SEO, Delivery: 3–5 Days, Regular Price: ₹4,999",
    cost: "₹2,499",
    category: "Website Development",
    icon: "code"
  },
  {
    title: "Business Website Development",
    description: "Up to 10 pages, premium design, SEO setup, blog section, WhatsApp integration, lead capture forms, Google Analytics, and 30 days support. Best for manufacturers, service companies, and educational institutions.",
    cost: "₹14,999 base",
    category: "Website Development",
    icon: "code"
  },
  {
    title: "Premium Corporate Website Development",
    description: "Custom design, unlimited pages, advanced SEO, speed optimization, AI chat assistant, CRM integration, and analytics dashboard. Best for growing companies, exporters, and industrial businesses.",
    cost: "₹24,999 base",
    category: "Website Development",
    icon: "code"
  },
  {
    title: "Starter Package",
    description: "12 Posts/Month, Captions, Hashtags, Basic Design, Monthly Report, Regular Price: ₹5,999/month",
    cost: "₹2,999/mo",
    category: "Digital Marketing",
    icon: "cloud"
  },
  {
    title: "Growth Social Media Plan",
    description: "20 custom posts, 4 reels, content calendar development, competitor analysis, and monthly analytics report for active business growth.",
    cost: "₹5,999/mo",
    category: "Digital Marketing",
    icon: "cloud"
  },
  {
    title: "Premium Social Media Plan",
    description: "30 custom posts, 8 reels, story designs, complete content strategy development, and lead-oriented content creation.",
    cost: "₹9,999/mo",
    category: "Digital Marketing",
    icon: "cloud"
  },
  {
    title: "Starter Automation",
    description: "WhatsApp Auto Replies, Lead Collection Form, Instagram DM Automation, Basic Business Workflow, Regular Price: ₹7,999+",
    cost: "₹3,999",
    category: "AI Automation",
    icon: "cpu"
  },
  {
    title: "Business AI Automation",
    description: "Instagram Auto Replies, WhatsApp customer workflow automation, automated email notifications, and basic CRM integrations.",
    cost: "₹9,999 base",
    category: "AI Automation",
    icon: "cpu"
  },
  {
    title: "Advanced AI Automation",
    description: "Custom multi-step business workflows, autonomous AI chat assistants, and cross-platform automation pipelines.",
    cost: "₹19,999 base",
    category: "AI Automation",
    icon: "cpu"
  },
  {
    title: "Google Business Profile Optimization",
    description: "Profile setup, category optimization, business description writing, Google Maps visibility optimization, and customer review strategy setup.",
    cost: "₹1,999 base",
    category: "Google Business Profile",
    icon: "shield"
  },
  {
    title: "Launch Bundle Package",
    description: "All-in-one setup including website development, Google Business Profile optimization, and WhatsApp Business workflow setup.",
    cost: "₹9,999 base",
    category: "Bundle Packages",
    icon: "shield"
  },
  {
    title: "Growth Bundle Package",
    description: "Accelerate your business with a responsive website, Google Business Profile optimization, complete social media setup, and 10 custom social posts.",
    cost: "₹14,999 base",
    category: "Bundle Packages",
    icon: "shield"
  },
  {
    title: "ASCORIX Business Growth Package",
    description: "Our ultimate growth engine: Premium corporate website, 1 month of Digital Marketing, AI Automation setup, and Google Business Profile optimization.",
    cost: "₹24,999 base",
    category: "Bundle Packages",
    icon: "shield"
  }
];

const DEFAULT_PORTFOLIO = [
  {
    title: "Aetheria Analytics Platform",
    description: "A secure dashboard tracking high-volume real-time IoT sensor telemetry using cloud-native microservices.",
    category: "Cloud",
    tech: ["Go", "Kubernetes", "React", "Kafka"],
    image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80"
  },
  {
    title: "NeuraFlow Finance Agent",
    description: "An automated intelligent workflow system parsing complex PDF audits and forecasting credit risk with machine learning models.",
    category: "AI",
    tech: ["Python", "FastAPI", "PyTorch", "Tailwind"],
    image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80"
  },
  {
    title: "Fortress Guard Compliance",
    description: "A unified cybersecurity management console enforcing zero-trust access control policies across remote workforce nodes.",
    category: "Security",
    tech: ["Rust", "TypeScript", "eBPF", "WebAssembly"],
    image: "https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=800&q=80"
  }
];

// ==========================================
// MYSQL CONNECTION & ABSTRACTION (PREPARATION)
// ==========================================
// Note: This block is prepared for the upcoming Hostinger MySQL migration.
// Once you switch DB_PROVIDER=mysql in .env, this pool will be initialized.
// You will need to run: npm install mysql2
// let mysqlPool = null;
// let isMysqlConnected = false;

// async function initMysql() {
//   const config = getDbConfig();
//   if (config.provider === 'mysql' && !isMysqlConnected) {
//     const mysql = require('mysql2/promise');
//     mysqlPool = mysql.createPool({
//       host: config.host,
//       port: config.port,
//       user: config.user,
//       password: config.password,
//       database: config.database,
//       waitForConnections: true,
//       connectionLimit: 10,
//       queueLimit: 0
//     });
//     isMysqlConnected = true;
//     console.log("SUCCESS: Connected to Hostinger MySQL Database.");
//   }
// }

// ==========================================
// MONGODB SCHEMAS & MODELS
// ==========================================

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['client', 'admin'], default: 'client' },
  is_verified: { type: Boolean, default: false },
  verification_token: { type: String, default: null },
  is_banned: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const serviceSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  cost: { type: String, required: true },
  category: { type: String, required: true },
  icon: { type: String, default: 'code' },
  original_price: { type: Number, default: 0 },
  discount_percent: { type: Number, default: 0 },
  discount_reason: { type: String, default: '' }
});

const portfolioSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, required: true },
  tech: [{ type: String }],
  image: { type: String, required: true }
});

const settingsSchema = new mongoose.Schema({
  checkoutEnabled: { type: Boolean, default: false },
  pricingMargin: { type: Number, default: 1.0 },
  customCategories: { type: [String], default: [] },
  upiQrCode: { type: String, default: '' },
  maintenanceMode: { type: Boolean, default: false },
  maintenanceBanner: { type: String, default: '🚧 We are currently undergoing scheduled maintenance. We will be back shortly. Thank you for your patience.' }
});

const offerCodeSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  discount: { type: Number, required: true },
  active: { type: Boolean, default: true }
});

const inquirySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  name: { type: String, required: true },
  email: { type: String, required: true },
  service: { type: String, required: true },
  message: { type: String, default: '' },
  status: { type: String, enum: ['Pending', 'Under Review', 'Completed'], default: 'Pending' },
  date: { type: Date, default: Date.now }
});

const ticketSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  name: { type: String, required: true },
  email: { type: String, required: true },
  subject: { type: String, required: true },
  description: { type: String, required: true },
  status: { type: String, enum: ['Open', 'In Progress', 'Resolved'], default: 'Open' },
  date: { type: Date, default: Date.now }
});

const emailVerificationSchema = new mongoose.Schema({
  email: { type: String, required: true },
  otp: { type: String, required: true },
  verified: { type: Boolean, default: false },
  expires_at: { type: Date, required: true },
  created_at: { type: Date, default: Date.now }
});

let UserModel, ServiceModel, PortfolioModel, InquiryModel, SettingsModel, OfferCodeModel, TicketModel, EmailVerificationModel;

// ==========================================
// LOCAL FILE DATABASE HELPER (FALLBACK)
// ==========================================

function readJsonFile(filename, defaultData = []) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
    return defaultData;
  }
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.error(`Error reading database file ${filename}:`, err);
    return defaultData;
  }
}

function writeJsonFile(filename, data) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const filePath = path.join(DATA_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// Helper to generate unique hex ID simulating MongoDB ObjectId
function generateId() {
  return Math.random().toString(16).substring(2, 10) + Math.random().toString(16).substring(2, 10) + Math.random().toString(16).substring(2, 10);
}

const LocalDB = {
  Users: {
    async find() {
      return readJsonFile('users.json');
    },
    async findOne(query) {
      const users = readJsonFile('users.json');
      return users.find(u => Object.keys(query).every(key => {
        if (!query[key]) return true;
        if (key === 'email' && u.email) {
          return u.email.toLowerCase().trim() === String(query[key]).toLowerCase().trim();
        }
        if (key === 'phone' && u.phone) {
          const cleanUPhone = u.phone.replace(/[\s\-\(\)]/g, '').trim();
          const cleanQPhone = String(query[key]).replace(/[\s\-\(\)]/g, '').trim();
          return cleanUPhone === cleanQPhone;
        }
        return u[key] === query[key];
      }));
    },
    async findById(id) {
      const users = readJsonFile('users.json');
      return users.find(u => u._id === id || u.id === id);
    },
    async findByIdAndUpdate(id, data) {
      let users = readJsonFile('users.json');
      let updated = null;
      users = users.map(u => {
        if (u._id === id || u.id === id) {
          updated = { ...u, ...data };
          return updated;
        }
        return u;
      });
      writeJsonFile('users.json', users);
      return updated;
    },
    async create(data) {
      const users = readJsonFile('users.json');
      const cleanEmail = (data.email || '').toLowerCase().trim();
      const cleanPhone = (data.phone || '').replace(/[\s\-\(\)]/g, '').trim();

      if (users.some(u => u.email && u.email.toLowerCase().trim() === cleanEmail)) {
        throw new Error('Email address is already registered.');
      }
      if (cleanPhone && users.some(u => u.phone && u.phone.replace(/[\s\-\(\)]/g, '').trim() === cleanPhone)) {
        throw new Error('Mobile number is already registered to another account.');
      }
      const newUser = { _id: generateId(), ...data, createdAt: new Date() };
      users.push(newUser);
      writeJsonFile('users.json', users);
      return newUser;
    },
    async findByIdAndDelete(id) {
      let users = readJsonFile('users.json');
      const toDelete = users.find(u => u._id === id || u.id === id);
      users = users.filter(u => u._id !== id && u.id !== id);
      writeJsonFile('users.json', users);
      return toDelete;
    }
  },
  Services: {
    async find() {
      const services = readJsonFile('services.json');
      if (services.length === 0) {
        // Seed services
        const seeded = DEFAULT_SERVICES.map(s => ({ _id: generateId(), ...s }));
        writeJsonFile('services.json', seeded);
        return seeded;
      }
      return services;
    },
    async findById(id) {
      const services = readJsonFile('services.json');
      return services.find(s => s._id === id);
    },
    async create(data) {
      const services = readJsonFile('services.json');
      const newService = { _id: generateId(), ...data };
      services.push(newService);
      writeJsonFile('services.json', services);
      return newService;
    },
    async findByIdAndUpdate(id, data) {
      let services = readJsonFile('services.json');
      let updated = null;
      services = services.map(s => {
        if (s._id === id) {
          updated = { ...s, ...data };
          return updated;
        }
        return s;
      });
      writeJsonFile('services.json', services);
      return updated;
    },
    async findByIdAndDelete(id) {
      let services = readJsonFile('services.json');
      const toDelete = services.find(s => s._id === id);
      services = services.filter(s => s._id !== id);
      writeJsonFile('services.json', services);
      return toDelete;
    }
  },
  Portfolio: {
    async find() {
      const portfolio = readJsonFile('portfolio.json');
      if (portfolio.length === 0) {
        // Seed portfolio
        const seeded = DEFAULT_PORTFOLIO.map(p => ({ _id: generateId(), ...p }));
        writeJsonFile('portfolio.json', seeded);
        return seeded;
      }
      return portfolio;
    },
    async create(data) {
      const portfolio = readJsonFile('portfolio.json');
      const newProject = { _id: generateId(), ...data };
      portfolio.push(newProject);
      writeJsonFile('portfolio.json', portfolio);
      return newProject;
    },
    async findByIdAndDelete(id) {
      let portfolio = readJsonFile('portfolio.json');
      const toDelete = portfolio.find(p => p._id === id);
      portfolio = portfolio.filter(p => p._id !== id);
      writeJsonFile('portfolio.json', portfolio);
      return toDelete;
    },
    async findByIdAndUpdate(id, data) {
      let portfolio = readJsonFile('portfolio.json');
      let updated = null;
      portfolio = portfolio.map(p => {
        if (p._id === id) {
          updated = { ...p, ...data };
          return updated;
        }
        return p;
      });
      writeJsonFile('portfolio.json', portfolio);
      return updated;
    }
  },
  Inquiries: {
    async find(query = {}) {
      const inquiries = readJsonFile('inquiries.json');
      // Simple filter logic for userId
      if (query.userId) {
        return inquiries.filter(i => i.userId === query.userId);
      }
      return inquiries;
    },
    async create(data) {
      const inquiries = readJsonFile('inquiries.json');
      const newInquiry = {
        _id: generateId(),
        ...data,
        status: data.status || 'Pending',
        date: new Date().toISOString()
      };
      inquiries.unshift(newInquiry); // newest first
      writeJsonFile('inquiries.json', inquiries);
      return newInquiry;
    },
    async findByIdAndUpdate(id, data) {
      let inquiries = readJsonFile('inquiries.json');
      let updated = null;
      inquiries = inquiries.map(i => {
        if (i._id === id) {
          updated = { ...i, ...data };
          return updated;
        }
        return i;
      });
      writeJsonFile('inquiries.json', inquiries);
      return updated;
    },
    async findByIdAndDelete(id) {
      let inquiries = readJsonFile('inquiries.json');
      const toDelete = inquiries.find(i => i._id === id);
      inquiries = inquiries.filter(i => i._id !== id);
      writeJsonFile('inquiries.json', inquiries);
      return toDelete;
    }
  },
  Tickets: {
    async find(query = {}) {
      const tickets = readJsonFile('tickets.json');
      if (query.userId) {
        return tickets.filter(t => t.userId === query.userId);
      }
      return tickets;
    },
    async create(data) {
      const tickets = readJsonFile('tickets.json');
      const newTicket = {
        _id: generateId(),
        ...data,
        status: data.status || 'Open',
        date: new Date().toISOString()
      };
      tickets.unshift(newTicket); // newest first
      writeJsonFile('tickets.json', tickets);
      return newTicket;
    },
    async findByIdAndUpdate(id, data) {
      let tickets = readJsonFile('tickets.json');
      let updated = null;
      tickets = tickets.map(t => {
        if (t._id === id) {
          updated = { ...t, ...data };
          return updated;
        }
        return t;
      });
      writeJsonFile('tickets.json', tickets);
      return updated;
    },
    async findByIdAndDelete(id) {
      let tickets = readJsonFile('tickets.json');
      const toDelete = tickets.find(t => t._id === id);
      tickets = tickets.filter(t => t._id !== id);
      writeJsonFile('tickets.json', tickets);
      return toDelete;
    }
  },
  Settings: {
    async findOne() {
      const settingsList = readJsonFile('settings.json', [{ checkoutEnabled: false, pricingMargin: 1.0, customCategories: [], upiQrCode: '', maintenanceMode: false, maintenanceBanner: '\uD83D\uDEA7 We are currently undergoing scheduled maintenance. We will be back shortly. Thank you for your patience.' }]);
      if (!settingsList[0].customCategories) {
        settingsList[0].customCategories = [];
      }
      if (!settingsList[0].upiQrCode) {
        settingsList[0].upiQrCode = '';
      }
      if (settingsList[0].maintenanceMode === undefined) {
        settingsList[0].maintenanceMode = false;
      }
      if (!settingsList[0].maintenanceBanner) {
        settingsList[0].maintenanceBanner = '\uD83D\uDEA7 We are currently undergoing scheduled maintenance. We will be back shortly. Thank you for your patience.';
      }
      return settingsList[0];
    },
    async updateOne(query, data) {
      const settingsList = readJsonFile('settings.json', [{ checkoutEnabled: false, pricingMargin: 1.0, customCategories: [], upiQrCode: '', maintenanceMode: false, maintenanceBanner: '\uD83D\uDEA7 We are currently undergoing scheduled maintenance. We will be back shortly. Thank you for your patience.' }]);
      const updated = { ...settingsList[0], ...data };
      if (!updated.customCategories) {
        updated.customCategories = [];
      }
      writeJsonFile('settings.json', [updated]);
      return updated;
    }
  },
  OfferCodes: {
    async find() {
      const codes = readJsonFile('offercodes.json');
      if (codes.length === 0) {
        const seeded = [
          { _id: generateId(), code: 'LAUNCH50', discount: 50, active: true },
          { _id: generateId(), code: 'ASCORIX10', discount: 10, active: true }
        ];
        writeJsonFile('offercodes.json', seeded);
        return seeded;
      }
      return codes;
    },
    async findOne(query) {
      const codes = readJsonFile('offercodes.json');
      return codes.find(c => Object.keys(query).every(key => c[key] === query[key]));
    },
    async create(data) {
      const codes = readJsonFile('offercodes.json');
      const newCode = { _id: generateId(), ...data, active: data.active !== undefined ? data.active : true };
      codes.push(newCode);
      writeJsonFile('offercodes.json', codes);
      return newCode;
    },
    async findByIdAndDelete(id) {
      let codes = readJsonFile('offercodes.json');
      const toDelete = codes.find(c => c._id === id);
      codes = codes.filter(c => c._id !== id);
      writeJsonFile('offercodes.json', codes);
      return toDelete;
    }
  },
  EmailVerification: {
    async create(data) {
      const list = readJsonFile('email_verification.json');
      const newItem = { _id: generateId(), ...data, created_at: new Date().toISOString() };
      list.push(newItem);
      writeJsonFile('email_verification.json', list);
      return newItem;
    },
    async findOne(query) {
      const list = readJsonFile('email_verification.json');
      return list.find(item => Object.keys(query).every(key => item[key] === query[key]));
    },
    async delete(id) {
      let list = readJsonFile('email_verification.json');
      const toDelete = list.find(item => item._id === id);
      list = list.filter(item => item._id !== id);
      writeJsonFile('email_verification.json', list);
      return toDelete;
    },
    async update(id, data) {
      let list = readJsonFile('email_verification.json');
      let updated = null;
      list = list.map(item => {
        if (item._id === id || item.id === id) {
          updated = { ...item, ...data };
          return updated;
        }
        return item;
      });
      writeJsonFile('email_verification.json', list);
      return updated;
    }
  },

  // ---- BMS MODULE LOCAL DB MODELS ----

  Leads: {
    async find(query = {}) {
      let leads = readJsonFile('leads.json');
      if (query.status) leads = leads.filter(l => l.status === query.status);
      return leads.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    },
    async findById(id) {
      const leads = readJsonFile('leads.json');
      return leads.find(l => l._id === id);
    },
    async findOne(query) {
      const leads = readJsonFile('leads.json');
      return leads.find(l => Object.keys(query).every(k => l[k] === query[k]));
    },
    async create(data) {
      const leads = readJsonFile('leads.json');
      const maxNum = leads.reduce((m, l) => Math.max(m, l.lead_number || 0), 0);
      const newLead = { _id: generateId(), lead_number: maxNum + 1, ...data, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      leads.unshift(newLead);
      writeJsonFile('leads.json', leads);
      return newLead;
    },
    async findByIdAndUpdate(id, data) {
      let leads = readJsonFile('leads.json');
      let updated = null;
      leads = leads.map(l => { if (l._id === id) { updated = { ...l, ...data, updated_at: new Date().toISOString() }; return updated; } return l; });
      writeJsonFile('leads.json', leads);
      return updated;
    },
    async findByIdAndDelete(id) {
      let leads = readJsonFile('leads.json');
      const toDelete = leads.find(l => l._id === id);
      leads = leads.filter(l => l._id !== id);
      writeJsonFile('leads.json', leads);
      return toDelete;
    },
    async count(query = {}) {
      const leads = await this.find(query);
      return leads.length;
    }
  },

  LeadNotes: {
    async find(query = {}) {
      let notes = readJsonFile('lead_notes.json');
      if (query.lead_id) notes = notes.filter(n => n.lead_id === query.lead_id);
      return notes.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    },
    async create(data) {
      const notes = readJsonFile('lead_notes.json');
      const newNote = { _id: generateId(), ...data, created_at: new Date().toISOString() };
      notes.push(newNote);
      writeJsonFile('lead_notes.json', notes);
      return newNote;
    },
    async findByIdAndDelete(id) {
      let notes = readJsonFile('lead_notes.json');
      const toDelete = notes.find(n => n._id === id);
      notes = notes.filter(n => n._id !== id);
      writeJsonFile('lead_notes.json', notes);
      return toDelete;
    }
  },

  Clients: {
    async find(query = {}) {
      let clients = readJsonFile('clients.json');
      if (query.status) clients = clients.filter(c => c.status === query.status);
      return clients.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    },
    async findById(id) { return readJsonFile('clients.json').find(c => c._id === id); },
    async findOne(query) { return readJsonFile('clients.json').find(c => Object.keys(query).every(k => c[k] === query[k])); },
    async create(data) {
      const clients = readJsonFile('clients.json');
      const maxNum = clients.reduce((m, c) => Math.max(m, c.client_number || 0), 0);
      const newClient = { _id: generateId(), client_number: maxNum + 1, ...data, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      clients.unshift(newClient);
      writeJsonFile('clients.json', clients);
      return newClient;
    },
    async findByIdAndUpdate(id, data) {
      let clients = readJsonFile('clients.json');
      let updated = null;
      clients = clients.map(c => { if (c._id === id) { updated = { ...c, ...data, updated_at: new Date().toISOString() }; return updated; } return c; });
      writeJsonFile('clients.json', clients);
      return updated;
    },
    async findByIdAndDelete(id) {
      let clients = readJsonFile('clients.json');
      const toDelete = clients.find(c => c._id === id);
      clients = clients.filter(c => c._id !== id);
      writeJsonFile('clients.json', clients);
      return toDelete;
    }
  },

  Projects: {
    async find(query = {}) {
      let projects = readJsonFile('projects.json');
      if (query.client_id) projects = projects.filter(p => p.client_id === query.client_id);
      if (query.status) projects = projects.filter(p => p.status === query.status);
      return projects.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    },
    async findById(id) { return readJsonFile('projects.json').find(p => p._id === id); },
    async create(data) {
      const projects = readJsonFile('projects.json');
      const maxNum = projects.reduce((m, p) => Math.max(m, p.project_number || 0), 0);
      const newProject = { _id: generateId(), project_number: maxNum + 1, ...data, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      projects.unshift(newProject);
      writeJsonFile('projects.json', projects);
      return newProject;
    },
    async findByIdAndUpdate(id, data) {
      let projects = readJsonFile('projects.json');
      let updated = null;
      projects = projects.map(p => { if (p._id === id) { updated = { ...p, ...data, updated_at: new Date().toISOString() }; return updated; } return p; });
      writeJsonFile('projects.json', projects);
      return updated;
    },
    async findByIdAndDelete(id) {
      let projects = readJsonFile('projects.json');
      const toDelete = projects.find(p => p._id === id);
      projects = projects.filter(p => p._id !== id);
      writeJsonFile('projects.json', projects);
      return toDelete;
    }
  },

  Tasks: {
    async find(query = {}) {
      let tasks = readJsonFile('tasks.json');
      if (query.project_id) tasks = tasks.filter(t => t.project_id === query.project_id);
      if (query.status) tasks = tasks.filter(t => t.status === query.status);
      return tasks;
    },
    async findById(id) { return readJsonFile('tasks.json').find(t => t._id === id); },
    async create(data) {
      const tasks = readJsonFile('tasks.json');
      const newTask = { _id: generateId(), ...data, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      tasks.push(newTask);
      writeJsonFile('tasks.json', tasks);
      return newTask;
    },
    async findByIdAndUpdate(id, data) {
      let tasks = readJsonFile('tasks.json');
      let updated = null;
      tasks = tasks.map(t => { if (t._id === id) { updated = { ...t, ...data, updated_at: new Date().toISOString() }; return updated; } return t; });
      writeJsonFile('tasks.json', tasks);
      return updated;
    },
    async findByIdAndDelete(id) {
      let tasks = readJsonFile('tasks.json');
      const toDelete = tasks.find(t => t._id === id);
      tasks = tasks.filter(t => t._id !== id);
      writeJsonFile('tasks.json', tasks);
      return toDelete;
    }
  },

  Appointments: {
    async find(query = {}) {
      let appts = readJsonFile('appointments.json');
      if (query.status) appts = appts.filter(a => a.status === query.status);
      return appts.sort((a, b) => new Date(a.appointment_date) - new Date(b.appointment_date));
    },
    async findById(id) { return readJsonFile('appointments.json').find(a => a._id === id); },
    async create(data) {
      const appts = readJsonFile('appointments.json');
      const newAppt = { _id: generateId(), ...data, created_at: new Date().toISOString() };
      appts.push(newAppt);
      writeJsonFile('appointments.json', appts);
      return newAppt;
    },
    async findByIdAndUpdate(id, data) {
      let appts = readJsonFile('appointments.json');
      let updated = null;
      appts = appts.map(a => { if (a._id === id) { updated = { ...a, ...data }; return updated; } return a; });
      writeJsonFile('appointments.json', appts);
      return updated;
    },
    async findByIdAndDelete(id) {
      let appts = readJsonFile('appointments.json');
      const toDelete = appts.find(a => a._id === id);
      appts = appts.filter(a => a._id !== id);
      writeJsonFile('appointments.json', appts);
      return toDelete;
    }
  },

  Quotations: {
    async find(query = {}) {
      let quotes = readJsonFile('quotations.json');
      if (query.client_id) quotes = quotes.filter(q => q.client_id === query.client_id);
      if (query.status) quotes = quotes.filter(q => q.status === query.status);
      return quotes.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    },
    async findById(id) { return readJsonFile('quotations.json').find(q => q._id === id); },
    async create(data) {
      const quotes = readJsonFile('quotations.json');
      const maxNum = quotes.reduce((m, q) => Math.max(m, q.quotation_number || 0), 0);
      const newQuote = { _id: generateId(), quotation_number: maxNum + 1, ...data, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      quotes.unshift(newQuote);
      writeJsonFile('quotations.json', quotes);
      return newQuote;
    },
    async findByIdAndUpdate(id, data) {
      let quotes = readJsonFile('quotations.json');
      let updated = null;
      quotes = quotes.map(q => { if (q._id === id) { updated = { ...q, ...data, updated_at: new Date().toISOString() }; return updated; } return q; });
      writeJsonFile('quotations.json', quotes);
      return updated;
    },
    async findByIdAndDelete(id) {
      let quotes = readJsonFile('quotations.json');
      const toDelete = quotes.find(q => q._id === id);
      quotes = quotes.filter(q => q._id !== id);
      writeJsonFile('quotations.json', quotes);
      return toDelete;
    }
  },

  QuotationItems: {
    async find(query = {}) {
      let items = readJsonFile('quotation_items.json');
      if (query.quotation_id) items = items.filter(i => i.quotation_id === query.quotation_id);
      return items.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    },
    async create(data) {
      const items = readJsonFile('quotation_items.json');
      const newItem = { _id: generateId(), ...data };
      items.push(newItem);
      writeJsonFile('quotation_items.json', items);
      return newItem;
    },
    async deleteByQuotationId(quotation_id) {
      let items = readJsonFile('quotation_items.json');
      items = items.filter(i => i.quotation_id !== quotation_id);
      writeJsonFile('quotation_items.json', items);
    }
  },

  Invoices: {
    async find(query = {}) {
      let invoices = readJsonFile('invoices.json');
      if (query.client_id) invoices = invoices.filter(i => i.client_id === query.client_id);
      if (query.payment_status) invoices = invoices.filter(i => i.payment_status === query.payment_status);
      return invoices.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    },
    async findById(id) { return readJsonFile('invoices.json').find(i => i._id === id); },
    async create(data) {
      const invoices = readJsonFile('invoices.json');
      const maxNum = invoices.reduce((m, i) => Math.max(m, i.invoice_number || 0), 0);
      const newInvoice = { _id: generateId(), invoice_number: maxNum + 1, ...data, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      invoices.unshift(newInvoice);
      writeJsonFile('invoices.json', invoices);
      return newInvoice;
    },
    async findByIdAndUpdate(id, data) {
      let invoices = readJsonFile('invoices.json');
      let updated = null;
      invoices = invoices.map(i => { if (i._id === id) { updated = { ...i, ...data, updated_at: new Date().toISOString() }; return updated; } return i; });
      writeJsonFile('invoices.json', invoices);
      return updated;
    },
    async findByIdAndDelete(id) {
      let invoices = readJsonFile('invoices.json');
      const toDelete = invoices.find(i => i._id === id);
      invoices = invoices.filter(i => i._id !== id);
      writeJsonFile('invoices.json', invoices);
      return toDelete;
    }
  },

  InvoiceItems: {
    async find(query = {}) {
      let items = readJsonFile('invoice_items.json');
      if (query.invoice_id) items = items.filter(i => i.invoice_id === query.invoice_id);
      return items.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    },
    async create(data) {
      const items = readJsonFile('invoice_items.json');
      const newItem = { _id: generateId(), ...data };
      items.push(newItem);
      writeJsonFile('invoice_items.json', items);
      return newItem;
    },
    async deleteByInvoiceId(invoice_id) {
      let items = readJsonFile('invoice_items.json');
      items = items.filter(i => i.invoice_id !== invoice_id);
      writeJsonFile('invoice_items.json', items);
    }
  },

  Payments: {
    async find(query = {}) {
      let payments = readJsonFile('payments.json');
      if (query.client_id) payments = payments.filter(p => p.client_id === query.client_id);
      if (query.invoice_id) payments = payments.filter(p => p.invoice_id === query.invoice_id);
      return payments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    },
    async create(data) {
      const payments = readJsonFile('payments.json');
      const newPayment = { _id: generateId(), ...data, created_at: new Date().toISOString() };
      payments.unshift(newPayment);
      writeJsonFile('payments.json', payments);
      return newPayment;
    },
    async findByIdAndDelete(id) {
      let payments = readJsonFile('payments.json');
      const toDelete = payments.find(p => p._id === id);
      payments = payments.filter(p => p._id !== id);
      writeJsonFile('payments.json', payments);
      return toDelete;
    }
  },

  Notifications: {
    async find(query = {}) {
      let notifs = readJsonFile('notifications.json');
      if (query.is_read !== undefined) notifs = notifs.filter(n => n.is_read === query.is_read);
      return notifs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    },
    async create(data) {
      const notifs = readJsonFile('notifications.json');
      const newNotif = { _id: generateId(), ...data, is_read: false, created_at: new Date().toISOString() };
      notifs.unshift(newNotif);
      // Keep only last 100 notifications
      if (notifs.length > 100) notifs.splice(100);
      writeJsonFile('notifications.json', notifs);
      return newNotif;
    },
    async findByIdAndUpdate(id, data) {
      let notifs = readJsonFile('notifications.json');
      let updated = null;
      notifs = notifs.map(n => { if (n._id === id) { updated = { ...n, ...data }; return updated; } return n; });
      writeJsonFile('notifications.json', notifs);
      return updated;
    },
    async markAllRead() {
      let notifs = readJsonFile('notifications.json');
      notifs = notifs.map(n => ({ ...n, is_read: true }));
      writeJsonFile('notifications.json', notifs);
    },
    async countUnread() {
      const notifs = readJsonFile('notifications.json');
      return notifs.filter(n => !n.is_read).length;
    }
  }
};

// ==========================================
// MONGODB WRAPPERS (TO MATCH LOCAL SIGNATURE)
// ==========================================

const MongoModels = {
  Users: {
    async find() { return UserModel.find(); },
    async findOne(query) { return UserModel.findOne(query); },
    async findById(id) { return UserModel.findById(id); },
    async create(data) { return UserModel.create(data); },
    async findByIdAndUpdate(id, data) { return UserModel.findByIdAndUpdate(id, data, { new: true }); },
    async findByIdAndDelete(id) { return UserModel.findByIdAndDelete(id); }
  },
  Services: {
    async find() {
      const services = await ServiceModel.find();
      if (services.length === 0) {
        return ServiceModel.create(DEFAULT_SERVICES);
      }
      return services;
    },
    async findById(id) { return ServiceModel.findById(id); },
    async create(data) { return ServiceModel.create(data); },
    async findByIdAndUpdate(id, data) { return ServiceModel.findByIdAndUpdate(id, data, { new: true }); },
    async findByIdAndDelete(id) { return ServiceModel.findByIdAndDelete(id); }
  },
  Portfolio: {
    async find() {
      const portfolio = await PortfolioModel.find();
      if (portfolio.length === 0) {
        return PortfolioModel.create(DEFAULT_PORTFOLIO);
      }
      return portfolio;
    },
    async create(data) { return PortfolioModel.create(data); },
    async findByIdAndDelete(id) { return PortfolioModel.findByIdAndDelete(id); }
  },
  Inquiries: {
    async find(query = {}) {
      return InquiryModel.find(query).sort({ date: -1 });
    },
    async create(data) { return InquiryModel.create(data); },
    async findByIdAndUpdate(id, data) { return InquiryModel.findByIdAndUpdate(id, data, { new: true }); },
    async findByIdAndDelete(id) { return InquiryModel.findByIdAndDelete(id); }
  },
  Tickets: {
    async find(query = {}) {
      return TicketModel.find(query).sort({ date: -1 });
    },
    async create(data) { return TicketModel.create(data); },
    async findByIdAndUpdate(id, data) { return TicketModel.findByIdAndUpdate(id, data, { new: true }); },
    async findByIdAndDelete(id) { return TicketModel.findByIdAndDelete(id); }
  },
  Settings: {
    async findOne() {
      let s = await SettingsModel.findOne();
      if (!s) {
        s = await SettingsModel.create({ checkoutEnabled: false, pricingMargin: 1.0 });
      }
      return s;
    },
    async updateOne(query, data) {
      return SettingsModel.findOneAndUpdate(query, data, { new: true, upsert: true });
    }
  },
  OfferCodes: {
    async find() {
      const codes = await OfferCodeModel.find();
      if (codes.length === 0) {
        return OfferCodeModel.create([
          { code: 'LAUNCH50', discount: 50, active: true },
          { code: 'ASCORIX10', discount: 10, active: true }
        ]);
      }
      return codes;
    },
    async findOne(query) {
      return OfferCodeModel.findOne(query);
    },
    async create(data) {
      return OfferCodeModel.create(data);
    },
    async findByIdAndDelete(id) {
      return OfferCodeModel.findByIdAndDelete(id);
    }
  },
  EmailVerification: {
    async create(data) { return EmailVerificationModel.create(data); },
    async findOne(query) { return EmailVerificationModel.findOne(query); },
    async delete(id) { return EmailVerificationModel.findByIdAndDelete(id); },
    async update(id, data) { return EmailVerificationModel.findByIdAndUpdate(id, data, { new: true }); }
  }
};

// ==========================================
// SUPABASE WRAPPERS (TO MATCH LOCAL SIGNATURE)
// ==========================================

let isSupabaseConnected = false;
let supabase = null;

const mapId = (item) => {
  if (!item) return item;
  return { ...item, _id: item.id };
};

const mapIds = (list) => {
  if (!Array.isArray(list)) return list;
  return list.map(mapId);
};

const SupabaseModels = {
  Users: {
    async find() {
      const { data, error } = await supabase.from('users').select('*');
      if (error) throw error;
      return mapIds(data);
    },
    async findOne(query) {
      let builder = supabase.from('users').select('*');
      Object.keys(query).forEach(key => {
        builder = builder.eq(key, query[key]);
      });
      const { data, error } = await builder.maybeSingle();
      if (error) throw error;
      return mapId(data);
    },
    async findById(id) {
      const { data, error } = await supabase.from('users').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return mapId(data);
    },
    async create(data) {
      const { data: created, error } = await supabase.from('users').insert(data).select().single();
      if (error) throw error;
      return mapId(created);
    },
    async findByIdAndUpdate(id, data) {
      const { data: updated, error } = await supabase.from('users').update(data).eq('id', id).select().single();
      if (error) throw error;
      return mapId(updated);
    },
    async findByIdAndDelete(id) {
      const { data: deleted, error } = await supabase.from('users').delete().eq('id', id).select().single();
      if (error) throw error;
      return mapId(deleted);
    }
  },
  Services: {
    async find() {
      const { data, error } = await supabase.from('services').select('*');
      if (error) throw error;
      return mapIds(data);
    },
    async findById(id) {
      const { data, error } = await supabase.from('services').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return mapId(data);
    },
    async create(data) {
      const { data: created, error } = await supabase.from('services').insert(data).select().single();
      if (error) throw error;
      return mapId(created);
    },
    async findByIdAndUpdate(id, data) {
      const { data: updated, error } = await supabase.from('services').update(data).eq('id', id).select().single();
      if (error) throw error;
      return mapId(updated);
    },
    async findByIdAndDelete(id) {
      const { data: deleted, error } = await supabase.from('services').delete().eq('id', id).select().single();
      if (error) throw error;
      return mapId(deleted);
    }
  },
  Portfolio: {
    async find() {
      const { data, error } = await supabase.from('portfolio').select('*');
      if (error) throw error;
      return mapIds(data);
    },
    async create(data) {
      const { data: created, error } = await supabase.from('portfolio').insert(data).select().single();
      if (error) throw error;
      return mapId(created);
    },
    async findByIdAndDelete(id) {
      const { data: deleted, error } = await supabase.from('portfolio').delete().eq('id', id).select().single();
      if (error) throw error;
      return mapId(deleted);
    },
    async findByIdAndUpdate(id, data) {
      const { data: updated, error } = await supabase.from('portfolio').update(data).eq('id', id).select().single();
      if (error) throw error;
      return mapId(updated);
    }
  },
  Inquiries: {
    async find(query = {}) {
      let builder = supabase.from('inquiries').select('*').order('date', { ascending: false });
      if (query.userId) {
        builder = builder.eq('user_id', String(query.userId));
      } else if (query.$or) {
        const conditions = query.$or.map(cond => {
          if (cond.userId) return `user_id.eq.${cond.userId}`;
          if (cond.email) return `email.eq.${cond.email}`;
          return '';
        }).filter(Boolean).join(',');
        builder = builder.or(conditions);
      }
      const { data, error } = await builder;
      if (error) throw error;
      return data.map(inq => {
        const item = mapId(inq);
        item.userId = inq.user_id;
        return item;
      });
    },
    async create(data) {
      const mapped = { ...data };
      if (data.userId !== undefined) {
        mapped.user_id = data.userId ? String(data.userId) : null;
        delete mapped.userId;
      }
      const { data: created, error } = await supabase.from('inquiries').insert(mapped).select().single();
      if (error) throw error;
      const item = mapId(created);
      item.userId = created.user_id;
      return item;
    },
    async findByIdAndUpdate(id, data) {
      const mapped = { ...data };
      if (data.userId !== undefined) {
        mapped.user_id = data.userId ? String(data.userId) : null;
        delete mapped.userId;
      }
      const { data: updated, error } = await supabase.from('inquiries').update(mapped).eq('id', id).select().single();
      if (error) throw error;
      const item = mapId(updated);
      item.userId = updated.user_id;
      return item;
    },
    async findByIdAndDelete(id) {
      const { data: deleted, error } = await supabase.from('inquiries').delete().eq('id', id).select().single();
      if (error) throw error;
      const item = mapId(deleted);
      if (deleted) item.userId = deleted.user_id;
      return item;
    }
  },
  Tickets: {
    async find(query = {}) {
      let builder = supabase.from('tickets').select('*').order('created_at', { ascending: false });
      if (query.userId) {
        builder = builder.eq('user_id', String(query.userId));
      } else if (query.$or) {
        const conditions = query.$or.map(cond => {
          if (cond.userId) return `user_id.eq.${cond.userId}`;
          if (cond.email) return `email.eq.${cond.email}`;
          return '';
        }).filter(Boolean).join(',');
        builder = builder.or(conditions);
      }
      const { data, error } = await builder;
      if (error) throw error;
      return data.map(t => {
        const item = mapId(t);
        item.userId = t.user_id;
        item.date = t.created_at;
        return item;
      });
    },
    async create(data) {
      const mapped = { ...data };
      if (data.userId !== undefined) {
        mapped.user_id = data.userId ? String(data.userId) : null;
        delete mapped.userId;
      }
      const { data: created, error } = await supabase.from('tickets').insert(mapped).select().single();
      if (error) throw error;
      const item = mapId(created);
      item.userId = created.user_id;
      item.date = created.created_at;
      return item;
    },
    async findByIdAndUpdate(id, data) {
      const mapped = { ...data };
      if (data.userId !== undefined) {
        mapped.user_id = data.userId ? String(data.userId) : null;
        delete mapped.userId;
      }
      const { data: updated, error } = await supabase.from('tickets').update(mapped).eq('id', id).select().single();
      if (error) throw error;
      const item = mapId(updated);
      item.userId = updated.user_id;
      item.date = updated.created_at;
      return item;
    },
    async findByIdAndDelete(id) {
      const { data: deleted, error } = await supabase.from('tickets').delete().eq('id', id).select().single();
      if (error) throw error;
      const item = mapId(deleted);
      if (deleted) {
        item.userId = deleted.user_id;
        item.date = deleted.created_at;
      }
      return item;
    }
  },
  Settings: {
    async findOne() {
      const { data, error } = await supabase.from('settings').select('*').eq('id', 1).maybeSingle();
      if (error) throw error;
      if (!data) {
        const { data: created, error: err2 } = await supabase.from('settings').insert({ id: 1, checkout_enabled: false, pricing_margin: 1.0 }).select().single();
        if (err2) throw err2;
        return { checkoutEnabled: created.checkout_enabled, pricingMargin: Number(created.pricing_margin), customCategories: created.custom_categories || [], upiQrCode: created.upi_qr_code || '', maintenanceMode: created.maintenance_mode || false, maintenanceBanner: created.maintenance_banner || '\uD83D\uDEA7 We are currently undergoing scheduled maintenance. We will be back shortly.' };
      }
      return { checkoutEnabled: data.checkout_enabled, pricingMargin: Number(data.pricing_margin), customCategories: data.custom_categories || [], upiQrCode: data.upi_qr_code || '', maintenanceMode: data.maintenance_mode || false, maintenanceBanner: data.maintenance_banner || '\uD83D\uDEA7 We are currently undergoing scheduled maintenance. We will be back shortly.' };
    },
    async updateOne(query, data) {
      // Build core update (always-present columns)
      const coreUpdate = {};
      if (data.checkoutEnabled !== undefined) coreUpdate.checkout_enabled = data.checkoutEnabled;
      if (data.pricingMargin !== undefined) coreUpdate.pricing_margin = data.pricingMargin;
      if (data.customCategories !== undefined) coreUpdate.custom_categories = data.customCategories;
      if (data.upiQrCode !== undefined) coreUpdate.upi_qr_code = data.upiQrCode;

      // Try to include maintenance columns — if they don't exist yet in Supabase
      // schema, save without them rather than failing the whole request.
      const maintUpdate = {};
      if (data.maintenanceMode !== undefined) maintUpdate.maintenance_mode = data.maintenanceMode;
      if (data.maintenanceBanner !== undefined) maintUpdate.maintenance_banner = data.maintenanceBanner;

      let updated;
      if (Object.keys(maintUpdate).length > 0) {
        // First try with maintenance columns included
        const { data: tryFull, error: errFull } = await supabase
          .from('settings')
          .update({ ...coreUpdate, ...maintUpdate })
          .eq('id', 1)
          .select()
          .single();

        if (errFull) {
          // If it failed because maintenance columns don't exist, fall back to core-only
          const isMissingColumn = errFull.message && (
            errFull.message.includes('maintenance_mode') ||
            errFull.message.includes('maintenance_banner') ||
            errFull.message.includes('schema cache')
          );
          if (isMissingColumn) {
            console.warn('[Settings] Maintenance columns not yet in Supabase schema. Saving core settings only. Run: ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS maintenance_mode boolean default false; ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS maintenance_banner text default \'\uD83D\uDEA7 We are currently undergoing scheduled maintenance.\'');
            const { data: coreSaved, error: errCore } = await supabase
              .from('settings')
              .update(coreUpdate)
              .eq('id', 1)
              .select()
              .single();
            if (errCore) throw errCore;
            updated = coreSaved;
          } else {
            throw errFull;
          }
        } else {
          updated = tryFull;
        }
      } else {
        const { data: saved, error: errSave } = await supabase
          .from('settings')
          .update(coreUpdate)
          .eq('id', 1)
          .select()
          .single();
        if (errSave) throw errSave;
        updated = saved;
      }

      return {
        checkoutEnabled: updated.checkout_enabled,
        pricingMargin: Number(updated.pricing_margin),
        customCategories: updated.custom_categories || [],
        upiQrCode: updated.upi_qr_code || '',
        maintenanceMode: updated.maintenance_mode || false,
        maintenanceBanner: updated.maintenance_banner || '\uD83D\uDEA7 We are currently undergoing scheduled maintenance. We will be back shortly.'
      };
    }
  },
  OfferCodes: {
    async find() {
      const { data, error } = await supabase.from('offercodes').select('*');
      if (error) throw error;
      return mapIds(data);
    },
    async findOne(query) {
      let builder = supabase.from('offercodes').select('*');
      Object.keys(query).forEach(key => {
        builder = builder.eq(key, query[key]);
      });
      const { data, error } = await builder.maybeSingle();
      if (error) throw error;
      return mapId(data);
    },
    async create(data) {
      const { data: created, error } = await supabase.from('offercodes').insert(data).select().single();
      if (error) throw error;
      return mapId(created);
    },
    async findByIdAndDelete(id) {
      const { data: deleted, error } = await supabase.from('offercodes').delete().eq('id', id).select().single();
      if (error) throw error;
      return mapId(deleted);
    }
  },
  EmailVerification: {
    async create(data) {
      const { data: created, error } = await supabase.from('email_verification').insert(data).select().single();
      if (error) throw error;
      return mapId(created);
    },
    async findOne(query) {
      let builder = supabase.from('email_verification').select('*');
      Object.keys(query).forEach(key => {
        builder = builder.eq(key, query[key]);
      });
      const { data, error } = await builder.maybeSingle();
      if (error) throw error;
      return mapId(data);
    },
    async delete(id) {
      const { data: deleted, error } = await supabase.from('email_verification').delete().eq('id', id).select().single();
      if (error) throw error;
      return mapId(deleted);
    },
    async update(id, data) {
      const { data: updated, error } = await supabase.from('email_verification').update(data).eq('id', id).select().single();
      if (error) throw error;
      return mapId(updated);
    }
  },

  // ---- BMS SUPABASE WRAPPERS ----

  Leads: {
    async find(query = {}) {
      let builder = supabase.from('leads').select('*').order('created_at', { ascending: false });
      if (query.status) builder = builder.eq('status', query.status);
      const { data, error } = await builder;
      if (error) throw error;
      return mapIds(data);
    },
    async findById(id) {
      const { data, error } = await supabase.from('leads').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return mapId(data);
    },
    async findOne(query) {
      let builder = supabase.from('leads').select('*');
      Object.keys(query).forEach(k => { builder = builder.eq(k, query[k]); });
      const { data, error } = await builder.maybeSingle();
      if (error) throw error;
      return mapId(data);
    },
    async create(data) {
      const { data: created, error } = await supabase.from('leads').insert(data).select().single();
      if (error) throw error;
      return mapId(created);
    },
    async findByIdAndUpdate(id, data) {
      const { data: updated, error } = await supabase.from('leads').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id).select().single();
      if (error) throw error;
      return mapId(updated);
    },
    async findByIdAndDelete(id) {
      const { data: deleted, error } = await supabase.from('leads').delete().eq('id', id).select().single();
      if (error) throw error;
      return mapId(deleted);
    },
    async count(query = {}) {
      let builder = supabase.from('leads').select('*', { count: 'exact', head: true });
      if (query.status) builder = builder.eq('status', query.status);
      const { count, error } = await builder;
      if (error) throw error;
      return count || 0;
    }
  },

  LeadNotes: {
    async find(query = {}) {
      let builder = supabase.from('lead_notes').select('*').order('created_at', { ascending: true });
      if (query.lead_id) builder = builder.eq('lead_id', query.lead_id);
      const { data, error } = await builder;
      if (error) throw error;
      return mapIds(data);
    },
    async create(data) {
      const { data: created, error } = await supabase.from('lead_notes').insert(data).select().single();
      if (error) throw error;
      return mapId(created);
    },
    async findByIdAndDelete(id) {
      const { data: deleted, error } = await supabase.from('lead_notes').delete().eq('id', id).select().single();
      if (error) throw error;
      return mapId(deleted);
    }
  },

  Clients: {
    async find(query = {}) {
      let builder = supabase.from('clients').select('*').order('created_at', { ascending: false });
      if (query.status) builder = builder.eq('status', query.status);
      const { data, error } = await builder;
      if (error) throw error;
      return mapIds(data);
    },
    async findById(id) {
      const { data, error } = await supabase.from('clients').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return mapId(data);
    },
    async findOne(query) {
      let builder = supabase.from('clients').select('*');
      Object.keys(query).forEach(k => { builder = builder.eq(k, query[k]); });
      const { data, error } = await builder.maybeSingle();
      if (error) throw error;
      return mapId(data);
    },
    async create(data) {
      const { data: created, error } = await supabase.from('clients').insert(data).select().single();
      if (error) throw error;
      return mapId(created);
    },
    async findByIdAndUpdate(id, data) {
      const { data: updated, error } = await supabase.from('clients').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id).select().single();
      if (error) throw error;
      return mapId(updated);
    },
    async findByIdAndDelete(id) {
      const { data: deleted, error } = await supabase.from('clients').delete().eq('id', id).select().single();
      if (error) throw error;
      return mapId(deleted);
    }
  },

  Projects: {
    async find(query = {}) {
      let builder = supabase.from('projects').select('*').order('created_at', { ascending: false });
      if (query.client_id) builder = builder.eq('client_id', query.client_id);
      if (query.status) builder = builder.eq('status', query.status);
      const { data, error } = await builder;
      if (error) throw error;
      return mapIds(data);
    },
    async findById(id) {
      const { data, error } = await supabase.from('projects').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return mapId(data);
    },
    async create(data) {
      const { data: created, error } = await supabase.from('projects').insert(data).select().single();
      if (error) throw error;
      return mapId(created);
    },
    async findByIdAndUpdate(id, data) {
      const { data: updated, error } = await supabase.from('projects').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id).select().single();
      if (error) throw error;
      return mapId(updated);
    },
    async findByIdAndDelete(id) {
      const { data: deleted, error } = await supabase.from('projects').delete().eq('id', id).select().single();
      if (error) throw error;
      return mapId(deleted);
    }
  },

  Tasks: {
    async find(query = {}) {
      let builder = supabase.from('tasks').select('*').order('created_at', { ascending: true });
      if (query.project_id) builder = builder.eq('project_id', query.project_id);
      if (query.status) builder = builder.eq('status', query.status);
      const { data, error } = await builder;
      if (error) throw error;
      return mapIds(data);
    },
    async findById(id) {
      const { data, error } = await supabase.from('tasks').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return mapId(data);
    },
    async create(data) {
      const { data: created, error } = await supabase.from('tasks').insert(data).select().single();
      if (error) throw error;
      return mapId(created);
    },
    async findByIdAndUpdate(id, data) {
      const { data: updated, error } = await supabase.from('tasks').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id).select().single();
      if (error) throw error;
      return mapId(updated);
    },
    async findByIdAndDelete(id) {
      const { data: deleted, error } = await supabase.from('tasks').delete().eq('id', id).select().single();
      if (error) throw error;
      return mapId(deleted);
    }
  },

  Appointments: {
    async find(query = {}) {
      let builder = supabase.from('appointments').select('*').order('appointment_date', { ascending: true });
      if (query.status) builder = builder.eq('status', query.status);
      const { data, error } = await builder;
      if (error) throw error;
      return mapIds(data);
    },
    async findById(id) {
      const { data, error } = await supabase.from('appointments').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return mapId(data);
    },
    async create(data) {
      const { data: created, error } = await supabase.from('appointments').insert(data).select().single();
      if (error) throw error;
      return mapId(created);
    },
    async findByIdAndUpdate(id, data) {
      const { data: updated, error } = await supabase.from('appointments').update(data).eq('id', id).select().single();
      if (error) throw error;
      return mapId(updated);
    },
    async findByIdAndDelete(id) {
      const { data: deleted, error } = await supabase.from('appointments').delete().eq('id', id).select().single();
      if (error) throw error;
      return mapId(deleted);
    }
  },

  Quotations: {
    async find(query = {}) {
      let builder = supabase.from('quotations').select('*').order('created_at', { ascending: false });
      if (query.client_id) builder = builder.eq('client_id', query.client_id);
      if (query.status) builder = builder.eq('status', query.status);
      const { data, error } = await builder;
      if (error) throw error;
      return mapIds(data);
    },
    async findById(id) {
      const { data, error } = await supabase.from('quotations').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return mapId(data);
    },
    async create(data) {
      const { data: created, error } = await supabase.from('quotations').insert(data).select().single();
      if (error) throw error;
      return mapId(created);
    },
    async findByIdAndUpdate(id, data) {
      const { data: updated, error } = await supabase.from('quotations').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id).select().single();
      if (error) throw error;
      return mapId(updated);
    },
    async findByIdAndDelete(id) {
      const { data: deleted, error } = await supabase.from('quotations').delete().eq('id', id).select().single();
      if (error) throw error;
      return mapId(deleted);
    }
  },

  QuotationItems: {
    async find(query = {}) {
      let builder = supabase.from('quotation_items').select('*').order('sort_order', { ascending: true });
      if (query.quotation_id) builder = builder.eq('quotation_id', query.quotation_id);
      const { data, error } = await builder;
      if (error) throw error;
      return mapIds(data);
    },
    async create(data) {
      const { data: created, error } = await supabase.from('quotation_items').insert(data).select().single();
      if (error) throw error;
      return mapId(created);
    },
    async deleteByQuotationId(quotation_id) {
      const { error } = await supabase.from('quotation_items').delete().eq('quotation_id', quotation_id);
      if (error) throw error;
    }
  },

  Invoices: {
    async find(query = {}) {
      let builder = supabase.from('invoices').select('*').order('created_at', { ascending: false });
      if (query.client_id) builder = builder.eq('client_id', query.client_id);
      if (query.payment_status) builder = builder.eq('payment_status', query.payment_status);
      const { data, error } = await builder;
      if (error) throw error;
      return mapIds(data);
    },
    async findById(id) {
      const { data, error } = await supabase.from('invoices').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return mapId(data);
    },
    async create(data) {
      const { data: created, error } = await supabase.from('invoices').insert(data).select().single();
      if (error) throw error;
      return mapId(created);
    },
    async findByIdAndUpdate(id, data) {
      const { data: updated, error } = await supabase.from('invoices').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id).select().single();
      if (error) throw error;
      return mapId(updated);
    },
    async findByIdAndDelete(id) {
      const { data: deleted, error } = await supabase.from('invoices').delete().eq('id', id).select().single();
      if (error) throw error;
      return mapId(deleted);
    }
  },

  InvoiceItems: {
    async find(query = {}) {
      let builder = supabase.from('invoice_items').select('*').order('sort_order', { ascending: true });
      if (query.invoice_id) builder = builder.eq('invoice_id', query.invoice_id);
      const { data, error } = await builder;
      if (error) throw error;
      return mapIds(data);
    },
    async create(data) {
      const { data: created, error } = await supabase.from('invoice_items').insert(data).select().single();
      if (error) throw error;
      return mapId(created);
    },
    async deleteByInvoiceId(invoice_id) {
      const { error } = await supabase.from('invoice_items').delete().eq('invoice_id', invoice_id);
      if (error) throw error;
    }
  },

  Payments: {
    async find(query = {}) {
      let builder = supabase.from('payments').select('*').order('created_at', { ascending: false });
      if (query.client_id) builder = builder.eq('client_id', query.client_id);
      if (query.invoice_id) builder = builder.eq('invoice_id', query.invoice_id);
      const { data, error } = await builder;
      if (error) throw error;
      return mapIds(data);
    },
    async create(data) {
      const { data: created, error } = await supabase.from('payments').insert(data).select().single();
      if (error) throw error;
      return mapId(created);
    },
    async findByIdAndDelete(id) {
      const { data: deleted, error } = await supabase.from('payments').delete().eq('id', id).select().single();
      if (error) throw error;
      return mapId(deleted);
    }
  },

  Notifications: {
    async find(query = {}) {
      let builder = supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(50);
      if (query.is_read !== undefined) builder = builder.eq('is_read', query.is_read);
      const { data, error } = await builder;
      if (error) throw error;
      return mapIds(data);
    },
    async create(data) {
      const { data: created, error } = await supabase.from('notifications').insert({ ...data, is_read: false }).select().single();
      if (error) throw error;
      return mapId(created);
    },
    async findByIdAndUpdate(id, data) {
      const { data: updated, error } = await supabase.from('notifications').update(data).eq('id', id).select().single();
      if (error) throw error;
      return mapId(updated);
    },
    async markAllRead() {
      const { error } = await supabase.from('notifications').update({ is_read: true }).eq('is_read', false);
      if (error) throw error;
    },
    async countUnread() {
      const { count, error } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('is_read', false);
      if (error) throw error;
      return count || 0;
    }
  }
};


// ==========================================
// UNIFIED EXPORTS & CONNECT
// ==========================================

async function dbConnect() {
  const config = getDbConfig();
  const provider = config.provider;
  const supabaseUrl = config.supabaseUrl;
  const supabaseKey = config.supabaseKey;
  const mongoUri = config.mongoUri;

  if (provider === 'supabase' && supabaseUrl && supabaseUrl.trim() !== "" && supabaseKey && supabaseKey.trim() !== "") {
    try {
      console.log("Attempting database sync with external Supabase Cloud...");
      supabase = createClient(supabaseUrl, supabaseKey);
      
      // Test select statement to verify connection
      const { data, error } = await supabase.from('settings').select('*').limit(1);
      if (error) throw error;
      
      isSupabaseConnected = true;
      console.log("SUCCESS: Connected to Supabase Cloud database instance.");
      
      // Ensure seed records exist
      await SupabaseModels.Settings.findOne();
      await SupabaseModels.OfferCodes.find();
    } catch (err) {
      console.warn("DATABASE ERROR: Supabase connection failed. Cause:", err.message);
      console.warn("Please run the schema in supabase_schema.sql inside your Supabase SQL Editor.");
      console.warn("FALLBACK ENABLED: Loading server-side local storage engine.");
      isSupabaseConnected = false;
      
      // Pre-seed local files
      await LocalDB.Services.find();
      await LocalDB.Portfolio.find();
      await LocalDB.Settings.findOne();
      await LocalDB.OfferCodes.find();
    }
  } else if (provider === 'mongodb' && mongoUri && mongoUri.trim() !== "") {
    try {
      console.log("Attempting database sync with external MongoDB Cloud...");
      await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 5000
      });
      isMongoConnected = true;
      console.log("SUCCESS: Synchronized with external MongoDB Cloud Instance.");
      
      // Initialize schemas
      UserModel = mongoose.model('User', userSchema);
      ServiceModel = mongoose.model('Service', serviceSchema);
      PortfolioModel = mongoose.model('Portfolio', portfolioSchema);
      InquiryModel = mongoose.model('Inquiry', inquirySchema);
      SettingsModel = mongoose.model('Settings', settingsSchema);
      OfferCodeModel = mongoose.model('OfferCode', offerCodeSchema);
      EmailVerificationModel = mongoose.model('EmailVerification', emailVerificationSchema);
      
      // Seed if empty
      await MongoModels.Services.find();
      await MongoModels.Portfolio.find();
      await MongoModels.Settings.findOne();
      await MongoModels.OfferCodes.find();
    } catch (err) {
      console.warn("DATABASE ERROR: External connection failed. Cause:", err.message);
      console.warn("FALLBACK ENABLED: Loading server-side local storage engine.");
      isMongoConnected = false;
      // Pre-seed local files
      await LocalDB.Services.find();
      await LocalDB.Portfolio.find();
      await LocalDB.Settings.findOne();
      await LocalDB.OfferCodes.find();
    }
  } else if (provider === 'mysql' && config.host && config.database) {
    try {
      console.log("Attempting database sync with Hostinger MySQL Database...");
      // await initMysql(); // Will be enabled during actual migration
      console.log("SUCCESS (Mock): Connected to Hostinger MySQL Database.");
      isMysqlConnected = true;
      // MysqlModels will be returned from db()
    } catch (err) {
      console.warn("DATABASE ERROR: MySQL connection failed. Cause:", err.message);
      console.warn("FALLBACK ENABLED: Loading server-side local storage engine.");
      isMysqlConnected = false;
      await LocalDB.Services.find();
      await LocalDB.Portfolio.find();
      await LocalDB.Settings.findOne();
      await LocalDB.OfferCodes.find();
    }
  } else {
    console.log("CONFIG NOTICE: External DB credentials not detected in environment.");
    console.log("FALLBACK ENABLED: Loading server-side local storage engine.");
    isMongoConnected = false;
    isSupabaseConnected = false;
    // Pre-seed local files
    await LocalDB.Services.find();
    await LocalDB.Portfolio.find();
    await LocalDB.Settings.findOne();
    await LocalDB.OfferCodes.find();
  }
}

module.exports = {
  dbConnect,
  getDbConfig,
  updateDbConfig,
  getSupabase: () => supabase,
  isSupabaseConnected: () => isSupabaseConnected,
  isMongoConnected: () => isMongoConnected,
  isMysqlConnected: () => isMysqlConnected,
  db: () => {
    // if (isMysqlConnected) return MysqlModels; // To be implemented
    if (isSupabaseConnected) return SupabaseModels;
    return isMongoConnected ? MongoModels : LocalDB;
  }
};
