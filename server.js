// server.js - Premium Express Web Server & API Layer for ASCORIX Tech Solutions
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const https = require('https');
const fs = require('fs');
const fileUpload = require('express-fileupload');
const AdmZip = require('adm-zip');
const { dbConnect, db } = require('./dbServer');

// Configure SMTP transport (Gmail SMTP)
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.GMAIL_USER || process.env.EMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD || process.env.EMAIL_PASS
  }
});

// Configure separate transport for Quotations and Invoices (defaults to ascorixtechsolutions@gmail.com if configured)
const bmsTransporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.BMS_EMAIL_USER || process.env.GMAIL_USER || process.env.EMAIL_USER,
    pass: process.env.BMS_EMAIL_PASS || process.env.GMAIL_APP_PASSWORD || process.env.EMAIL_PASS
  }
});

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not configured.");
}

// Parse application/json and enable CORS
app.use(express.json());
app.use(cors());

// ==========================================
// SMART CACHING MIDDLEWARE
// Static assets: 1hr cache (boosts Core Web Vitals)
// API & HTML: always fresh (no-cache)
// ==========================================
app.use((req, res, next) => {
  const staticExtensions = /\.(css|js|png|jpg|jpeg|svg|ico|woff|woff2|ttf|webp|gif)$/i;
  if (staticExtensions.test(req.path)) {
    // Cache static assets for 1 hour — improves PageSpeed & Core Web Vitals score
    res.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
  } else if (req.path.startsWith('/api/')) {
    // Never cache API responses
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  } else {
    // HTML pages: revalidate on every load
    res.set('Cache-Control', 'no-cache, must-revalidate');
  }
  next();
});

// ==========================================
// SEO & SECURITY HEADERS MIDDLEWARE
// Security headers are a Google ranking signal
// ==========================================
app.use((req, res, next) => {
  // Prevent MIME type sniffing (security + SEO trust signal)
  res.set('X-Content-Type-Options', 'nosniff');
  // Prevent clickjacking
  res.set('X-Frame-Options', 'SAMEORIGIN');
  // XSS protection for older browsers
  res.set('X-XSS-Protection', '1; mode=block');
  // Control referrer information (privacy-compliant)
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Permissions policy (limit browser feature access)
  res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  // Tell search engines this is the canonical origin
  if (req.path === '/' || req.path === '/index.html') {
    res.set('Link', '<https://www.ascorixtechsolutions.com/>; rel="canonical"');
  }
  next();
});

// Configure File Upload Middleware
app.use(fileUpload({
  createParentPath: true,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
}));

// ==========================================
// SEO FILES — Explicit routes for crawlers
// ==========================================

// Serve robots.txt from root
app.get('/robots.txt', (req, res) => {
  const robotsPath = path.join(__dirname, 'robots.txt');
  if (fs.existsSync(robotsPath)) {
    res.set('Content-Type', 'text/plain');
    res.set('Cache-Control', 'public, max-age=86400'); // 24hr cache
    res.sendFile(robotsPath);
  } else {
    res.set('Content-Type', 'text/plain');
    res.send('User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin/');
  }
});

// Serve sitemap.xml from root
app.get('/sitemap.xml', (req, res) => {
  const sitemapPath = path.join(__dirname, 'sitemap.xml');
  if (fs.existsSync(sitemapPath)) {
    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=86400'); // 24hr cache
    res.sendFile(sitemapPath);
  } else {
    res.status(404).send('Sitemap not found');
  }
});

// Dynamic Subdomain Demo Hosting Middleware
app.use((req, res, next) => {
  const host = req.headers.host || '';
  const parts = host.split('.');
  
  let subdomain = '';
  if (parts.length > 1) {
    const lastPart = parts[parts.length - 1].toLowerCase();
    if (lastPart.startsWith('localhost')) {
      if (parts.length > 1 && parts[0].toLowerCase() !== 'localhost' && parts[0].toLowerCase() !== 'www') {
        subdomain = parts[0].toLowerCase();
      }
    } else {
      if (parts.length >= 3 && parts[0].toLowerCase() !== 'www') {
        subdomain = parts[0].toLowerCase();
      }
    }
  }

  if (subdomain) {
    const projectDir = path.join(__dirname, 'uploads', 'projects', subdomain);
    if (fs.existsSync(projectDir)) {
      return express.static(projectDir)(req, res, next);
    }
  }
  next();
});

// ==========================================
// MAINTENANCE MODE MIDDLEWARE
// MUST run BEFORE express.static so it can intercept page requests
// before index.html is served by the static handler.
// Static assets (CSS/JS/images) are always allowed through.
// Admin routes and API routes are always allowed through.
// ==========================================
app.use(async (req, res, next) => {
  try {
    // Always allow: API routes, admin panel, static assets, crawl files
    const isApi = req.path.startsWith('/api/');
    const isAdmin = req.path.startsWith('/admin') || req.path.includes('admin-portal');
    const isStaticAsset = /\.(css|js|png|jpg|jpeg|svg|ico|woff|woff2|ttf|webp|gif|json|map|txt|xml)$/i.test(req.path);

    if (isApi || isAdmin || isStaticAsset) {
      return next();
    }

    // Cache settings for 15 seconds to prevent DB hammering on rapid refresh
    const now = Date.now();
    if (!global.cachedSettings || (now - global.lastSettingsFetch) > 15000) {
      try { 
        global.cachedSettings = await db().Settings.findOne(); 
        global.lastSettingsFetch = now;
      } catch (e) {}
    }

    const settings = global.cachedSettings;

    if (settings && settings.maintenanceMode === true) {
      const banner = settings.maintenanceBanner || '\uD83D\uDEA7 We are currently undergoing scheduled maintenance. We will be back shortly. Thank you for your patience.';
      return res.status(503).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Maintenance \u2013 ASCORIX TECH SOLUTIONS</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; font-family: 'Inter', sans-serif; }
    body {
      min-height: 100vh;
      background: radial-gradient(ellipse at 50% 0%, #0f1b3d 0%, #060c1a 60%, #030610 100%);
      display: flex; align-items: center; justify-content: center;
      color: #e2e8f0;
      padding: 24px;
    }
    .card {
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(99,179,237,0.2);
      border-radius: 20px;
      padding: 56px 48px;
      max-width: 560px;
      width: 100%;
      text-align: center;
      backdrop-filter: blur(12px);
      box-shadow: 0 25px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.07);
    }
    .logo {
      width: 72px; height: 72px;
      background: linear-gradient(135deg, #3b82f6, #6366f1);
      border-radius: 16px;
      display: inline-flex; align-items: center; justify-content: center;
      font-size: 28px; font-weight: 900; color: #fff;
      margin-bottom: 28px;
      box-shadow: 0 8px 32px rgba(99,102,241,0.45);
    }
    .badge {
      display: inline-flex; align-items: center; gap: 8px;
      background: rgba(239,68,68,0.12);
      border: 1px solid rgba(239,68,68,0.3);
      color: #f87171;
      border-radius: 999px;
      padding: 6px 16px;
      font-size: 12px; font-weight: 600;
      letter-spacing: 0.06em; text-transform: uppercase;
      margin-bottom: 24px;
    }
    .pulse { width: 8px; height: 8px; border-radius: 50%; background: #f87171; animation: pulse 1.5s infinite; display: inline-block; }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.85); }
    }
    h1 { font-size: 28px; font-weight: 800; margin-bottom: 16px; color: #f1f5f9; line-height: 1.3; }
    p { font-size: 15px; line-height: 1.75; color: #94a3b8; margin-bottom: 32px; }
    .progress-bar {
      width: 100%; height: 4px;
      background: rgba(255,255,255,0.08);
      border-radius: 99px; overflow: hidden; margin-bottom: 32px;
    }
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #3b82f6, #6366f1, #8b5cf6);
      border-radius: 99px;
      animation: progress 3s ease-in-out infinite alternate;
    }
    @keyframes progress { from { width: 20%; } to { width: 85%; } }
    .footer { font-size: 12px; color: #475569; }
    .footer a { color: #60a5fa; text-decoration: none; }
    .footer a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">AX</div>
    <div class="badge"><span class="pulse"></span> Maintenance Mode</div>
    <h1>\uD83D\uDEA7 We'll Be Right Back</h1>
    <p>${banner.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
    <div class="progress-bar"><div class="progress-fill"></div></div>
    <div class="footer">
      Need urgent help? <a href="mailto:contact@ascorixtechsolutions.com">contact@ascorixtechsolutions.com</a>
    </div>
  </div>
</body>
</html>`);
    }
  } catch (e) {
    // If settings can't be fetched, allow through — don't block on DB errors
  }
  next();
});

// Serve static client assets from the workspace folder
// (placed AFTER maintenance middleware so HTML pages can be intercepted)
app.use(express.static(__dirname));

// ==========================================
// AUTHENTICATION & AUTHORIZATION MIDDLEWARE
// ==========================================

async function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: "Access denied. Auth token required." });
  }

  try {
    const verified = jwt.verify(token, JWT_SECRET);
    const user = await db().Users.findById(verified.id);
    if (!user) {
      return res.status(404).json({ error: "Authenticated user not found." });
    }

    // Attach user (without password) to request
    req.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      verification_token: user.verification_token
    };
    next();
  } catch (err) {
    res.status(403).json({ error: "Invalid or expired authorization token." });
  }
}

function adminMiddleware(reqOrPermission, res, next) {
  // If called directly as middleware: adminMiddleware(req, res, next)
  if (res && typeof next === 'function') {
    const req = reqOrPermission;
    console.log(`[ADMIN CHECK] Path: ${req.path}, Method: ${req.method}`);
    console.log(`  User details:`, req.user);
    if (!req.user || !req.user.role || !req.user.role.startsWith('admin')) {
      console.warn(`  REJECTED: User is not an admin!`);
      return res.status(403).json({ error: "Access denied. Administrator privileges required." });
    }
    console.log(`  GRANTED: User has admin role.`);
    return next();
  }

  // Otherwise, it was called as adminMiddleware('permission') returning a middleware factory
  const requiredPermission = reqOrPermission;
  return (req, res, next) => {
    console.log(`[ADMIN CHECK] Path: ${req.path}, Method: ${req.method}`);
    console.log(`  User details:`, req.user);
    if (!req.user || !req.user.role || !req.user.role.startsWith('admin')) {
      console.warn(`  REJECTED: User is not an admin!`);
      return res.status(403).json({ error: "Access denied. Administrator privileges required." });
    }
    if (req.user.role === 'admin') {
      console.log(`  GRANTED: Super Admin.`);
      return next();
    }
    const permissions = req.user.role.includes(':') ? req.user.role.split(':')[1].split(',') : [];
    if (requiredPermission && !permissions.includes(requiredPermission)) {
      console.warn(`  REJECTED: User lacks required permission '${requiredPermission}'!`);
      return res.status(403).json({ error: `Access denied. Lack of '${requiredPermission}' permission.` });
    }
    console.log(`  GRANTED: Sub-Admin with permission '${requiredPermission}'.`);
    next();
  };
}

// ==========================================
// USER AUTHENTICATION ENDPOINTS
// ==========================================

const verificationAttempts = {};
const ATTEMPTS_LIMIT = 5;
const LOCKOUT_TIME = 15 * 60 * 1000;

function checkVerificationLockout(email) {
  const attempt = verificationAttempts[email];
  if (attempt && attempt.lockUntil && new Date() < new Date(attempt.lockUntil)) {
    return true;
  }
  return false;
}

function recordFailedAttempt(email) {
  if (!verificationAttempts[email]) {
    verificationAttempts[email] = { count: 0, lockUntil: null };
  }
  verificationAttempts[email].count += 1;
  if (verificationAttempts[email].count >= ATTEMPTS_LIMIT) {
    verificationAttempts[email].lockUntil = new Date(Date.now() + LOCKOUT_TIME);
  }
}

function resetAttempts(email) {
  delete verificationAttempts[email];
}

// Remote error logging endpoint for mobile debugging
app.post('/api/log-error', (req, res) => {
  console.error('\n--- REMOTE CLIENT ERROR ---');
  console.error('Message:', req.body.message);
  console.error('Source:', req.body.source);
  console.error('Line:', req.body.lineno, 'Col:', req.body.colno);
  console.error('Stack:', req.body.error);
  console.error('---------------------------\n');
  res.sendStatus(200);
});

// Register Account
app.post('/api/auth/register', async (req, res) => {
  let newUser = null;
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password || !phone) {
      return res.status(400).json({ error: "Missing required registration parameters (Name, Email, Mobile Number, Password)." });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanPhone = phone.trim();

    const existingEmail = await db().Users.findOne({ email: cleanEmail });
    if (existingEmail) {
      return res.status(400).json({ error: "Email address is already registered." });
    }

    const existingPhone = await db().Users.findOne({ phone: cleanPhone });
    if (existingPhone) {
      return res.status(400).json({ error: "Mobile number is already registered to another account." });
    }

    // Force role to client for public registration
    const userRole = 'client';

    // Hash passcode securely
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(password, salt);

    // Create user in disabled/unverified state
    newUser = await db().Users.create({
      name,
      email: cleanEmail,
      phone: cleanPhone,
      password: hashedPassword,
      role: userRole,
      is_verified: false,
      verification_token: null
    });

    // Generate random 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store in Supabase/LocalDB email_verification
    await db().EmailVerification.create({
      email: cleanEmail,
      otp: otpCode,
      verified: false,
      expires_at: expiresAt.toISOString()
    });

    // Send using Nodemailer
    const mailOptions = {
      from: `"Verify Your Email Address" <${process.env.GMAIL_USER || process.env.EMAIL_USER}>`,
      to: cleanEmail,
      subject: "Verify Your Email Address",
      text: `Your verification code is: ${otpCode}\n\nThis code expires in 10 minutes.\n\nIf you did not request this account, please ignore this email.`
    };

    await transporter.sendMail(mailOptions);

    res.status(201).json({
      message: "Registration completed successfully. Verification OTP dispatched.",
      user: {
        id: (newUser.id || newUser._id).toString(),
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone,
        role: newUser.role
      }
    });
  } catch (err) {
    if (newUser) {
      try {
        await db().Users.findByIdAndDelete(newUser.id || newUser._id);
      } catch (e) {}
    }
    res.status(500).json({ error: `Registration failed: ${err.message}` });
  }
});

// Verify OTP
app.post('/api/auth/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ error: "Email and OTP code are required." });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check attempts limit
    if (checkVerificationLockout(cleanEmail)) {
      return res.status(429).json({ error: "Too many failed attempts. Account verification locked. Please try again in 15 minutes." });
    }

    // Retrieve active OTP record
    const record = await db().EmailVerification.findOne({ email: cleanEmail, verified: false });
    if (!record || record.otp !== otp.trim()) {
      recordFailedAttempt(cleanEmail);
      return res.status(400).json({ error: "Invalid verification code." });
    }

    // Check expiration
    if (new Date() > new Date(record.expires_at)) {
      return res.status(400).json({ error: "Verification code has expired. Please request a new one." });
    }

    // Mark as verified on OTP table
    await db().EmailVerification.update(record.id || record._id, { verified: true });

    // Mark user as verified
    const user = await db().Users.findOne({ email: cleanEmail });
    if (user) {
      await db().Users.findByIdAndUpdate(user.id || user._id, { is_verified: true });
    }

    // Delete/invalidate OTP records for this email
    try {
      await db().EmailVerification.delete(record.id || record._id);
    } catch (e) {}

    resetAttempts(cleanEmail);

    res.json({ message: "Verification successful! Account activated." });
  } catch (err) {
    res.status(500).json({ error: `Verification failed: ${err.message}` });
  }
});

// Resend OTP
app.post('/api/auth/resend-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email is required." });
    }

    const cleanEmail = email.toLowerCase().trim();

    const user = await db().Users.findOne({ email: cleanEmail });
    if (!user) {
      return res.status(404).json({ error: "Account not found." });
    }

    if (user.is_verified) {
      return res.status(400).json({ error: "This email address is already verified." });
    }

    // Check for resend cooldown (60 seconds)
    const lastRecord = await db().EmailVerification.findOne({ email: cleanEmail, verified: false });
    if (lastRecord && lastRecord.created_at) {
      const createdTime = new Date(lastRecord.created_at).getTime();
      const diffSeconds = (Date.now() - createdTime) / 1000;
      if (diffSeconds < 60) {
        return res.status(429).json({ error: `Please wait ${Math.ceil(60 - diffSeconds)} seconds before requesting another code.` });
      }
    }

    // Generate new OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Delete prior unverified codes to prevent overlap
    if (lastRecord) {
      try {
        await db().EmailVerification.delete(lastRecord.id || lastRecord._id);
      } catch (e) {}
    }

    // Store in Supabase/LocalDB
    await db().EmailVerification.create({
      email: cleanEmail,
      otp: otpCode,
      verified: false,
      expires_at: expiresAt.toISOString()
    });

    // Send Nodemailer
    const mailOptions = {
      from: `"Verify Your Email Address" <${process.env.GMAIL_USER || process.env.EMAIL_USER}>`,
      to: cleanEmail,
      subject: "Verify Your Email Address",
      text: `Your verification code is: ${otpCode}\n\nThis code expires in 10 minutes.\n\nIf you did not request this account, please ignore this email.`
    };

    await transporter.sendMail(mailOptions);

    res.json({ message: "A new verification code has been dispatched." });
  } catch (err) {
    res.status(500).json({ error: `Resend failed: ${err.message}` });
  }
});

// Login Credentials Verification (Clients Only)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await db().Users.findOne({ email: cleanEmail });
    if (!user) {
      return res.status(401).json({ error: "Incorrect email or password credentials." });
    }

    // Admin Account rejection on client portal
    if (user.role === 'admin') {
      return res.status(403).json({ error: "Admin accounts cannot login to client portal. Please use the Admin Portal." });
    }

    const isMatch = bcrypt.compareSync(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Incorrect email or password credentials." });
    }

    // Verify email verification status
    if (user.is_verified === false) {
      return res.status(401).json({ error: "Please verify your email address to log in." });
    }

    // Verify user is not banned
    if (user.is_banned === true) {
      return res.status(403).json({ error: "Access denied. Your account has been suspended." });
    }

    // Generate JWT Access Token
    const token = jwt.sign({ id: user._id.toString(), role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      message: "Access granted.",
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        role: user.role
      }
    });
  } catch (err) {
    res.status(500).json({ error: `Login failed: ${err.message}` });
  }
});

// Dedicated Administrator Login Endpoint
app.post('/api/auth/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await db().Users.findOne({ email: cleanEmail });
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: "Access denied. Administrator privileges required." });
    }

    const isMatch = bcrypt.compareSync(password, user.password);
    if (!isMatch) {
      return res.status(403).json({ error: "Access denied. Administrator privileges required." });
    }

    // Verify user is not banned
    if (user.is_banned === true) {
      return res.status(403).json({ error: "Access denied. Your account has been suspended." });
    }

    // Generate JWT Access Token
    const token = jwt.sign({ id: user._id.toString(), role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      message: "Access granted.",
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        role: user.role
      }
    });
  } catch (err) {
    res.status(500).json({ error: `Login failed: ${err.message}` });
  }
});

// Profile validation endpoint
app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

// ==========================================
// CORE CATALOG SERVICES ENDPOINTS (CRUD)
// ==========================================

// Get Services Catalog
app.get('/api/services', async (req, res) => {
  try {
    const services = await db().Services.find();
    res.json(services);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create Service Listing (Admin)
app.post('/api/services', authMiddleware, adminMiddleware('manage_services'), async (req, res) => {
  try {
    const { title, description, cost, category, icon, original_price, discount_percent, discount_reason } = req.body;
    if (!title || !description || !cost || !category) {
      return res.status(400).json({ error: "Missing required service parameters." });
    }

    const newService = await db().Services.create({
      title, description, cost, category, icon: icon || 'code',
      original_price: Number(original_price) || 0,
      discount_percent: Number(discount_percent) || 0,
      discount_reason: discount_reason || ''
    });
    res.status(201).json(newService);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Modify Service Specification (Admin)
app.put('/api/services/:id', authMiddleware, adminMiddleware('manage_services'), async (req, res) => {
  try {
    const { title, description, cost, category, icon, original_price, discount_percent, discount_reason } = req.body;
    const updated = await db().Services.findByIdAndUpdate(req.params.id, {
      title, description, cost, category, icon,
      original_price: Number(original_price) || 0,
      discount_percent: Number(discount_percent) || 0,
      discount_reason: discount_reason || ''
    });
    if (!updated) {
      return res.status(404).json({ error: "Service listing not found." });
    }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Service Listing (Admin)
app.delete('/api/services/:id', authMiddleware, adminMiddleware('manage_services'), async (req, res) => {
  try {
    const deleted = await db().Services.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Service listing not found." });
    }
    res.json({ message: "Service deleted successfully.", deleted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// CASE STUDIES / PORTFOLIO ENDPOINTS
// ==========================================

// Upload Demo ZIP Endpoint (Admin)
app.post('/api/portfolio/upload-demo', authMiddleware, adminMiddleware('manage_services'), async (req, res) => {
  try {
    if (!req.files || !req.files.zipFile) {
      return res.status(400).json({ error: "No ZIP file uploaded." });
    }
    const { slug } = req.body;
    if (!slug) {
      return res.status(400).json({ error: "Missing project slug." });
    }

    const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '');
    if (!cleanSlug) {
      return res.status(400).json({ error: "Invalid project slug." });
    }

    const zipFile = req.files.zipFile;
    const projectDir = path.join(__dirname, 'uploads', 'projects', cleanSlug);

    // Ensure upload directory is clean
    if (fs.existsSync(projectDir)) {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
    fs.mkdirSync(projectDir, { recursive: true });

    // Load zip from memory buffer
    const zip = new AdmZip(zipFile.data);
    zip.extractAllTo(projectDir, true);

    // Generate dynamic subdomain URL
    const host = req.headers.host || `localhost:${PORT}`;
    const hostParts = host.split(':');
    const portSuffix = hostParts[1] ? `:${hostParts[1]}` : '';
    const cleanHost = hostParts[0];

    let demoUrl = '';
    if (cleanHost.includes('localhost')) {
      demoUrl = `http://${cleanSlug}.localhost${portSuffix}`;
    } else {
      // Parse main domain (e.g. ascorix.com)
      const domainParts = cleanHost.split('.');
      if (domainParts.length >= 2) {
        const domain = domainParts.slice(-2).join('.');
        demoUrl = `http://${cleanSlug}.${domain}${portSuffix}`;
      } else {
        demoUrl = `http://${cleanSlug}.${cleanHost}${portSuffix}`;
      }
    }

    res.json({ message: "ZIP extracted successfully.", demoUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Portfolio Items
app.get('/api/portfolio', async (req, res) => {
  try {
    const portfolio = await db().Portfolio.find();
    res.json(portfolio);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add Portfolio Item (Admin)
app.post('/api/portfolio', authMiddleware, adminMiddleware('manage_services'), async (req, res) => {
  try {
    console.log("PORTFOLIO POST req.body:", req.body);
    const { title, description, category, tech, image } = req.body;
    if (!title || !description || !category || !image) {
      return res.status(400).json({ error: "Missing required portfolio item parameters." });
    }

    const newItem = await db().Portfolio.create({
      title, description, category, tech: tech || [], image
    });
    res.status(201).json(newItem);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Portfolio Item (Admin)
app.put('/api/portfolio/:id', authMiddleware, adminMiddleware('manage_services'), async (req, res) => {
  try {
    console.log("PORTFOLIO PUT req.body:", req.body);
    const { title, description, category, tech, image } = req.body;
    if (!title || !description || !category || !image) {
      return res.status(400).json({ error: "Missing required portfolio item parameters." });
    }

    const updated = await db().Portfolio.findByIdAndUpdate(req.params.id, {
      title, description, category, tech: tech || [], image
    });
    if (!updated) {
      return res.status(404).json({ error: "Portfolio item not found." });
    }
    res.json({ message: "Portfolio item updated.", updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Duplicate Portfolio Item (Admin)
app.post('/api/portfolio/:id/duplicate', authMiddleware, adminMiddleware('manage_services'), async (req, res) => {
  try {
    const list = await db().Portfolio.find();
    const item = list.find(p => String(p._id || p.id) === req.params.id);
    if (!item) {
      return res.status(404).json({ error: "Portfolio item not found." });
    }
    const title = "Copy of " + item.title;
    
    let description = item.description;
    try {
      const parsed = JSON.parse(item.description);
      parsed.title = title;
      if (parsed.slug) {
        parsed.slug = parsed.slug + "-copy";
      }
      description = JSON.stringify(parsed);
    } catch (e) {}

    const duplicated = await db().Portfolio.create({
      title,
      description,
      category: item.category,
      tech: item.tech || [],
      image: item.image
    });
    res.status(201).json(duplicated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Portfolio Item (Admin)
app.delete('/api/portfolio/:id', authMiddleware, adminMiddleware('manage_services'), async (req, res) => {
  try {
    const deleted = await db().Portfolio.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Portfolio item not found." });
    }
    res.json({ message: "Portfolio item deleted.", deleted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// CONSULTATION CLIENT INQUIRIES ENDPOINTS
// ==========================================

// Get Inquiries (Admin gets all, client gets only their own)
app.get('/api/inquiries', authMiddleware, async (req, res) => {
  try {
    let inquiries;
    if (req.user.role.startsWith('admin')) {
      const perms = req.user.role === 'admin' ? ['manage_inbox'] : (req.user.role.includes(':') ? req.user.role.split(':')[1].split(',') : []);
      if (!perms.includes('manage_inbox')) {
        return res.status(403).json({ error: "Access denied. Lack of 'manage_inbox' permission." });
      }
      inquiries = await db().Inquiries.find();
    } else {
      // Find inquiries by current user ID or current user's email
      inquiries = await db().Inquiries.find({
        $or: [
          { userId: req.user.id },
          { email: req.user.email }
        ]
      });

      // Fallback check if MongoDB queries aren't matching
      if (!Array.isArray(inquiries)) {
        inquiries = await db().Inquiries.find({ userId: req.user.id });
      }
    }
    res.json(inquiries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper to send real-time alerts to the owner's WhatsApp
function sendWhatsAppNotification(text) {
  const ownerNumber = process.env.OWNER_WHATSAPP_NUMBER;
  if (!ownerNumber || ownerNumber.includes("XXXXXXXXXX")) {
    console.log("[WHATSAPP MOCK] No valid OWNER_WHATSAPP_NUMBER set. Notification content:\n", text);
    return;
  }

  const callMeBotKey = process.env.CALLMEBOT_API_KEY;
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom = process.env.TWILIO_FROM_WHATSAPP || 'whatsapp:+14155238886';

  if (callMeBotKey && callMeBotKey.trim() !== "") {
    const encodedText = encodeURIComponent(text);
    const cleanPhone = ownerNumber.replace('+', '').trim();
    const url = `https://api.callmebot.com/whatsapp.php?phone=${cleanPhone}&text=${encodedText}&apikey=${callMeBotKey}`;
    https.get(url, (res) => {
      console.log(`[WHATSAPP] CallMeBot dispatch status code: ${res.statusCode}`);
    }).on('error', (e) => {
      console.error("[WHATSAPP] CallMeBot failed:", e.message);
    });
  } else if (twilioSid && twilioToken) {
    const encodedMessage = `To=${encodeURIComponent('whatsapp:' + ownerNumber)}&From=${encodeURIComponent(twilioFrom)}&Body=${encodeURIComponent(text)}`;
    const options = {
      hostname: 'api.twilio.com',
      port: 443,
      path: `/2010-04-01/Accounts/${twilioSid}/Messages.json`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64'),
        'Content-Length': Buffer.byteLength(encodedMessage)
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        console.log(`[WHATSAPP] Twilio dispatch status: ${res.statusCode}`);
      });
    });
    req.on('error', (e) => {
      console.error("[WHATSAPP] Twilio failed:", e.message);
    });
    req.write(encodedMessage);
    req.end();
  } else {
    console.log("[WHATSAPP MOCK] No Twilio or CallMeBot API keys configured. Message to owner:\n", text);
  }
}

// Submit Inquiry (Public or Authenticated User)
app.post('/api/inquiries', async (req, res) => {
  try {
    const { name, email, service, message, phone, businessName, businessType, contactMethod } = req.body;
    if (!name || !email || !service) {
      return res.status(400).json({ error: "Missing required inquiry fields." });
    }

    let userId = null;
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      try {
        const verified = jwt.verify(token, JWT_SECRET);
        userId = verified.id;
      } catch (err) {
        // Token invalid, submit as guest/anonymous
      }
    }

    let structuredMessage = message || "";
    if (phone || businessName || businessType || contactMethod) {
      structuredMessage = `Phone/WhatsApp: ${phone || '—'}\nBusiness Name: ${businessName || '—'}\nBusiness Type: ${businessType || '—'}\nPreferred Contact: ${contactMethod || '—'}\n\nScope details:\n${message || '—'}`;
    }

    const newInquiry = await db().Inquiries.create({
      userId,
      name,
      email: email.toLowerCase().trim(),
      service,
      message: structuredMessage,
      status: 'Pending'
    });

    // Automatically create a CRM Lead
    try {
      await db().Leads.create({
        name,
        company_name: businessName || '',
        email: email.toLowerCase().trim(),
        phone: phone || '',
        whatsapp: phone || '',
        service: service,
        message: message || '',
        lead_source: 'Website Form',
        status: 'New',
        priority: 'Medium'
      });
      // Create system notification
      await db().Notifications.create({
        title: 'New Lead Arrives',
        message: `New website inquiry from ${name} for ${service}`,
        type: 'lead',
        link: '/admin#crm'
      });
    } catch (leadErr) {
      console.error("[BMS] Auto-lead creation failed:", leadErr.message);
    }

    // Dispatch notifications to owner (for all inquiries: registered and guest)
    const adminEmail = process.env.GMAIL_USER || process.env.EMAIL_USER;
    const ownerEmail = process.env.OWNER_EMAIL || 'ascorixtechsolutions@gmail.com';
    
    if (adminEmail) {
      const isRegistered = userId ? "Registered Client" : "Guest User";
      const subjectTag = userId ? "REGISTERED CONSULTATION" : "GUEST INQUIRY";
      const mailOptions = {
        from: adminEmail,
        to: ownerEmail,
        subject: `🚨 [NEW ${subjectTag}] - ${name}`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; border: 1px solid #ddd; border-radius: 8px;">
            <h2 style="color: #06b2d4; border-bottom: 2px solid #06b2d4; padding-bottom: 10px;">New ${isRegistered} Consultation</h2>
            <p>A user has submitted a new project consultation inquiry from the website.</p>
            <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
              <tr>
                <td style="padding: 8px; font-weight: bold; width: 180px; background: #f9f9f9; border-bottom: 1px solid #eee;">Client Name:</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${name}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold; background: #f9f9f9; border-bottom: 1px solid #eee;">Client Email:</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${email}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold; background: #f9f9f9; border-bottom: 1px solid #eee;">Phone / WhatsApp:</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${phone || '—'}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold; background: #f9f9f9; border-bottom: 1px solid #eee;">Business Name:</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${businessName || '—'}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold; background: #f9f9f9; border-bottom: 1px solid #eee;">Business Type:</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${businessType || '—'}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold; background: #f9f9f9; border-bottom: 1px solid #eee;">Preferred Contact:</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${contactMethod || '—'}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold; background: #f9f9f9; border-bottom: 1px solid #eee;">Requested Plan:</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>${service}</strong></td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold; background: #f9f9f9; border-bottom: 1px solid #eee;">Scope Details:</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${message || "No specifics detailed."}</td>
              </tr>
            </table>
            <p style="margin-top: 20px; font-size: 0.85em; color: #777;">ASCORIX Intelligent Scoping Telemetry System</p>
          </div>
        `
      };
      transporter.sendMail(mailOptions)
        .then(() => console.log(`[EMAIL] Successfully sent consultation email alert for client: ${email} to ${ownerEmail}`))
        .catch(err => console.error("[EMAIL] Failed to send admin consultation email:", err.message));
    }

    // 2. Dispatch WhatsApp Alert to Owner
    const wsMessage = `🚨 [ASCORIX NEW ${userId ? 'REGISTERED' : 'GUEST'} CONSULTATION]\n\nClient Name: ${name}\nClient Email: ${email}\nPhone: ${phone || '—'}\nBusiness Name: ${businessName || '—'}\nBusiness Type: ${businessType || '—'}\nPreferred Contact: ${contactMethod || '—'}\nRequested Plan: ${service}\nDetails: ${message || 'None'}`;
    sendWhatsAppNotification(wsMessage);

    res.status(201).json({
      message: "Consultation inquiry received and synchronized.",
      inquiry: newInquiry
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Inquiry Status (Admin)
app.patch('/api/inquiries/:id/status', authMiddleware, adminMiddleware('manage_inbox'), async (req, res) => {
  try {
    const { status } = req.body;
    if (!['Pending', 'Under Review', 'Completed'].includes(status)) {
      return res.status(400).json({ error: "Invalid status value." });
    }

    const updated = await db().Inquiries.findByIdAndUpdate(req.params.id, { status });
    if (!updated) {
      return res.status(404).json({ error: "Inquiry not found." });
    }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete/Archive Inquiry (Admin)
app.delete('/api/inquiries/:id', authMiddleware, adminMiddleware('manage_inbox'), async (req, res) => {
  try {
    const deleted = await db().Inquiries.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Inquiry not found." });
    }
    res.json({ message: "Inquiry archived and removed successfully.", deleted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// SUPPORT TICKETS ENDPOINTS
// ==========================================

// Get Tickets (Admin gets all, client gets only their own)
app.get('/api/tickets', authMiddleware, async (req, res) => {
  try {
    let tickets;
    if (req.user.role.startsWith('admin')) {
      const perms = req.user.role === 'admin' ? ['manage_inbox'] : (req.user.role.includes(':') ? req.user.role.split(':')[1].split(',') : []);
      if (!perms.includes('manage_inbox')) {
        return res.status(403).json({ error: "Access denied. Lack of 'manage_inbox' permission." });
      }
      tickets = await db().Tickets.find();
    } else {
      tickets = await db().Tickets.find({
        $or: [
          { userId: req.user.id },
          { email: req.user.email }
        ]
      });

      // Fallback check if MongoDB/JSON queries aren't matching
      if (!Array.isArray(tickets)) {
        tickets = await db().Tickets.find({ userId: req.user.id });
      }
    }
    res.json(tickets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Submit Support Ticket (Authenticated Client)
app.post('/api/tickets', authMiddleware, async (req, res) => {
  try {
    const { subject, description } = req.body;
    if (!subject || !description) {
      return res.status(400).json({ error: "Missing subject or description." });
    }

    const newTicket = await db().Tickets.create({
      userId: req.user.id,
      name: req.user.name,
      email: req.user.email,
      subject,
      description,
      status: 'Open'
    });

    res.status(201).json({
      message: "Support ticket raised successfully.",
      ticket: newTicket
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Ticket Status (Admin)
app.patch('/api/tickets/:id/status', authMiddleware, adminMiddleware('manage_inbox'), async (req, res) => {
  try {
    const { status } = req.body;
    if (!['Open', 'In Progress', 'Resolved'].includes(status)) {
      return res.status(400).json({ error: "Invalid status value." });
    }

    const updated = await db().Tickets.findByIdAndUpdate(req.params.id, { status });
    if (!updated) {
      return res.status(404).json({ error: "Ticket not found." });
    }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// PUBLIC SETTINGS (GUEST & CLIENT ACCESS)
// ==========================================

app.get('/api/settings', async (req, res) => {
  try {
    let settings = await db().Settings.findOne();
    if (!settings) {
      settings = await db().Settings.create({ checkoutEnabled: false, pricingMargin: 1.0, customCategories: [] });
    }
    res.json({ 
      checkoutEnabled: settings.checkoutEnabled,
      customCategories: settings.customCategories || [],
      maintenanceMode: settings.maintenanceMode || false,
      maintenanceBanner: settings.maintenanceBanner || ''
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// SYSTEM SETTINGS & CONFIGURATION (ADMIN)
// ==========================================

app.get('/api/admin/db-config', authMiddleware, adminMiddleware('manage_settings'), async (req, res) => {
  try {
    const { getDbConfig } = require('./dbServer.js');
    const config = getDbConfig();
    if (config && config.supabaseKey) config.supabaseKey = '********';
    res.json(config);
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/db-config', authMiddleware, adminMiddleware('manage_settings'), async (req, res) => {
  try {
    const { provider, supabaseUrl, supabaseKey, mongoUri } = req.body;
    const { updateDbConfig, getDbConfig } = require('./dbServer.js');
    
    let currentConfig = getDbConfig();
    let newKey = supabaseKey;
    if (newKey === '********' && currentConfig) newKey = currentConfig.supabaseKey;

    await updateDbConfig({ provider, supabaseUrl, supabaseKey: newKey, mongoUri });
    res.json({ success: true, message: 'Database configuration updated successfully.' });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/settings', authMiddleware, adminMiddleware('manage_settings'), async (req, res) => {
  try {
    let settings = await db().Settings.findOne();
    if (!settings) {
      settings = await db().Settings.create({ checkoutEnabled: false, pricingMargin: 1.0, customCategories: [] });
    }
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/settings', authMiddleware, adminMiddleware('manage_settings'), async (req, res) => {
  try {
    let settings = await db().Settings.findOne();
    if (!settings) {
      settings = await db().Settings.create({ checkoutEnabled: false, pricingMargin: 1.0, customCategories: [] });
    }
    const updated = await db().Settings.updateOne({}, req.body);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// SYSTEM USER MANAGEMENT (ADMIN)
// ==========================================

// Register Sub-Admin Account (Admin only)
app.post('/api/admin/users/create', authMiddleware, adminMiddleware('manage_users'), async (req, res) => {
  try {
    const { name, email, password, permissions } = req.body;

    if (!name || !email || !password || !permissions) {
      return res.status(400).json({ error: "Missing required registration parameters." });
    }

    const cleanEmail = email.toLowerCase().trim();
    const existingUser = await db().Users.findOne({ email: cleanEmail });
    if (existingUser) {
      return res.status(400).json({ error: "Email address is already registered." });
    }

    // Hash passcode securely
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(password, salt);

    const newUser = await db().Users.create({
      name,
      email: cleanEmail,
      password: hashedPassword,
      role: 'admin',
      is_verified: true,
      verification_token: permissions
    });

    res.status(201).json({
      message: "Administrator account created successfully.",
      user: {
        id: newUser._id.toString(),
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        verification_token: newUser.verification_token
      }
    });
  } catch (err) {
    res.status(500).json({ error: `Registration failed: ${err.message}` });
  }
});

app.get('/api/admin/users', authMiddleware, adminMiddleware('manage_users'), async (req, res) => {
  try {
    const users = await db().Users.find();
    // Return users without password field
    const safeUsers = users.map(u => {
      const uObj = u.toObject ? u.toObject() : { ...u };
      delete uObj.password;
      return uObj;
    });
    res.json(safeUsers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/users', authMiddleware, adminMiddleware('manage_users'), async (req, res) => {
  try {
    const { name, email, phone, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are required." });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanPhone = phone ? phone.trim() : '';

    const existingEmail = await db().Users.findOne({ email: cleanEmail });
    if (existingEmail) {
      return res.status(400).json({ error: "Email address is already registered." });
    }

    if (cleanPhone) {
      const existingPhone = await db().Users.findOne({ phone: cleanPhone });
      if (existingPhone) {
        return res.status(400).json({ error: "Mobile number is already registered to another account." });
      }
    }

    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(password, salt);

    const newUser = await db().Users.create({
      name,
      email: cleanEmail,
      phone: cleanPhone || '—',
      password: hashedPassword,
      role: role || 'client',
      is_verified: true
    });

    res.status(201).json({
      message: "User created successfully.",
      user: {
        id: (newUser.id || newUser._id).toString(),
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone,
        role: newUser.role
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/admin/users/:id/role', authMiddleware, adminMiddleware('manage_users'), async (req, res) => {
  try {
    const { role } = req.body;
    if (role !== 'admin' && role !== 'client') {
      return res.status(400).json({ error: "Invalid role value." });
    }
    const updated = await db().Users.findByIdAndUpdate(req.params.id, { role });
    if (!updated) {
      return res.status(404).json({ error: "User not found." });
    }
    res.json({ message: "User role updated successfully.", user: { id: req.params.id, role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Modify User Details (Admin Update)
app.put('/api/admin/users/:id', authMiddleware, adminMiddleware('manage_users'), async (req, res) => {
  try {
    const { name, email, phone, role, is_banned, is_verified } = req.body;
    const isSelf = req.params.id === req.user.id;

    if (role && role !== 'admin' && role !== 'client') {
      return res.status(400).json({ error: "Invalid role value." });
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email.toLowerCase().trim();
    if (phone) updateData.phone = phone.trim();
    
    if (role !== undefined) {
      if (isSelf && role !== 'admin') {
        return res.status(400).json({ error: "You cannot revoke your own administrator role." });
      }
      updateData.role = role;
      if (role === 'client') {
        updateData.verification_token = null;
      }
    }
    if (is_banned !== undefined) {
      if (isSelf && is_banned) {
        return res.status(400).json({ error: "You cannot ban your own administrator account." });
      }
      updateData.is_banned = is_banned;
    }
    if (is_verified !== undefined) {
      updateData.is_verified = is_verified === true || is_verified === 'true';
    }

    const updated = await db().Users.findByIdAndUpdate(req.params.id, updateData);
    if (!updated) {
      return res.status(404).json({ error: "User not found." });
    }
    res.json({ message: "User updated successfully.", user: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete/Remove User (Admin Delete)
app.delete('/api/admin/users/:id', authMiddleware, adminMiddleware('manage_users'), async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: "You cannot delete your own administrator account." });
    }
    const deleted = await db().Users.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "User not found." });
    }
    res.json({ message: "User deleted successfully." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// OFFER/COUPON CODES MANAGEMENT
// ==========================================

app.get('/api/admin/offercodes', authMiddleware, adminMiddleware('manage_settings'), async (req, res) => {
  try {
    const codes = await db().OfferCodes.find();
    res.json(codes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/offercodes', authMiddleware, adminMiddleware('manage_settings'), async (req, res) => {
  try {
    const { code, discount } = req.body;
    if (!code || isNaN(discount) || discount < 1 || discount > 100) {
      return res.status(400).json({ error: "Code title and valid discount (1-100) are required." });
    }

    const formattedCode = code.toUpperCase().trim();
    const existing = await db().OfferCodes.findOne({ code: formattedCode });
    if (existing) {
      return res.status(400).json({ error: "Promo code already exists." });
    }

    const created = await db().OfferCodes.create({ code: formattedCode, discount: Number(discount), active: true });
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/offercodes/:id', authMiddleware, adminMiddleware('manage_settings'), async (req, res) => {
  try {
    const deleted = await db().OfferCodes.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Promo code not found." });
    }
    res.json({ message: "Promo code deleted.", deleted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.post('/api/auth/offercodes/validate', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ error: "Promo code value required." });
    }
    const formattedCode = code.toUpperCase().trim();
    const matched = await db().OfferCodes.findOne({ code: formattedCode, active: true });
    if (!matched) {
      return res.status(404).json({ error: "Invalid, expired, or inactive promo code." });
    }
    res.json(matched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// BMS - DASHBOARD STATS
// ==========================================

app.get('/api/bms/dashboard', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const d = db();
    const [leads, clients, projects, appointments, payments, invoices, notifications] = await Promise.all([
      d.Leads.find(),
      d.Clients.find(),
      d.Projects.find(),
      d.Appointments.find(),
      d.Payments.find(),
      d.Invoices.find(),
      d.Notifications.countUnread()
    ]);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    const monthlyRevenue = payments.filter(p => new Date(p.created_at || p.payment_date) >= monthStart).reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const yearlyRevenue = payments.filter(p => new Date(p.created_at || p.payment_date) >= yearStart).reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const pendingInvoiceAmount = invoices.filter(i => ['Pending', 'Overdue', 'Partially Paid'].includes(i.payment_status)).reduce((s, i) => s + (Number(i.balance_due || i.total) || 0), 0);
    const upcomingMeetings = appointments.filter(a => a.status === 'Upcoming' && new Date(a.appointment_date) >= now).length;

    const activeStatuses = ['Planning', 'UI Design', 'Development', 'Testing', 'Review'];

    // Lead by status
    const leadStats = { total: leads.length };
    ['New', 'Contacted', 'Qualified', 'Proposal Sent', 'Negotiation', 'Won', 'Lost'].forEach(s => {
      leadStats[s.toLowerCase().replace(' ', '_')] = leads.filter(l => l.status === s).length;
    });

    // Leads per month (last 6 months)
    const leadsPerMonth = [];
    for (let i = 5; i >= 0; i--) {
      const d2 = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const d3 = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      const label = d2.toLocaleString('en', { month: 'short', year: '2-digit' });
      const count = leads.filter(l => { const ld = new Date(l.created_at); return ld >= d2 && ld <= d3; }).length;
      leadsPerMonth.push({ label, count });
    }

    // Revenue per month (last 6 months)
    const revenuePerMonth = [];
    for (let i = 5; i >= 0; i--) {
      const d2 = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const d3 = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      const label = d2.toLocaleString('en', { month: 'short', year: '2-digit' });
      const amount = payments.filter(p => { const pd = new Date(p.created_at); return pd >= d2 && pd <= d3; }).reduce((s, p) => s + (Number(p.amount) || 0), 0);
      revenuePerMonth.push({ label, amount });
    }

    // Lead sources distribution
    const sourceMap = {};
    leads.forEach(l => { const src = l.lead_source || 'Website Form'; sourceMap[src] = (sourceMap[src] || 0) + 1; });

    // Service distribution from leads
    const serviceMap = {};
    leads.forEach(l => { if (l.service) serviceMap[l.service] = (serviceMap[l.service] || 0) + 1; });

    res.json({
      leads: leadStats,
      clients: { total: clients.length, active: clients.filter(c => c.status === 'Active').length },
      projects: {
        total: projects.length,
        active: projects.filter(p => activeStatuses.includes(p.status)).length,
        pending: projects.filter(p => p.status === 'Pending').length,
        completed: projects.filter(p => ['Completed', 'Delivered'].includes(p.status)).length
      },
      finance: { monthly_revenue: monthlyRevenue, yearly_revenue: yearlyRevenue, pending_amount: pendingInvoiceAmount },
      meetings: { upcoming: upcomingMeetings },
      notifications: { unread: notifications },
      charts: { leads_per_month: leadsPerMonth, revenue_per_month: revenuePerMonth, lead_sources: Object.entries(sourceMap).map(([k, v]) => ({ name: k, value: v })), service_distribution: Object.entries(serviceMap).slice(0, 8).map(([k, v]) => ({ name: k, value: v })) }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// BMS - LEADS (CRM)
// ==========================================

app.get('/api/bms/leads', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const leads = await db().Leads.find();
    res.json(leads);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/bms/leads/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const lead = await db().Leads.findById(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found.' });
    const notes = await db().LeadNotes.find({ lead_id: req.params.id });
    res.json({ ...lead, notes });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/bms/leads', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { name, email, service } = req.body;
    if (!name || !email || !service) return res.status(400).json({ error: 'Name, email and service are required.' });
    const newLead = await db().Leads.create({ ...req.body, status: req.body.status || 'New', lead_source: req.body.lead_source || 'Website Form' });
    // Create notification
    try { await db().Notifications.create({ title: 'New Lead Added', message: `Lead from ${name} for ${service}`, type: 'lead', link: `/admin#crm` }); } catch (e) {}
    res.status(201).json(newLead);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/bms/leads/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const updated = await db().Leads.findByIdAndUpdate(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Lead not found.' });
    // Log status change in notes
    if (req.body.status) {
      try { await db().LeadNotes.create({ lead_id: req.params.id, author: req.user.name || 'Admin', type: 'Status Change', content: `Status changed to: ${req.body.status}` }); } catch (e) {}
    }
    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/bms/leads/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const deleted = await db().Leads.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Lead not found.' });
    res.json({ message: 'Lead deleted.', deleted });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Lead Notes
app.get('/api/bms/leads/:id/notes', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const notes = await db().LeadNotes.find({ lead_id: req.params.id });
    res.json(notes);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/bms/leads/:id/notes', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { content, type } = req.body;
    if (!content) return res.status(400).json({ error: 'Content is required.' });
    const note = await db().LeadNotes.create({ lead_id: req.params.id, author: req.user.name || 'Admin', type: type || 'Note', content });
    res.status(201).json(note);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Convert Lead to Client
app.post('/api/bms/leads/:id/convert', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const lead = await db().Leads.findById(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found.' });
    const newClient = await db().Clients.create({
      company_name: lead.company_name || lead.name,
      contact_person: lead.name,
      email: lead.email,
      phone: lead.phone || '',
      whatsapp: lead.whatsapp || '',
      lead_id: req.params.id,
      notes: `Converted from lead #${lead.lead_number}`
    });
    await db().Leads.findByIdAndUpdate(req.params.id, { status: 'Won', converted_to_client: true, client_id: newClient._id });
    try { await db().Notifications.create({ title: 'New Client', message: `${lead.name} converted to client`, type: 'success', link: `/admin#clients` }); } catch (e) {}
    res.status(201).json(newClient);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================
// BMS - CLIENTS
// ==========================================

app.get('/api/bms/clients', authMiddleware, adminMiddleware, async (req, res) => {
  try { res.json(await db().Clients.find()); } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/bms/clients/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const client = await db().Clients.findById(req.params.id);
    if (!client) return res.status(404).json({ error: 'Client not found.' });
    const [projects, invoices, payments] = await Promise.all([
      db().Projects.find({ client_id: req.params.id }),
      db().Invoices.find({ client_id: req.params.id }),
      db().Payments.find({ client_id: req.params.id })
    ]);
    res.json({ ...client, projects, invoices, payments });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/bms/clients', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { company_name, contact_person, email } = req.body;
    if (!company_name || !contact_person || !email) return res.status(400).json({ error: 'Company name, contact person and email are required.' });
    const client = await db().Clients.create(req.body);
    res.status(201).json(client);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/bms/clients/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const updated = await db().Clients.findByIdAndUpdate(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Client not found.' });
    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/bms/clients/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const deleted = await db().Clients.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Client not found.' });
    res.json({ message: 'Client deleted.', deleted });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================
// BMS - PROJECTS
// ==========================================

app.get('/api/bms/projects', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const projects = await db().Projects.find(req.query.client_id ? { client_id: req.query.client_id } : {});
    res.json(projects);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/bms/projects/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const project = await db().Projects.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found.' });
    const tasks = await db().Tasks.find({ project_id: req.params.id });
    res.json({ ...project, tasks });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/bms/projects', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Project name is required.' });
    const project = await db().Projects.create(req.body);
    res.status(201).json(project);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/bms/projects/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const updated = await db().Projects.findByIdAndUpdate(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Project not found.' });
    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/bms/projects/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const deleted = await db().Projects.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Project not found.' });
    res.json({ message: 'Project deleted.', deleted });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================
// BMS - TASKS
// ==========================================

app.get('/api/bms/tasks', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const tasks = await db().Tasks.find(req.query.project_id ? { project_id: req.query.project_id } : {});
    res.json(tasks);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/bms/tasks', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { title, project_id } = req.body;
    if (!title || !project_id) return res.status(400).json({ error: 'Title and project_id are required.' });
    const task = await db().Tasks.create(req.body);
    res.status(201).json(task);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/bms/tasks/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const updated = await db().Tasks.findByIdAndUpdate(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Task not found.' });
    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/bms/tasks/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const deleted = await db().Tasks.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Task not found.' });
    res.json({ message: 'Task deleted.', deleted });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================
// BMS - APPOINTMENTS
// ==========================================

app.get('/api/bms/appointments', authMiddleware, adminMiddleware, async (req, res) => {
  try { res.json(await db().Appointments.find(req.query.status ? { status: req.query.status } : {})); } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/bms/appointments', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { title, appointment_date } = req.body;
    if (!title || !appointment_date) return res.status(400).json({ error: 'Title and appointment_date are required.' });
    const appt = await db().Appointments.create(req.body);
    try { await db().Notifications.create({ title: 'New Appointment', message: `${title} scheduled for ${new Date(appointment_date).toLocaleString()}`, type: 'info', link: `/admin#appointments` }); } catch (e) {}
    res.status(201).json(appt);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/bms/appointments/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const updated = await db().Appointments.findByIdAndUpdate(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Appointment not found.' });
    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/bms/appointments/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const deleted = await db().Appointments.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Appointment not found.' });
    res.json({ message: 'Appointment deleted.', deleted });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================
// BMS - QUOTATIONS
// ==========================================

app.get('/api/bms/quotations', authMiddleware, adminMiddleware, async (req, res) => {
  try { res.json(await db().Quotations.find()); } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/bms/quotations/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const quote = await db().Quotations.findById(req.params.id);
    if (!quote) return res.status(404).json({ error: 'Quotation not found.' });
    const items = await db().QuotationItems.find({ quotation_id: req.params.id });
    res.json({ ...quote, items });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/bms/quotations', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { client_name, client_email, items = [] } = req.body;
    if (!client_name || !client_email) return res.status(400).json({ error: 'Client name and email are required.' });
    const quoteData = { ...req.body };
    delete quoteData.items;
    const quote = await db().Quotations.create(quoteData);
    // Save items
    for (let i = 0; i < items.length; i++) {
      await db().QuotationItems.create({ ...items[i], quotation_id: quote._id, sort_order: i });
    }
    res.status(201).json(quote);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/bms/quotations/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { items } = req.body;
    const quoteData = { ...req.body };
    delete quoteData.items;
    const updated = await db().Quotations.findByIdAndUpdate(req.params.id, quoteData);
    if (!updated) return res.status(404).json({ error: 'Quotation not found.' });
    if (items) {
      await db().QuotationItems.deleteByQuotationId(req.params.id);
      for (let i = 0; i < items.length; i++) {
        await db().QuotationItems.create({ ...items[i], quotation_id: req.params.id, sort_order: i });
      }
    }
    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/bms/quotations/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await db().QuotationItems.deleteByQuotationId(req.params.id);
    const deleted = await db().Quotations.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Quotation not found.' });
    res.json({ message: 'Quotation deleted.', deleted });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Convert Quotation to Invoice
app.post('/api/bms/quotations/:id/convert', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const quote = await db().Quotations.findById(req.params.id);
    if (!quote) return res.status(404).json({ error: 'Quotation not found.' });
    const items = await db().QuotationItems.find({ quotation_id: req.params.id });
    const invoice = await db().Invoices.create({
      client_id: quote.client_id || null,
      client_name: quote.client_name,
      client_email: quote.client_email,
      client_address: quote.client_address || '',
      client_gst: quote.client_gst || '',
      quotation_id: quote._id,
      project_id: quote.project_id || null,
      subtotal: quote.subtotal,
      discount_percent: quote.discount_percent,
      discount_amount: quote.discount_amount,
      tax_percent: quote.tax_percent,
      tax_amount: quote.tax_amount,
      total: quote.total,
      balance_due: quote.total,
      notes: quote.notes,
      terms: quote.terms,
      payment_status: 'Pending',
      due_date: req.body.due_date || null
    });
    for (let i = 0; i < items.length; i++) {
      await db().InvoiceItems.create({ ...items[i], invoice_id: invoice._id, quotation_id: undefined });
    }
    await db().Quotations.findByIdAndUpdate(req.params.id, { converted_to_invoice: true, invoice_id: invoice._id, status: 'Accepted' });
    res.status(201).json(invoice);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Email Quotation to Client
app.post('/api/bms/quotations/:id/email', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const quote = await db().Quotations.findById(req.params.id);
    if (!quote) return res.status(404).json({ error: 'Quotation not found.' });
    const items = await db().QuotationItems.find({ quotation_id: req.params.id });
    
    const year = new Date(quote.created_at || Date.now()).getFullYear();
    const seq = String(quote.quotation_number || 1).padStart(4, '0');
    const formattedNo = `ATS-Q-${year}-${seq}`;

    let itemsRows = '';
    items.forEach((it, idx) => {
      itemsRows += `
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px;">${idx + 1}</td>
          <td style="border: 1px solid #ddd; padding: 8px;">
            <strong>${it.service_name || 'Service'}</strong><br/>
            <span style="color: #666; font-size: 12px;">${it.description || ''}</span>
          </td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${it.quantity}</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">₹${Number(it.unit_price).toLocaleString('en-IN')}</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">₹${Number(it.amount).toLocaleString('en-IN')}</td>
        </tr>`;
    });

    const emailHtml = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
        <div style="background: linear-gradient(135deg, #0a1228 0%, #060c1a 100%); padding: 24px; color: #ffffff; text-align: left; display: flex; align-items: center; gap: 12px;">
          <img src="cid:ascorixlogo" alt="ASCORIX Logo" style="height: 42px; width: auto; vertical-align: middle;" />
          <div style="display: inline-block; vertical-align: middle; line-height: 1.1; margin-left: 10px; text-align: left;">
            <div style="font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: 0.5px;">ASCORIX<span style="color: #00c9ff;">.</span></div>
            <div style="font-size: 8px; font-weight: 700; color: #a0aec0; letter-spacing: 1.6px; margin-top: 1px;">TECH SOLUTIONS</div>
          </div>
        </div>
        <div style="padding: 24px; background: #ffffff; color: #1a202c; line-height: 1.6;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 20px; flex-wrap: wrap; border-bottom: 1px solid #edf2f7; padding-bottom: 15px;">
            <div>
              <h4 style="margin: 0 0 5px; color: #718096; font-size: 12px; text-transform: uppercase;">Quotation for</h4>
              <strong style="font-size: 16px; color: #2d3748;">${quote.client_name}</strong>
              <div style="font-size: 13px; color: #4a5568;">${quote.client_email}</div>
            </div>
            <div style="text-align: right;">
              <h4 style="margin: 0 0 5px; color: #718096; font-size: 12px; text-transform: uppercase;">Document #</h4>
              <strong style="font-size: 16px; color: #0052D4;">${formattedNo}</strong>
              <div style="font-size: 12px; color: #718096;">Date: ${new Date(quote.created_at).toLocaleDateString('en-IN')}</div>
              ${quote.valid_until ? `<div style="font-size: 12px; color: #e53e3e;">Valid Until: ${new Date(quote.valid_until).toLocaleDateString('en-IN')}</div>` : ''}
            </div>
          </div>
          
          <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 14px;">
            <thead>
              <tr style="background: #edf2f7; color: #2d3748; text-align: left; font-weight: 600;">
                <th style="border: 1px solid #ddd; padding: 10px; width: 40px;">#</th>
                <th style="border: 1px solid #ddd; padding: 10px;">Service Details</th>
                <th style="border: 1px solid #ddd; padding: 10px; width: 50px; text-align: center;">Qty</th>
                <th style="border: 1px solid #ddd; padding: 10px; text-align: right; width: 100px;">Price</th>
                <th style="border: 1px solid #ddd; padding: 10px; text-align: right; width: 100px;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows}
            </tbody>
          </table>

          <div style="margin-top: 20px; float: right; width: 250px; font-size: 14px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 6px 0; color: #4a5568;">Subtotal:</td>
                <td style="padding: 6px 0; text-align: right; font-weight: 600;">₹${Number(quote.subtotal).toLocaleString('en-IN')}</td>
              </tr>
              ${quote.discount_amount ? `
              <tr>
                <td style="padding: 6px 0; color: #e53e3e;">Discount (${quote.discount_percent}%):</td>
                <td style="padding: 6px 0; text-align: right; color: #e53e3e; font-weight: 600;">-₹${Number(quote.discount_amount).toLocaleString('en-IN')}</td>
              </tr>` : ''}
              <tr style="border-top: 2px solid #2d3748; font-size: 16px;">
                <td style="padding: 10px 0; font-weight: 700; color: #0052D4;">Grand Total:</td>
                <td style="padding: 10px 0; text-align: right; font-weight: 700; color: #0052D4;">₹${Number(quote.total).toLocaleString('en-IN')}</td>
              </tr>
            </table>
          </div>
          <div style="clear: both;"></div>

          ${quote.notes ? `<div style="margin-top: 24px; padding: 12px; background: #f7fafc; border-left: 4px solid #4a5568; font-size: 13px;"><strong>Notes:</strong> ${quote.notes}</div>` : ''}
          ${quote.terms ? `<div style="margin-top: 12px; padding: 12px; background: #f7fafc; border-left: 4px solid #0052D4; font-size: 13px;"><strong>Terms & Conditions:</strong> ${quote.terms}</div>` : ''}
        </div>
        <div style="background: #edf2f7; padding: 16px; text-align: center; color: #718096; font-size: 12px; border-top: 1px solid #edf2f7;">
          <strong>Founder:</strong> ABHINIVESH L T | <strong>Phone:</strong> 8825556134<br/>
          <strong>Email:</strong> ascorixtechsolutions@gmail.com | <strong>Website:</strong> www.ascorixtechsolutions.com<br/>
          Erode, Tamil Nadu
        </div>
      </div>`;

    const senderEmail = process.env.BMS_EMAIL_USER || process.env.GMAIL_USER || process.env.EMAIL_USER;
    const mailOptions = {
      from: `"ASCORIX TECH SOLUTIONS" <${senderEmail}>`,
      to: quote.client_email,
      replyTo: 'ascorixtechsolutions@gmail.com',
      subject: `Quotation ${formattedNo} - ASCORIX TECH SOLUTIONS`,
      html: emailHtml,
      attachments: [{
        filename: 'logo-icon-cropped.png',
        path: path.join(__dirname, 'logo-icon-cropped.png'),
        cid: 'ascorixlogo'
      }]
    };

    await bmsTransporter.sendMail(mailOptions);
    res.json({ message: 'Quotation sent successfully to ' + quote.client_email });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================
// BMS - INVOICES
// ==========================================

app.get('/api/bms/invoices', authMiddleware, adminMiddleware, async (req, res) => {
  try { res.json(await db().Invoices.find()); } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/bms/invoices/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const invoice = await db().Invoices.findById(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found.' });
    const [items, paymentHistory] = await Promise.all([
      db().InvoiceItems.find({ invoice_id: req.params.id }),
      db().Payments.find({ invoice_id: req.params.id })
    ]);
    res.json({ ...invoice, items, payment_history: paymentHistory });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/bms/invoices', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { client_name, client_email, items = [] } = req.body;
    if (!client_name || !client_email) return res.status(400).json({ error: 'Client name and email are required.' });
    const invData = { ...req.body };
    delete invData.items;
    const invoice = await db().Invoices.create({ ...invData, balance_due: invData.total || 0 });
    for (let i = 0; i < items.length; i++) {
      await db().InvoiceItems.create({ ...items[i], invoice_id: invoice._id, sort_order: i });
    }
    res.status(201).json(invoice);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/bms/invoices/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { items } = req.body;
    const invData = { ...req.body };
    delete invData.items;
    const updated = await db().Invoices.findByIdAndUpdate(req.params.id, invData);
    if (!updated) return res.status(404).json({ error: 'Invoice not found.' });
    if (items) {
      await db().InvoiceItems.deleteByInvoiceId(req.params.id);
      for (let i = 0; i < items.length; i++) {
        await db().InvoiceItems.create({ ...items[i], invoice_id: req.params.id, sort_order: i });
      }
    }
    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/bms/invoices/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await db().InvoiceItems.deleteByInvoiceId(req.params.id);
    const deleted = await db().Invoices.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Invoice not found.' });
    res.json({ message: 'Invoice deleted.', deleted });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Email Invoice to Client
app.post('/api/bms/invoices/:id/email', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const invoice = await db().Invoices.findById(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found.' });
    const items = await db().InvoiceItems.find({ invoice_id: req.params.id });
    
    const year = new Date(invoice.created_at || Date.now()).getFullYear();
    const seq = String(invoice.invoice_number || 1).padStart(4, '0');
    const formattedNo = `ATS-I-${year}-${seq}`;

    let itemsRows = '';
    items.forEach((it, idx) => {
      itemsRows += `
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px;">${idx + 1}</td>
          <td style="border: 1px solid #ddd; padding: 8px;">
            <strong>${it.service_name || 'Service'}</strong><br/>
            <span style="color: #666; font-size: 12px;">${it.description || ''}</span>
          </td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${it.quantity}</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">₹${Number(it.unit_price).toLocaleString('en-IN')}</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">₹${Number(it.amount).toLocaleString('en-IN')}</td>
        </tr>`;
    });

    const emailHtml = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
        <div style="background: linear-gradient(135deg, #0a1228 0%, #060c1a 100%); padding: 24px; color: #ffffff; text-align: left; display: flex; align-items: center; gap: 12px;">
          <img src="cid:ascorixlogo" alt="ASCORIX Logo" style="height: 42px; width: auto; vertical-align: middle;" />
          <div style="display: inline-block; vertical-align: middle; line-height: 1.1; margin-left: 10px; text-align: left;">
            <div style="font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: 0.5px;">ASCORIX<span style="color: #00c9ff;">.</span></div>
            <div style="font-size: 8px; font-weight: 700; color: #a0aec0; letter-spacing: 1.6px; margin-top: 1px;">TECH SOLUTIONS</div>
          </div>
        </div>
        <div style="padding: 24px; background: #ffffff; color: #1a202c; line-height: 1.6;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 20px; flex-wrap: wrap; border-bottom: 1px solid #edf2f7; padding-bottom: 15px;">
            <div>
              <h4 style="margin: 0 0 5px; color: #718096; font-size: 12px; text-transform: uppercase;">Invoice for</h4>
              <strong style="font-size: 16px; color: #2d3748;">${invoice.client_name}</strong>
              <div style="font-size: 13px; color: #4a5568;">${invoice.client_email}</div>
            </div>
            <div style="text-align: right;">
              <h4 style="margin: 0 0 5px; color: #718096; font-size: 12px; text-transform: uppercase;">Document #</h4>
              <strong style="font-size: 16px; color: #0052D4;">${formattedNo}</strong>
              <div style="font-size: 12px; color: #718096;">Date: ${new Date(invoice.created_at).toLocaleDateString('en-IN')}</div>
              ${invoice.due_date ? `<div style="font-size: 12px; color: #e53e3e;">Due Date: ${new Date(invoice.due_date).toLocaleDateString('en-IN')}</div>` : ''}
              <div style="font-size: 12px; margin-top: 4px;">Status: <strong style="color: ${invoice.payment_status === 'Paid' ? '#10b981' : '#f59e0b'};">${invoice.payment_status}</strong></div>
            </div>
          </div>
          
          <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 14px;">
            <thead>
              <tr style="background: #edf2f7; color: #2d3748; text-align: left; font-weight: 600;">
                <th style="border: 1px solid #ddd; padding: 10px; width: 40px;">#</th>
                <th style="border: 1px solid #ddd; padding: 10px;">Service Details</th>
                <th style="border: 1px solid #ddd; padding: 10px; width: 50px; text-align: center;">Qty</th>
                <th style="border: 1px solid #ddd; padding: 10px; text-align: right; width: 100px;">Price</th>
                <th style="border: 1px solid #ddd; padding: 10px; text-align: right; width: 100px;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows}
            </tbody>
          </table>

          <div style="margin-top: 20px; float: right; width: 250px; font-size: 14px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 6px 0; color: #4a5568;">Subtotal:</td>
                <td style="padding: 6px 0; text-align: right; font-weight: 600;">₹${Number(invoice.subtotal).toLocaleString('en-IN')}</td>
              </tr>
              ${invoice.discount_amount ? `
              <tr>
                <td style="padding: 6px 0; color: #e53e3e;">Discount (${invoice.discount_percent}%):</td>
                <td style="padding: 6px 0; text-align: right; color: #e53e3e; font-weight: 600;">-₹${Number(invoice.discount_amount).toLocaleString('en-IN')}</td>
              </tr>` : ''}
              <tr style="border-top: 2px solid #2d3748; font-size: 15px;">
                <td style="padding: 8px 0; font-weight: 700; color: #2d3748;">Total Amount:</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 700; color: #2d3748;">₹${Number(invoice.total).toLocaleString('en-IN')}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #10b981;">Advance Paid:</td>
                <td style="padding: 6px 0; text-align: right; color: #10b981; font-weight: 600;">₹${Number(invoice.amount_paid || 0).toLocaleString('en-IN')}</td>
              </tr>
              <tr style="border-top: 2px solid #2d3748; font-size: 16px;">
                <td style="padding: 10px 0; font-weight: 700; color: #e53e3e;">Balance Due:</td>
                <td style="padding: 10px 0; text-align: right; font-weight: 700; color: #e53e3e;">₹${Number(invoice.balance_due || 0).toLocaleString('en-IN')}</td>
              </tr>
            </table>
          </div>
          <div style="clear: both;"></div>

          <div style="margin-top: 24px; padding: 16px; border: 1px dashed #cbd5e0; border-radius: 6px; background: #f7fafc; font-size: 13px;">
            <strong style="color: #0052D4; font-size: 14px;">Bank Transfer Details</strong><br/>
            <strong>Account Name:</strong> Abhinivesh L T<br/>
            <strong>Bank:</strong> Union Bank of India<br/>
            <strong>Account Number:</strong> 317322010002514<br/>
            <strong>IFSC:</strong> UBIN0931730
          </div>

          ${invoice.notes ? `<div style="margin-top: 20px; padding: 12px; background: #f7fafc; border-left: 4px solid #4a5568; font-size: 13px;"><strong>Notes:</strong> ${invoice.notes}</div>` : ''}
          ${invoice.terms ? `<div style="margin-top: 12px; padding: 12px; background: #f7fafc; border-left: 4px solid #0052D4; font-size: 13px;"><strong>Terms & Conditions:</strong> ${invoice.terms}</div>` : ''}
        </div>
        <div style="background: #edf2f7; padding: 16px; text-align: center; color: #718096; font-size: 12px; border-top: 1px solid #edf2f7;">
          <strong>Founder:</strong> ABHINIVESH L T | <strong>Phone:</strong> 8825556134<br/>
          <strong>Email:</strong> ascorixtechsolutions@gmail.com | <strong>Website:</strong> www.ascorixtechsolutions.com<br/>
          Erode, Tamil Nadu
        </div>
      </div>`;

    const senderEmail = process.env.BMS_EMAIL_USER || process.env.GMAIL_USER || process.env.EMAIL_USER;
    const mailOptions = {
      from: `"ASCORIX TECH SOLUTIONS" <${senderEmail}>`,
      to: invoice.client_email,
      replyTo: 'ascorixtechsolutions@gmail.com',
      subject: `Invoice ${formattedNo} - ASCORIX TECH SOLUTIONS`,
      html: emailHtml,
      attachments: [{
        filename: 'logo-icon-cropped.png',
        path: path.join(__dirname, 'logo-icon-cropped.png'),
        cid: 'ascorixlogo'
      }]
    };

    await bmsTransporter.sendMail(mailOptions);
    res.json({ message: 'Invoice sent successfully to ' + invoice.client_email });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================
// BMS - PAYMENTS
// ==========================================

app.get('/api/bms/payments', authMiddleware, adminMiddleware, async (req, res) => {
  try { res.json(await db().Payments.find()); } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/bms/payments', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { client_name, amount, invoice_id } = req.body;
    if (!client_name || !amount) return res.status(400).json({ error: 'Client name and amount are required.' });
    const payment = await db().Payments.create(req.body);
    // Update invoice balance
    if (invoice_id) {
      const inv = await db().Invoices.findById(invoice_id);
      if (inv) {
        const newPaid = (Number(inv.amount_paid) || 0) + Number(amount);
        const newBalance = Math.max(0, (Number(inv.total) || 0) - newPaid);
        const newStatus = newBalance <= 0 ? 'Paid' : newPaid > 0 ? 'Partially Paid' : 'Pending';
        await db().Invoices.findByIdAndUpdate(invoice_id, { amount_paid: newPaid, balance_due: newBalance, payment_status: newStatus });
      }
    }
    try { await db().Notifications.create({ title: 'Payment Received', message: `₹${amount} received from ${client_name}`, type: 'payment', link: `/admin#payments` }); } catch (e) {}
    res.status(201).json(payment);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/bms/payments/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const deleted = await db().Payments.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Payment not found.' });
    res.json({ message: 'Payment deleted.', deleted });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================
// BMS - NOTIFICATIONS
// ==========================================

app.get('/api/bms/notifications', authMiddleware, adminMiddleware, async (req, res) => {
  try { res.json(await db().Notifications.find()); } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/bms/notifications/unread-count', authMiddleware, adminMiddleware, async (req, res) => {
  try { res.json({ count: await db().Notifications.countUnread() }); } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/bms/notifications/:id/read', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const updated = await db().Notifications.findByIdAndUpdate(req.params.id, { is_read: true });
    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/bms/notifications/mark-all-read', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await db().Notifications.markAllRead();
    res.json({ message: 'All notifications marked as read.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================
// BMS - AI ASSISTANT
// ==========================================

app.post('/api/bms/ai', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { action, data } = req.body;
    if (!action) return res.status(400).json({ error: 'Action is required.' });

    let response = '';
    
    switch (action) {
      case 'summarize_lead': {
        const l = data || {};
        response = `Lead Summary for ${l.name || 'Unknown'}:\n• Company: ${l.company_name || 'N/A'}\n• Service Interest: ${l.service || 'N/A'}\n• Budget: ${l.budget || 'Not specified'}\n• Priority: ${l.priority || 'Medium'}\n• Status: ${l.status || 'New'}\n• Source: ${l.lead_source || 'Website Form'}\n\nRecommendation: ${l.budget ? 'This lead has specified a budget — prioritize a quick response within 24 hours.' : 'Budget not specified — qualify this lead with a discovery call.'}`;
        break;
      }
      case 'suggest_followup': {
        const l = data || {};
        const templates = {
          'New': `Hi ${l.name || 'there'},\n\nThank you for reaching out to ASCORIX TECH SOLUTIONS! I noticed your inquiry about ${l.service || 'our services'}.\n\nI'd love to schedule a quick 15-minute call to understand your requirements better. Would you be available this week?\n\nBest regards,\nASCORIX Team`,
          'Contacted': `Hi ${l.name || 'there'},\n\nFollowing up on our previous conversation regarding ${l.service || 'your project'}.\n\nHave you had a chance to review the information I shared? I'm happy to answer any questions.\n\nLooking forward to hearing from you!\n\nBest regards,\nASCORIX Team`,
          'Qualified': `Hi ${l.name || 'there'},\n\nGreat news! Based on our discussion, I believe we have the perfect solution for ${l.service || 'your requirements'}.\n\nI'm preparing a customized proposal for you. Would you be available for a 30-minute presentation this week?\n\nBest regards,\nASCORIX Team`
        };
        response = templates[l.status] || templates['New'];
        break;
      }
      case 'draft_quotation': {
        const l = data || {};
        response = `Quotation Draft for ${l.company_name || l.name || 'Client'}:\n\nService: ${l.service || 'Web Development'}\nEstimated Budget: ${l.budget || 'To be discussed'}\n\nRecommended Package:\n1. Project Discovery & Planning — ₹5,000\n2. ${l.service || 'Core Service Delivery'} — ₹${l.budget ? Math.round(parseInt(l.budget.replace(/[^0-9]/g, '')) * 0.7) + ',000' : '15,000'}\n3. Testing & Quality Assurance — ₹3,000\n4. Deployment & Launch Support — ₹2,000\n\nTotal Estimate: Review with client based on actual scope.\n\nNote: This is an AI-generated estimate. Review and adjust before sending.`;
        break;
      }
      case 'suggest_pricing': {
        const service = data?.service || 'Website Development';
        const pricingGuide = {
          'Website Development': 'Starter: ₹2,499 | Business: ₹14,999 | Premium: ₹24,999+',
          'Digital Marketing': 'Starter: ₹2,999/mo | Growth: ₹5,999/mo | Premium: ₹9,999/mo',
          'AI Automation': 'Starter: ₹3,999 | Business: ₹9,999 | Advanced: ₹19,999+',
          'Google Business Profile': 'Setup & Optimization: ₹1,999+',
          'Bundle Packages': 'Launch: ₹9,999 | Growth: ₹14,999 | Full: ₹24,999+'
        };
        const match = Object.keys(pricingGuide).find(k => service.toLowerCase().includes(k.toLowerCase()));
        response = `Pricing Suggestion for ${service}:\n\n${match ? pricingGuide[match] : 'Custom pricing recommended. Schedule a discovery call to assess scope.'}\n\nConsider:\n• Client budget: Adjust package accordingly\n• Timeline urgency: Add 20-30% for rush projects\n• Ongoing retainer: Offer 10% discount for 3+ month commitments`;
        break;
      }
      case 'overdue_followups': {
        const leads = await db().Leads.find();
        const now = new Date();
        const overdue = leads.filter(l => {
          if (!l.follow_up_date) return false;
          return new Date(l.follow_up_date) < now && !['Won', 'Lost'].includes(l.status);
        });
        if (overdue.length === 0) {
          response = '✅ No overdue follow-ups! All leads are on track.';
        } else {
          response = `⚠️ ${overdue.length} overdue follow-up(s) detected:\n\n${overdue.slice(0, 5).map(l => `• ${l.name} (${l.status}) — Follow-up was due: ${new Date(l.follow_up_date).toLocaleDateString()}`).join('\n')}\n\nAction Required: Contact these leads immediately to prevent losing them.`;
        }
        break;
      }
      default:
        response = `I'm the ASCORIX AI Assistant. I can help you:\n• Summarize leads\n• Suggest follow-up messages\n• Draft quotations\n• Suggest pricing\n• Highlight overdue follow-ups\n\nHow can I assist you today?`;
    }

    res.json({ response, action, timestamp: new Date().toISOString() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Server Route mapping for admin panel dashboard link
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Catch-all route to serve index.html for frontend routing/loading
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});


// Start Express Listener
dbConnect().then(async () => {
  // Seed default system administrator account if it doesn't exist
  try {
    const adminEmail = 'admin@ascorix.com';
    const existingAdmin = await db().Users.findOne({ email: adminEmail });
    if (!existingAdmin) {
      const salt = bcrypt.genSaltSync(10);
      const hashedPassword = bcrypt.hashSync('admin123', salt);
      await db().Users.create({
        name: 'System Administrator',
        email: adminEmail,
        password: hashedPassword,
        role: 'admin'
      });
      console.log(`[SEED] Seeded default administrator: ${adminEmail} (password: admin123)`);
    }
  } catch (err) {
    console.error(`[SEED] Failed to seed default administrator:`, err.message);
  }

  app.listen(PORT, () => {
    console.log(`\n==================================================`);
    console.log(`  ASCORIX TECH SOLUTIONS LOCAL DEV BACKEND SERVER`);
    console.log(`  Active environment: Port ${PORT}`);
    console.log(`  Server endpoints loaded. Ready to process telemetry.`);
    console.log(`  Access landing page at: http://localhost:${PORT}/`);
    console.log(`==================================================\n`);
  });
});
