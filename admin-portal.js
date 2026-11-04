import { db } from './db.js';
window.db = db;

// admin-portal.js — ASCORIX BMS Main Orchestrator
// Handles auth, routing, sidebar, modals, toast, and cross-module data

const bmsChannel = new BroadcastChannel("ascorix_bms");
const BMS = {
  token: null,
  user: null,
  currentSection: 'dashboard',
  loadedSections: {},
  clients: [],
  projects: [],
  invoices: [],

  async init() {
    this.token = localStorage.getItem('ascorix_admin_token') || localStorage.getItem('ascorix_token');
    const userStr = localStorage.getItem('ascorix_admin_user') || localStorage.getItem('ascorix_user');

    if (this.token && userStr) {
      try {
        this.user = JSON.parse(userStr);
      } catch (e) { }
    }

    if (!this.token || !this.user || !['admin', 'admin_root'].includes(this.user.role)) {
      this.showLoginScreen();
      return;
    }

    // Hide login screen, show admin panel root
    document.getElementById('admin-login-screen').style.display = 'none';
    document.getElementById('bms-root').style.display = 'flex';

    this.setupUI();
    this.setupSidebar();
    this.setupModals();
    this.setupTopbar();

    // Start on dashboard
    await this.navigate('dashboard');

    // Kick off notification polling
    this.startNotifPoll();

    // Session heartbeat
    this.startHeartbeat();
  },

  showLoginScreen() {
    document.getElementById('bms-root').style.display = 'none';
    const loginScreen = document.getElementById('admin-login-screen');
    loginScreen.style.display = 'flex';
    loginScreen.classList.remove('hidden');

    const submitBtn = document.getElementById('adminLoginSubmitBtn');
    if (submitBtn && !submitBtn.dataset.bound) {
      submitBtn.dataset.bound = "true";
      submitBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        const email = document.getElementById('adminEmail').value.trim();
        const password = document.getElementById('adminPassword').value;
        const errEl = document.getElementById('loginError');
        
        if (!email || !password) {
          errEl.textContent = 'Please enter email and password.';
          errEl.style.display = 'block';
          return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Signing In...';
        errEl.style.display = 'none';

        try {
          const res = await db.adminLogin(email, password);
          this.token = res.token;
          this.user = res.user;
          // Successfully logged in! Reload/Init main screen
          this.init();
        } catch (err) {
          errEl.textContent = err.message || 'Login failed.';
          errEl.style.display = 'block';
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Sign In';
        }
      });
    }
  },

  setupUI() {
    const name = this.user.name || 'Admin';
    const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    const el = document.getElementById('sidebarAvatar');
    if (el) el.textContent = initials;
    const nameEl = document.getElementById('sidebarUserName');
    if (nameEl) nameEl.textContent = name;
  },

  setupSidebar() {
    // Nav item clicks
    document.querySelectorAll('.bms-nav-item[data-section]').forEach(btn => {
      btn.addEventListener('click', () => {
        const section = btn.getAttribute('data-section');
        this.navigate(section);
        // Close mobile sidebar
        this.closeMobileSidebar();
      });
    });

    // Mobile hamburger
    document.getElementById('menuBtn')?.addEventListener('click', () => {
      document.getElementById('bmsSidebar').classList.add('open');
      document.getElementById('bmsOverlay').classList.add('open');
    });

    // Close sidebar
    document.getElementById('sidebarClose')?.addEventListener('click', () => this.closeMobileSidebar());
    document.getElementById('bmsOverlay')?.addEventListener('click', () => this.closeMobileSidebar());

    // Logout
    document.getElementById('sidebarLogout')?.addEventListener('click', () => this.logout());

    // Refresh btn
    document.getElementById('refreshBtn')?.addEventListener('click', () => this.navigate(this.currentSection, true));

    // Notification button in topbar
    document.getElementById('topbarNotifBtn')?.addEventListener('click', () => this.navigate('notifications'));
  },

  closeMobileSidebar() {
    document.getElementById('bmsSidebar')?.classList.remove('open');
    document.getElementById('bmsOverlay')?.classList.remove('open');
  },

  async navigate(section, forceReload = false) {
    this.currentSection = section;

    // Update active nav
    document.querySelectorAll('.bms-nav-item').forEach(b => b.classList.remove('active'));
    const activeNav = document.getElementById(`nav-${section}`);
    if (activeNav) activeNav.classList.add('active');

    // Show section
    document.querySelectorAll('.bms-section').forEach(s => s.classList.remove('active'));
    const sectionEl = document.getElementById(`section-${section}`);
    if (sectionEl) sectionEl.classList.add('active');

    // Update topbar title
    const titles = {
      dashboard: ['Dashboard', 'Business overview at a glance'],
      crm: ['CRM & Leads', 'Manage leads and prospects'],
      clients: ['Clients', 'All your business clients'],
      projects: ['Projects', 'Track and manage projects'],
      tasks: ['Tasks', 'All tasks across projects'],
      appointments: ['Appointments', 'Schedule and manage meetings'],
      quotations: ['Quotations', 'Create and send quotations'],
      invoices: ['Invoices', 'Invoice and payment tracking'],
      payments: ['Payments', 'Record incoming payments'],
      notifications: ['Notifications', 'System alerts and updates'],
      reports: ['Reports', 'Business analytics and insights'],
      ai: ['AI Assistant', 'AI-powered business intelligence'],
      inquiries: ['Inquiries', 'Website form submissions'],
      users: ['Users', 'Manage user accounts'],
      services: ['Services', 'Service catalog management'],
      portfolio: ['Demo Projects', 'Manage website portfolio showcase items'],
      settings: ['Settings', 'Admin panel configuration'],
      maintenance: ['Maintenance Mode', 'Control website availability'],
    };

    const [title, sub] = titles[section] || [section, ''];
    const titleEl = document.getElementById('topbarTitle');
    const subEl = document.getElementById('topbarSub');
    if (titleEl) titleEl.textContent = title;
    if (subEl) subEl.textContent = sub;

    // Load section data (cache logic: fetch if forceReload or not yet loaded)
    if (forceReload || !this.loadedSections[section]) {
      this.loadedSections[section] = true;
      try {
        switch (section) {
          case 'dashboard': await BMSDashboard?.load(); break;
          case 'crm': await BMSCrm?.load(); break;
          case 'clients': await BMSClients?.load(); break;
          case 'projects': await BMSProjects?.load(); break;
          case 'tasks': await BMSTasks?.load(); break;
          case 'appointments': await BMSAppointments?.load(); break;
          case 'quotations': await BMSQuotations?.load(); break;
          case 'invoices': await BMSInvoices?.load(); break;
          case 'payments': await BMSPayments?.load(); break;
          case 'notifications': await BMSNotifications?.load(); break;
          case 'reports': await BMSReports?.load(); break;
          case 'ai': BMSAi?.init(); break;
          case 'inquiries': await BMS.loadInquiries(); break;
          case 'users': await BMS.loadUsers(); break;
          case 'services': await BMS.loadServices(); break;
          case 'portfolio': await BMS.loadPortfolio(); break;
          case 'settings': await BMS.loadSettings(); break;
          case 'maintenance': await BMS.loadMaintenance(); break;
        }
      } catch (err) {
        this.loadedSections[section] = false; // reset on error
        console.error(`Error loading section ${section}:`, err);
        BMS.showToast(`Failed to load ${section}: ${err.message}`, 'error');
      }
    }
  },

  async renderCategoriesList() {
    try {
      const services = await this.apiFetch('/api/services');
      const settings = await this.apiFetch('/api/admin/settings');
      const customCats = settings.customCategories || settings.custom_categories || [];
      
      // Find active categories used by services
      const activeCats = [...new Set(services.map(s => s.category.trim()))];
      
      // All unique categories
      const allCats = [...new Set([...activeCats, ...customCats])].filter(Boolean).sort();
      
      const tbody = document.getElementById('categoriesTableBody');
      if (!tbody) return;
      
      tbody.innerHTML = allCats.map(cat => {
        const isCustom = customCats.includes(cat);
        const isActive = activeCats.includes(cat);
        
        let actionsHTML = '';
        if (isCustom) {
          if (isActive) {
            actionsHTML = `<button class="btn-bms btn-bms-danger btn-bms-sm" style="opacity: 0.55;" onclick="BMS.deleteCategoryConfirm('${cat.replace(/'/g, "\\'")}', true)" title="Currently used by services, but can be removed from custom list">🗑</button>`;
          } else {
            actionsHTML = `<button class="btn-bms btn-bms-danger btn-bms-sm" onclick="BMS.deleteCategoryConfirm('${cat.replace(/'/g, "\\'")}', false)">🗑</button>`;
          }
        } else {
          // Active but not in custom list (implicit category from services)
          actionsHTML = `<span style="font-size: 11px; color: var(--bms-text-muted);">Active (In Service)</span>`;
        }
        
        return `
          <tr>
            <td><strong>${cat}</strong></td>
            <td style="text-align: center;">${actionsHTML}</td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      BMS.showToast('Failed to load categories: ' + err.message, 'error');
    }
  },

  deleteCategoryConfirm(catName, isUsed) {
    const msg = isUsed 
      ? `The category "${catName}" is currently used by active services. Deleting it will remove it from the customized categories autocomplete list, but services using it will remain. Proceed?`
      : `Are you sure you want to delete the category "${catName}"?`;
      
    BMS._confirmCallback = async () => {
      try {
        const settings = await BMS.apiFetch('/api/admin/settings');
        const currentCats = settings.customCategories || settings.custom_categories || [];
        const updatedCats = currentCats.filter(c => c.toLowerCase().trim() !== catName.toLowerCase().trim());
        
        await BMS.apiFetch('/api/admin/settings', {
          method: 'PUT',
          body: JSON.stringify({
            ...settings,
            customCategories: updatedCats
          })
        });
        
        BMS.showToast(`Category "${catName}" deleted successfully`, 'success');
        await BMS.renderCategoriesList();
        
        // Re-populate datalist in the background
        const services = await BMS.apiFetch('/api/services');
        const dl = document.getElementById('categoriesDatalist');
        if (dl) {
          const categories = [...new Set(services.map(s => s.category.trim()))];
          updatedCats.forEach(c => {
            if (!categories.includes(c.trim())) categories.push(c.trim());
          });
          dl.innerHTML = categories.filter(Boolean).map(c => `<option value="${c.replace(/"/g, '&quot;')}">`).join('');
        }
      } catch (err) {
        BMS.showToast('Failed to delete category: ' + err.message, 'error');
      }
    };
    
    document.getElementById('confirmMsg').textContent = msg;
    BMS.openModal('confirmModal');
  },

  logout() {
    localStorage.removeItem('ascorix_admin_token');
    localStorage.removeItem('ascorix_admin_user');
    window.location.href = '/admin';
  },

  startHeartbeat() {
    setInterval(async () => {
      try {
        const token = this.token || localStorage.getItem('ascorix_admin_token') || localStorage.getItem('ascorix_token');
        const r = await fetch('/api/auth/me', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (r.status === 404 || r.status === 403 || r.status === 401) {
          this.logout();
        }
      } catch (e) { }
    }, 30000);
  },

  startNotifPoll() {
    const fetchCount = async () => {
      try {
        const r = await BMS.apiFetch('/api/bms/notifications/unread-count');
        if (r && typeof r.count === 'number') {
          BMS.updateNotifBadge(r.count);
        }
      } catch (e) { }
    };
    fetchCount();
    setInterval(fetchCount, 60000);
  },

  updateNotifBadge(count) {
    const badges = [
      document.getElementById('topbarNotifCount'),
      document.getElementById('badge-notif')
    ];
    badges.forEach(b => {
      if (!b) return;
      b.textContent = count;
      count > 0 ? b.classList.remove('hidden') : b.classList.add('hidden');
    });
  },

  // ==========================================
  // API HELPER
  // ==========================================
  async apiFetch(url, options = {}) {
    const token = this.token || localStorage.getItem('ascorix_admin_token') || localStorage.getItem('ascorix_token');
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...(options.headers || {})
    };
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401 || res.status === 403) {
      this.logout();
      return;
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  },

  // ==========================================
  // TOAST
  // ==========================================
  showToast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('bmsToastContainer');
    if (!container) return;
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `bms-toast ${type}`;
    toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
  },

  // ==========================================
  // MODAL HELPERS
  // ==========================================
  setupModals() {
    document.querySelectorAll('.bms-modal-close, [data-modal]').forEach(btn => {
      btn.addEventListener('click', () => {
        const modalId = btn.getAttribute('data-modal');
        if (modalId) BMS.closeModal(modalId);
      });
    });

    // Close on overlay click
    document.querySelectorAll('.bms-modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.classList.remove('open');
        }
      });
    });

    // Confirm delete placeholder
    document.getElementById('confirmDeleteBtn')?.addEventListener('click', () => {
      if (BMS._confirmCallback) {
        BMS._confirmCallback();
        BMS._confirmCallback = null;
      }
      BMS.closeModal('confirmModal');
    });
  },

  openModal(id) {
    document.getElementById(id)?.classList.add('open');
  },

  closeModal(id) {
    document.getElementById(id)?.classList.remove('open');
  },

  confirm(message, callback, title = '⚠️ Confirm Delete', actionText = 'Delete', isDanger = true) {
    document.getElementById('confirmMsg').textContent = message;
    
    const titleEl = document.querySelector('#confirmModal .bms-modal-header h3');
    if (titleEl) titleEl.textContent = title;
    
    const actionBtn = document.getElementById('confirmDeleteBtn');
    if (actionBtn) {
      actionBtn.textContent = actionText;
      if (isDanger) {
        actionBtn.className = 'btn-bms btn-bms-danger';
      } else {
        actionBtn.className = 'btn-bms btn-bms-primary';
      }
    }

    BMS._confirmCallback = callback;
    BMS.openModal('confirmModal');
  },

  // ==========================================
  // FORMAT HELPERS
  // ==========================================
  formatCurrency(val) {
    const n = Number(val) || 0;
    return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  },

  formatDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  },

  formatQuotationNumber(num, dateStr) {
    if (!num) return '—';
    const year = dateStr ? new Date(dateStr).getFullYear() : new Date().getFullYear();
    const seq = String(num).padStart(4, '0');
    return `ATS-Q-${year}-${seq}`;
  },

  formatInvoiceNumber(num, dateStr) {
    if (!num) return '—';
    const year = dateStr ? new Date(dateStr).getFullYear() : new Date().getFullYear();
    const seq = String(num).padStart(4, '0');
    return `ATS-I-${year}-${seq}`;
  },

  // ==========================================
  // CLIENT PROFILE VIEW
  // ==========================================
  async openClientProfile(id) {
    BMS.openModal('clientDetailModal');
    const body = document.getElementById('clientDetailBody');
    if (!body) return;
    body.innerHTML = '<div class="bms-loading-overlay"><div class="bms-spinner"></div></div>';
    
    try {
      const client = await BMS.apiFetch(`/api/bms/clients/${id}`);
      document.getElementById('clientDetailName').innerHTML = `👤 Client Profile: ${client.company_name}`;
      
      const createQuoteBtn = document.getElementById('clientProfileCreateQuoteBtn');
      if (createQuoteBtn) {
        createQuoteBtn.onclick = () => {
          BMS.closeModal('clientDetailModal');
          BMS.createQuoteForClient(client);
        };
      }

      const projects = client.projects || [];
      const invoices = client.invoices || [];
      const payments = client.payments || [];

      let projectsHtml = projects.length === 0 ? '<p style="color:var(--bms-text-3); font-size: 13px;">No projects linked.</p>' : `
        <table class="bms-table" style="font-size:13px; margin-top:8px;">
          <thead>
            <tr><th>Project</th><th>Service</th><th>Budget</th><th>Status</th><th>Progress</th></tr>
          </thead>
          <tbody>
            ${projects.map(p => `
              <tr>
                <td><strong>${p.name}</strong></td>
                <td>${p.service_type || '—'}</td>
                <td>${BMS.formatCurrency(p.budget)}</td>
                <td>${BMS.statusBadge(p.status)}</td>
                <td>
                  <div style="display:flex; align-items:center; gap:8px;">
                    <div style="flex:1; background:var(--bms-bg-3); height:6px; border-radius:3px; overflow:hidden;">
                      <div style="background:var(--bms-blue-light); width:${p.progress}%; height:100%;"></div>
                    </div>
                    <span>${p.progress}%</span>
                  </div>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>`;

      let invoicesHtml = invoices.length === 0 ? '<p style="color:var(--bms-text-3); font-size: 13px;">No invoices linked.</p>' : `
        <table class="bms-table" style="font-size:13px; margin-top:8px;">
          <thead>
            <tr><th>Inv #</th><th>Due Date</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th></tr>
          </thead>
          <tbody>
            ${invoices.map(inv => `
              <tr>
                <td><strong>${BMS.formatInvoiceNumber(inv.invoice_number, inv.created_at)}</strong></td>
                <td>${BMS.formatDate(inv.due_date)}</td>
                <td><strong>${BMS.formatCurrency(inv.total)}</strong></td>
                <td><span style="color:var(--bms-green)">${BMS.formatCurrency(inv.amount_paid)}</span></td>
                <td><span style="color:${(inv.balance_due || 0) > 0 ? 'var(--bms-red)' : 'var(--bms-green)'}">${BMS.formatCurrency(inv.balance_due)}</span></td>
                <td>${BMS.statusBadge(inv.payment_status)}</td>
              </tr>`).join('')}
          </tbody>
        </table>`;

      let paymentsHtml = payments.length === 0 ? '<p style="color:var(--bms-text-3); font-size: 13px;">No payment transactions recorded.</p>' : `
        <table class="bms-table" style="font-size:13px; margin-top:8px;">
          <thead>
            <tr><th>Date</th><th>Amount</th><th>Method</th><th>Reference</th><th>Type</th></tr>
          </thead>
          <tbody>
            ${payments.map(p => `
              <tr>
                <td>${BMS.formatDate(p.payment_date || p.created_at)}</td>
                <td><strong style="color:var(--bms-green)">${BMS.formatCurrency(p.amount)}</strong></td>
                <td><span class="badge badge-blue">${p.payment_method || '—'}</span></td>
                <td><span style="color:var(--bms-text-2)">${p.reference || '—'}</span></td>
                <td><span class="badge badge-violet">${p.payment_type || '—'}</span></td>
              </tr>`).join('')}
          </tbody>
        </table>`;

      body.innerHTML = `
        <div style="display:grid; grid-template-columns: 1fr 2fr; gap:24px;">
          <div style="background: var(--bms-bg-2); padding: 20px; border-radius: 8px; border: 1px solid var(--bms-border);">
            <h4 style="margin: 0 0 16px; color: var(--bms-blue-light); border-bottom: 1px solid var(--bms-border); padding-bottom: 8px;">Client Information</h4>
            <div style="display:flex; flex-direction:column; gap:12px; font-size:13px;">
              <div><span style="color:var(--bms-text-3); display:block;">Company Name</span><strong>${client.company_name}</strong></div>
              <div><span style="color:var(--bms-text-3); display:block;">Contact Person</span>${client.contact_person}</div>
              <div><span style="color:var(--bms-text-3); display:block;">Email Address</span><a href="mailto:${client.email}" style="color:var(--bms-blue-light)">${client.email}</a></div>
              <div><span style="color:var(--bms-text-3); display:block;">Phone Number</span>${client.phone || '—'}</div>
              <div><span style="color:var(--bms-text-3); display:block;">WhatsApp Number</span>${client.whatsapp || '—'}</div>
              <div><span style="color:var(--bms-text-3); display:block;">GST Details</span>${client.gst || '—'}</div>
              <div><span style="color:var(--bms-text-3); display:block;">Location/City</span>${client.city || '—'}</div>
              <div><span style="color:var(--bms-text-3); display:block;">Full Address</span><span style="white-space:pre-line">${client.address || '—'}</span></div>
              <div><span style="color:var(--bms-text-3); display:block;">Status</span>${BMS.statusBadge(client.status)}</div>
            </div>
          </div>
          <div style="display:flex; flex-direction:column; gap:24px;">
            <div>
              <h4 style="margin: 0 0 8px; color: var(--bms-white);">🏗️ Active Projects</h4>
              ${projectsHtml}
            </div>
            <div>
              <h4 style="margin: 0 0 8px; color: var(--bms-white);">🧾 Billing & Invoices</h4>
              ${invoicesHtml}
            </div>
            <div>
              <h4 style="margin: 0 0 8px; color: var(--bms-white);">💰 Payments History</h4>
              ${paymentsHtml}
            </div>
          </div>
        </div>`;
    } catch (err) {
      body.innerHTML = `<p style="color:var(--bms-red)">Failed to load client details: ${err.message}</p>`;
    }
  },

  createQuoteForClient(client) {
    BMSQuotations.openAdd();
    document.getElementById('quoteClientName').value = client.company_name || client.contact_person;
    document.getElementById('quoteClientEmail').value = client.email;
    document.getElementById('quoteClientGst').value = client.gst || '';
    document.getElementById('quoteClientAddress').value = client.address || '';
    document.getElementById('quoteClientId').value = client._id || client.id;
    BMSQuotations.populateProjectsForClient(client._id || client.id);
  },

  formatDateTime(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  },

  timeAgo(dateStr) {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    return BMS.formatDate(dateStr);
  },

  statusBadge(status) {
    const map = {
      'New': 'badge-blue', 'Contacted': 'badge-cyan', 'Qualified': 'badge-violet',
      'Proposal Sent': 'badge-yellow', 'Negotiation': 'badge-orange', 'Won': 'badge-green', 'Lost': 'badge-red',
      'Active': 'badge-green', 'Inactive': 'badge-yellow', 'Churned': 'badge-red',
      'Pending': 'badge-yellow', 'Planning': 'badge-violet', 'UI Design': 'badge-cyan',
      'Development': 'badge-blue', 'Testing': 'badge-orange', 'Review': 'badge-violet',
      'Completed': 'badge-green', 'Delivered': 'badge-green',
      'In Progress': 'badge-blue',
      'Upcoming': 'badge-blue', 'Cancelled': 'badge-red', 'Rescheduled': 'badge-yellow',
      'Draft': 'badge-gray', 'Sent': 'badge-cyan', 'Accepted': 'badge-green', 'Rejected': 'badge-red', 'Expired': 'badge-orange',
      'Paid': 'badge-green', 'Partially Paid': 'badge-yellow', 'Overdue': 'badge-red',
      'Open': 'badge-blue', 'Resolved': 'badge-green',
      'Low': 'badge-gray', 'Medium': 'badge-blue', 'High': 'badge-orange', 'Urgent': 'badge-red',
      'Under Review': 'badge-violet',
    };
    const cls = map[status] || 'badge-gray';
    return `<span class="badge ${cls}">${status}</span>`;
  },

  priorityIcon(priority) {
    const icons = { Low: '🔵', Medium: '🟡', High: '🟠', Urgent: '🔴' };
    return icons[priority] || '⚪';
  },

  // ==========================================
  // DATALISTS (for autocomplete)
  // ==========================================
  async loadClientDatalist() {
    try {
      if (!this.clients.length) {
        this.clients = await BMS.apiFetch('/api/bms/clients');
      }
      ['clientsDatalist', 'clientsDatalistAppt', 'clientsDatalistQ', 'clientsDatalistI', 'clientsDatalistP'].forEach(id => {
        const dl = document.getElementById(id);
        if (!dl) return;
        dl.innerHTML = this.clients.map(c => `<option value="${c.company_name || c.contact_person}">`).join('');
      });
    } catch (e) { }
  },

  // ==========================================
  // LEGACY SECTIONS (Inquiries, Users, Services, Settings)
  // ==========================================
  async loadInquiries() {
    try {
      const data = await BMS.apiFetch('/api/inquiries');
      const tbody = document.getElementById('inquiriesTableBody');
      if (!tbody) return;
      if (!data.length) {
        tbody.innerHTML = `<tr><td colspan="6" class="bms-table-empty">No inquiries yet.</td></tr>`;
        return;
      }
      tbody.innerHTML = data.map(i => `
        <tr>
          <td>${BMS.formatDate(i.date)}</td>
          <td><strong>${i.name}</strong></td>
          <td>${i.email}</td>
          <td>${i.service}</td>
          <td>${BMS.statusBadge(i.status)}</td>
          <td>
            <div style="display:flex;gap:6px">
              <select class="bms-filter-select" style="padding:4px 8px;font-size:12px" onchange="BMS.updateInquiryStatus('${i._id}',this.value)">
                <option ${i.status === 'Pending' ? 'selected' : ''}>Pending</option>
                <option ${i.status === 'Under Review' ? 'selected' : ''}>Under Review</option>
                <option ${i.status === 'Completed' ? 'selected' : ''}>Completed</option>
              </select>
              <button class="btn-bms btn-bms-danger btn-bms-sm" onclick="BMS.deleteInquiry('${i._id}')">🗑</button>
            </div>
          </td>
        </tr>`).join('');

      // Search
      const searchEl = document.getElementById('inquiriesSearch');
      if (searchEl) {
        searchEl.oninput = () => {
          const q = searchEl.value.toLowerCase();
          document.querySelectorAll('#inquiriesTableBody tr').forEach(row => {
            row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
          });
        };
      }
    } catch (err) {
      BMS.showToast('Failed to load inquiries: ' + err.message, 'error');
    }
  },

  async updateInquiryStatus(id, status) {
    try {
      await BMS.apiFetch(`/api/inquiries/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      BMS.showToast('Status updated', 'success');
    } catch (err) { BMS.showToast(err.message, 'error'); }
  },

  async deleteInquiry(id) {
    BMS.confirm('Delete this inquiry?', async () => {
      try {
        await BMS.apiFetch(`/api/inquiries/${id}`, { method: 'DELETE' });
        BMS.showToast('Inquiry deleted', 'success');
        BMS.loadInquiries();
      } catch (err) { BMS.showToast(err.message, 'error'); }
    });
  },

  async loadUsers() {
    try {
      const data = await BMS.apiFetch('/api/admin/users');
      const tbody = document.getElementById('usersTableBody');
      if (!tbody) return;
      if (!data.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="bms-table-empty">No users found.</td></tr>`;
        return;
      }
      tbody.innerHTML = data.map(u => {
        const uId = u._id || u.id;
        const uName = (u.name || '').replace(/'/g, "\\'");
        const uEmail = (u.email || '').replace(/'/g, "\\'");
        const uPhone = (u.phone || '').replace(/'/g, "\\'");
        return `
        <tr>
          <td><strong>${u.name}</strong></td>
          <td>${u.email}</td>
          <td>${u.phone || '—'}</td>
          <td>${BMS.statusBadge(u.role === 'admin' ? 'Active' : 'Inactive').replace(u.role === 'admin' ? 'Active' : 'Inactive', u.role)}</td>
          <td>${u.is_verified ? '<span class="badge badge-green">✓ Verified</span>' : '<span class="badge badge-yellow">Pending</span>'}</td>
          <td>${BMS.formatDate(u.createdAt || u.created_at)}</td>
          <td>
            <div style="display:flex;gap:6px">
              <button class="btn-bms btn-bms-secondary btn-bms-sm" onclick="BMS.editUser('${uId}','${uName}','${uEmail}','${uPhone}','${u.role}')">✏️</button>
              <button class="btn-bms btn-bms-danger btn-bms-sm" onclick="BMS.deleteUser('${uId}')">🗑</button>
            </div>
          </td>
        </tr>`;
      }).join('');

      const searchEl = document.getElementById('usersSearch');
      if (searchEl) {
        searchEl.oninput = () => {
          const q = searchEl.value.toLowerCase();
          document.querySelectorAll('#usersTableBody tr').forEach(row => {
            row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
          });
        };
      }

      document.getElementById('addUserBtn')?.addEventListener('click', () => {
        document.getElementById('userId').value = '';
        document.getElementById('userForm').reset();
        document.getElementById('userModalTitle').textContent = 'Add User';
        document.getElementById('userPassword').required = true;
        BMS.openModal('userModal');
      });

      document.getElementById('saveUserBtn').onclick = () => BMS.saveUser();
    } catch (err) {
      BMS.showToast('Failed to load users: ' + err.message, 'error');
    }
  },

  editUser(id, name, email, phone, role) {
    document.getElementById('userId').value = id;
    document.getElementById('userName').value = name;
    document.getElementById('userEmail').value = email;
    if (document.getElementById('userPhone')) {
      document.getElementById('userPhone').value = phone || '';
    }
    document.getElementById('userRole').value = role;
    document.getElementById('userPassword').value = '';
    document.getElementById('userPassword').required = false;
    document.getElementById('userModalTitle').textContent = 'Edit User';
    BMS.openModal('userModal');
  },

  async saveUser() {
    const id = document.getElementById('userId').value;
    const body = {
      name: document.getElementById('userName').value.trim(),
      email: document.getElementById('userEmail').value.trim(),
      phone: document.getElementById('userPhone') ? document.getElementById('userPhone').value.trim() : '',
      role: document.getElementById('userRole').value,
    };
    const pwd = document.getElementById('userPassword').value;
    if (pwd) body.password = pwd;
    try {
      if (id) {
        await BMS.apiFetch(`/api/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(body) });
        BMS.showToast('User updated', 'success');
      } else {
        if (!pwd) return BMS.showToast('Password is required', 'error');
        await BMS.apiFetch('/api/admin/users', { method: 'POST', body: JSON.stringify(body) });
        BMS.showToast('User created', 'success');
      }
      BMS.closeModal('userModal');
      BMS.loadUsers();
    } catch (err) { BMS.showToast(err.message, 'error'); }
  },

  async deleteUser(id) {
    BMS.confirm('Delete this user? This cannot be undone.', async () => {
      try {
        await BMS.apiFetch(`/api/admin/users/${id}`, { method: 'DELETE' });
        BMS.showToast('User deleted', 'success');
        BMS.loadUsers();
      } catch (err) { BMS.showToast(err.message, 'error'); }
    });
  },

  async loadServices() {
    try {
      const data = await BMS.apiFetch('/api/services');
      const tbody = document.getElementById('servicesTableBody');
      if (!tbody) return;
      tbody.innerHTML = data.map(s => `
        <tr>
          <td><strong>${s.title}</strong></td>
          <td><span class="badge badge-blue">${s.category}</span></td>
          <td>${s.cost}</td>
          <td>
            <div style="display:flex;gap:6px">
              <button class="btn-bms btn-bms-secondary btn-bms-sm" onclick="BMS.editService(${JSON.stringify(s).replace(/"/g, '&quot;')})">✏️</button>
              <button class="btn-bms btn-bms-danger btn-bms-sm" onclick="BMS.deleteService('${s._id}')">🗑</button>
            </div>
          </td>
        </tr>`).join('');

      // Helper function to populate category datalist
      const populateCategoryDatalist = async () => {
        try {
          const categories = [...new Set(data.map(s => s.category.trim()))];
          const settings = await BMS.apiFetch('/api/admin/settings');
          const customCats = settings.customCategories || settings.custom_categories || [];
          customCats.forEach(c => {
            if (!categories.includes(c.trim())) categories.push(c.trim());
          });
          const dl = document.getElementById('categoriesDatalist');
          if (dl) {
            dl.innerHTML = categories.filter(Boolean).map(c => `<option value="${c.replace(/"/g, '&quot;')}">`).join('');
          }
        } catch (e) { console.warn('Could not populate categories datalist:', e); }
      };

      // View categories click handler
      const viewCatBtn = document.getElementById('viewCategoriesBtn');
      if (viewCatBtn && !viewCatBtn.dataset.bound) {
        viewCatBtn.dataset.bound = 'true';
        viewCatBtn.addEventListener('click', async () => {
          await BMS.renderCategoriesList();
          BMS.openModal('categoriesModal');
        });
      }

      // Add category click handler
      const addCatBtn = document.getElementById('addCategoryBtn');
      if (addCatBtn && !addCatBtn.dataset.bound) {
        addCatBtn.dataset.bound = 'true';
        addCatBtn.addEventListener('click', async () => {
          const catName = prompt('Enter name of new category:');
          if (!catName || !catName.trim()) return;
          try {
            const settings = await BMS.apiFetch('/api/admin/settings');
            const currentCats = settings.customCategories || settings.custom_categories || [];
            const newCat = catName.trim();
            if (currentCats.map(c => c.toLowerCase()).includes(newCat.toLowerCase())) {
              BMS.showToast('Category already exists', 'warning');
              return;
            }
            currentCats.push(newCat);
            await BMS.apiFetch('/api/admin/settings', {
              method: 'PUT',
              body: JSON.stringify({
                ...settings,
                customCategories: currentCats
              })
            });
            BMS.showToast(`Category "${newCat}" added successfully`, 'success');
            await populateCategoryDatalist();
          } catch (err) {
            BMS.showToast('Failed to add category: ' + err.message, 'error');
          }
        });
      }

      document.getElementById('addServiceBtn')?.addEventListener('click', async () => {
        document.getElementById('serviceId').value = '';
        document.getElementById('serviceForm').reset();
        document.getElementById('serviceIncluded').value = '';
        document.getElementById('serviceNotIncluded').value = '';
        document.getElementById('serviceModalTitle').textContent = 'Add Service';
        await populateCategoryDatalist();
        BMS.openModal('serviceModal');
      });
      document.getElementById('saveServiceBtn').onclick = () => BMS.saveService();
    } catch (err) { BMS.showToast('Failed to load services', 'error'); }
  },

  async editService(s) {
    document.getElementById('serviceId').value = s._id;
    document.getElementById('serviceTitle').value = s.title;
    document.getElementById('serviceCategory').value = s.category;
    document.getElementById('serviceCost').value = s.cost;
    document.getElementById('serviceOriginalPrice').value = s.original_price || '';
    document.getElementById('serviceDiscountPercent').value = s.discount_percent || '';

    // Parse description for General, Included, and Not Included parts
    const desc = s.description || '';
    const lines = desc.split('\n');
    let general = [];
    let included = [];
    let notIncluded = [];

    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith('+ ')) {
        included.push(trimmed.substring(2));
      } else if (trimmed.startsWith('- ')) {
        notIncluded.push(trimmed.substring(2));
      } else {
        general.push(line);
      }
    });

    document.getElementById('serviceDesc').value = general.join('\n').trim();
    document.getElementById('serviceIncluded').value = included.join('\n');
    document.getElementById('serviceNotIncluded').value = notIncluded.join('\n');

    document.getElementById('serviceModalTitle').textContent = 'Edit Service';

    // Fetch unique categories to populate dropdown autocomplete
    try {
      const services = await BMS.apiFetch('/api/services');
      const categories = [...new Set(services.map(ser => ser.category.trim()))];
      const settings = await BMS.apiFetch('/api/admin/settings');
      const customCats = settings.customCategories || settings.custom_categories || [];
      customCats.forEach(c => {
        if (!categories.includes(c.trim())) categories.push(c.trim());
      });
      const dl = document.getElementById('categoriesDatalist');
      if (dl) {
        dl.innerHTML = categories.filter(Boolean).map(c => `<option value="${c.replace(/"/g, '&quot;')}">`).join('');
      }
    } catch (e) {}

    BMS.openModal('serviceModal');
  },

  async saveService() {
    const id = document.getElementById('serviceId').value;
    const title = document.getElementById('serviceTitle').value.trim();
    const category = document.getElementById('serviceCategory').value.trim();
    const cost = document.getElementById('serviceCost').value.trim();
    const original_price = document.getElementById('serviceOriginalPrice').value;
    const discount_percent = document.getElementById('serviceDiscountPercent').value;

    const general = document.getElementById('serviceDesc').value.trim();
    const includedLines = document.getElementById('serviceIncluded').value.split('\n').map(l => l.trim()).filter(Boolean);
    const notIncludedLines = document.getElementById('serviceNotIncluded').value.split('\n').map(l => l.trim()).filter(Boolean);

    // Compile into a single description string
    let compiledDesc = general;
    if (includedLines.length > 0) {
      if (compiledDesc) compiledDesc += '\n';
      compiledDesc += includedLines.map(l => `+ ${l}`).join('\n');
    }
    if (notIncludedLines.length > 0) {
      if (compiledDesc) compiledDesc += '\n';
      compiledDesc += notIncludedLines.map(l => `- ${l}`).join('\n');
    }

    const body = {
      title,
      category,
      cost,
      original_price: original_price ? Number(original_price) : undefined,
      discount_percent: discount_percent ? Number(discount_percent) : undefined,
      description: compiledDesc
    };
    try {
      if (id) {
        await BMS.apiFetch(`/api/services/${id}`, { method: 'PUT', body: JSON.stringify(body) });
      } else {
        await BMS.apiFetch('/api/services', { method: 'POST', body: JSON.stringify(body) });
      }
      BMS.showToast('Service saved', 'success');
      BMS.closeModal('serviceModal');
      BMS.loadServices();
      bmsChannel.postMessage("services_updated");
    } catch (err) { BMS.showToast(err.message, 'error'); }
  },

  async deleteService(id) {
    BMS.confirm('Delete this service?', async () => {
      try {
        await BMS.apiFetch(`/api/services/${id}`, { method: 'DELETE' });
        BMS.showToast('Service deleted', 'success');
        BMS.loadServices();
        bmsChannel.postMessage("services_updated");
      } catch (err) { BMS.showToast(err.message, 'error'); }
    });
  },

  async loadSettings() {
    try {
      const [settings, dbConfig] = await Promise.all([
        BMS.apiFetch('/api/admin/settings'),
        BMS.apiFetch('/api/admin/db-config').catch(err => {
          console.warn('db-config endpoint missing. Server restart required.');
          return { provider: 'local', error: true };
        })
      ]);
      
      if (dbConfig.error) {
        setTimeout(() => BMS.showToast('Please restart your Node.js server to enable the Database Configuration panel.', 'warning', 8000), 500);
      }
      
      const container = document.getElementById('settingsContainer');
      if (!container) return;
      container.innerHTML = `
        <div style="max-width:800px; display: flex; gap: 24px; flex-wrap: wrap;">
          <div style="flex: 1; min-width: 300px;">
            <div class="bms-card mb-24">
              <div class="bms-card-header"><h3>🛒 Checkout Settings</h3></div>
              <div class="bms-form-group">
                <label>Enable Checkout</label>
                <select class="bms-select" id="settCheckout">
                  <option value="true" ${settings.checkoutEnabled ? 'selected' : ''}>Enabled</option>
                  <option value="false" ${!settings.checkoutEnabled ? 'selected' : ''}>Disabled</option>
                </select>
              </div>
              <div class="bms-form-group">
                <label>Pricing Margin Multiplier</label>
                <input class="bms-input" type="number" id="settMargin" value="${settings.pricingMargin || 1}" step="0.01" min="0.1" />
              </div>
              <div class="bms-form-group mt-16">
                <label>UPI QR Code</label>
                <div style="display:flex; align-items:center; gap:16px; margin-top:8px;">
                  <div id="settingsQrPreviewContainer" style="width:100px; height:100px; border:1px dashed var(--bms-border); border-radius:8px; display:flex; align-items:center; justify-content:center; overflow:hidden; background:var(--bms-bg-3)">
                    ${settings.upiQrCode ? `<img src="${settings.upiQrCode}" style="width:100%; height:100%; object-fit:contain;" />` : '<span style="font-size:11px;color:var(--bms-text-3)">No QR Code</span>'}
                  </div>
                  <div style="display:flex; flex-direction:column; gap:8px;">
                    <input class="bms-input" type="file" id="settQrCodeFile" accept="image/*" style="max-width:250px;" />
                    ${settings.upiQrCode ? `<button type="button" class="btn-bms btn-bms-danger btn-bms-sm" id="btnRemoveSettingsQr" style="align-self:flex-start;">Remove QR Code</button>` : ''}
                  </div>
                </div>
              </div>
              <button class="btn-bms btn-bms-primary" id="saveSettingsBtn">Save Settings</button>
            </div>
            
            <div class="bms-card">
              <div class="bms-card-header"><h3>🔑 Offer Codes</h3>
                <button class="btn-bms btn-bms-primary btn-bms-sm" id="addOfferCodeBtn">+ Add Code</button>
              </div>
              <div id="offerCodesContainer">Loading…</div>
            </div>
          </div>
          
          <div style="flex: 1; min-width: 300px;">
            <div class="bms-card mb-24">
              <div class="bms-card-header"><h3>🗄 Database Configuration</h3></div>
              <div class="bms-form-group">
                <label>Active Database Provider</label>
                <select class="bms-select" id="dbProvider">
                  <option value="supabase" ${dbConfig.provider === 'supabase' ? 'selected' : ''}>Supabase Cloud</option>
                  <option value="mongodb" ${dbConfig.provider === 'mongodb' ? 'selected' : ''}>MongoDB Cloud</option>
                  <option value="local" ${dbConfig.provider === 'local' ? 'selected' : ''}>Local Storage (Testing)</option>
                </select>
              </div>
              
              <div id="dbSupabaseConfig" style="display: ${dbConfig.provider === 'supabase' ? 'block' : 'none'};">
                <div class="bms-form-group mt-16">
                  <label>Supabase URL</label>
                  <input class="bms-input" type="text" id="dbSupabaseUrl" value="${dbConfig.supabaseUrl || ''}" placeholder="https://xxx.supabase.co" />
                </div>
                <div class="bms-form-group mt-16">
                  <label>Supabase anon/public Key</label>
                  <input class="bms-input" type="password" id="dbSupabaseKey" value="${dbConfig.supabaseKey || ''}" placeholder="eyJh..." />
                </div>
              </div>
              
              <div id="dbMongoConfig" style="display: ${dbConfig.provider === 'mongodb' ? 'block' : 'none'};">
                <div class="bms-form-group mt-16">
                  <label>MongoDB Connection URI</label>
                  <input class="bms-input" type="password" id="dbMongoUri" value="${dbConfig.mongoUri || ''}" placeholder="mongodb+srv://..." />
                </div>
              </div>
              
              <button class="btn-bms btn-bms-primary mt-16" id="saveDbConfigBtn">Save & Reconnect</button>
            </div>
          </div>
        </div>`;

      let upiQrCodeBase64 = settings.upiQrCode || '';
      
      const fileInput = document.getElementById('settQrCodeFile');
      if (fileInput) {
        fileInput.onchange = (e) => {
          const file = e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (evt) => {
            upiQrCodeBase64 = evt.target.result;
            const previewDiv = document.getElementById('settingsQrPreviewContainer');
            if (previewDiv) previewDiv.innerHTML = `<img src="${upiQrCodeBase64}" style="width:100%; height:100%; object-fit:contain;" />`;
            if (!document.getElementById('btnRemoveSettingsQr')) {
              const removeBtn = document.createElement('button');
              removeBtn.type = 'button';
              removeBtn.className = 'btn-bms btn-bms-danger btn-bms-sm';
              removeBtn.id = 'btnRemoveSettingsQr';
              removeBtn.style.alignSelf = 'flex-start';
              removeBtn.textContent = 'Remove QR Code';
              fileInput.parentNode.appendChild(removeBtn);
              removeBtn.onclick = () => {
                upiQrCodeBase64 = '';
                previewDiv.innerHTML = '<span style="font-size:11px;color:var(--bms-text-3)">No QR Code</span>';
                removeBtn.remove();
              };
            }
          };
          reader.readAsDataURL(file);
        };
      }

      const removeQrBtn = document.getElementById('btnRemoveSettingsQr');
      if (removeQrBtn) {
        removeQrBtn.onclick = () => {
          upiQrCodeBase64 = '';
          const previewDiv = document.getElementById('settingsQrPreviewContainer');
          if (previewDiv) previewDiv.innerHTML = '<span style="font-size:11px;color:var(--bms-text-3)">No QR Code</span>';
          removeQrBtn.remove();
        };
      }

      document.getElementById('saveSettingsBtn').onclick = async () => {
        try {
          await BMS.apiFetch('/api/admin/settings', {
            method: 'PUT',
            body: JSON.stringify({
              checkoutEnabled: document.getElementById('settCheckout').value === 'true',
              pricingMargin: parseFloat(document.getElementById('settMargin').value),
              upiQrCode: upiQrCodeBase64
            })
          });
          BMS.showToast('Settings saved', 'success');
        } catch (err) { BMS.showToast(err.message, 'error'); }
      };

      const providerSelect = document.getElementById('dbProvider');
      if (providerSelect) {
        providerSelect.onchange = (e) => {
          document.getElementById('dbSupabaseConfig').style.display = e.target.value === 'supabase' ? 'block' : 'none';
          document.getElementById('dbMongoConfig').style.display = e.target.value === 'mongodb' ? 'block' : 'none';
        };
      }

      const saveDbBtn = document.getElementById('saveDbConfigBtn');
      if (saveDbBtn) {
        saveDbBtn.onclick = async () => {
          const provider = document.getElementById('dbProvider').value;
          const payload = { provider };
          if (provider === 'supabase') {
            payload.supabaseUrl = document.getElementById('dbSupabaseUrl').value;
            payload.supabaseKey = document.getElementById('dbSupabaseKey').value;
          } else if (provider === 'mongodb') {
            payload.mongoUri = document.getElementById('dbMongoUri').value;
          }
          
          saveDbBtn.textContent = 'Connecting...';
          saveDbBtn.disabled = true;
          try {
            const res = await BMS.apiFetch('/api/admin/db-config', {
              method: 'POST',
              body: JSON.stringify(payload)
            });
            if (res.success) {
              BMS.showToast(res.message, 'success');
            } else {
              throw new Error("Failed to reconnect database");
            }
          } catch (err) {
            BMS.showToast(err.message, 'error');
          } finally {
            saveDbBtn.textContent = 'Save & Reconnect';
            saveDbBtn.disabled = false;
          }
        };
      }

      BMS.loadOfferCodes();
    } catch (err) { BMS.showToast('Failed to load settings', 'error'); }
  },

  // ==========================================
  // MAINTENANCE MODE
  // ==========================================
  async loadMaintenance() {
    try {
      const settings = await BMS.apiFetch('/api/admin/settings');
      const isActive = settings.maintenanceMode === true;
      const container = document.getElementById('maintenanceContainer');
      if (!container) return;

      container.innerHTML = `
        <div style="max-width: 680px;">

          <!-- Status Banner -->
          <div style="
            background: ${isActive ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.06)'};
            border: 1px solid ${isActive ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.25)'};
            border-radius: 14px;
            padding: 20px 24px;
            display: flex;
            align-items: center;
            gap: 16px;
            margin-bottom: 24px;
          ">
            <div style="
              width: 48px; height: 48px; flex-shrink: 0;
              border-radius: 12px;
              background: ${isActive ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)'};
              display: flex; align-items: center; justify-content: center;
              font-size: 22px;
            ">${isActive ? '\uD83D\uDEA7' : '\u2705'}</div>
            <div style="flex: 1;">
              <div style="font-weight: 700; font-size: 15px; color: ${isActive ? '#f87171' : '#34d399'};">
                ${isActive ? 'Maintenance Mode is ACTIVE' : 'Website is ONLINE'}
              </div>
              <div style="font-size: 13px; color: var(--bms-text-2); margin-top: 3px;">
                ${isActive
                  ? 'Visitors are seeing the maintenance page. The admin panel remains accessible.'
                  : 'Your website is fully operational and accessible to all visitors.'}
              </div>
            </div>
            <div id="maintStatusDot" style="
              width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0;
              background: ${isActive ? '#f87171' : '#34d399'};
              box-shadow: 0 0 0 4px ${isActive ? 'rgba(248,113,113,0.2)' : 'rgba(52,211,153,0.2)'};
            "></div>
          </div>

          <!-- Controls Card -->
          <div class="bms-card" style="margin-bottom: 24px;">
            <div class="bms-card-header"><h3>\uD83D\uDEE0\uFE0F Maintenance Controls</h3></div>

            <!-- Big Toggle -->
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 20px 0 24px; border-bottom: 1px solid var(--bms-border);">
              <div>
                <div style="font-weight: 600; font-size: 15px; color: var(--bms-text); margin-bottom: 4px;">Enable Maintenance Mode</div>
                <div style="font-size: 13px; color: var(--bms-text-2);">Redirect all public traffic to the maintenance page instantly.</div>
              </div>
              <label class="maint-toggle" style="position: relative; display: inline-block; width: 58px; height: 30px; cursor: pointer; flex-shrink: 0; margin-left: 16px;">
                <input type="checkbox" id="maintToggleCheck" ${isActive ? 'checked' : ''} style="opacity:0;width:0;height:0;position:absolute;" />
                <span class="maint-toggle-slider" style="
                  position: absolute; inset: 0;
                  background: ${isActive ? 'var(--bms-red, #ef4444)' : 'var(--bms-bg-3, #1e293b)'};
                  border-radius: 30px;
                  border: 1px solid ${isActive ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.1)'};
                  transition: all 0.25s ease;
                ">
                  <span style="
                    position: absolute;
                    width: 22px; height: 22px;
                    border-radius: 50%;
                    background: #fff;
                    top: 3px;
                    left: ${isActive ? '31px' : '3px'};
                    transition: left 0.25s ease;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.25);
                  "></span>
                </span>
              </label>
            </div>

            <!-- Banner Editor -->
            <div style="padding-top: 24px;">
              <label style="font-size: 13px; font-weight: 600; color: var(--bms-text-2); display: block; margin-bottom: 8px;">Maintenance Message</label>
              <textarea class="bms-textarea" id="maintBannerText" rows="3" placeholder="Enter the message visitors will see on the maintenance page..." style="resize: vertical;">${(settings.maintenanceBanner || '').replace(/</g, '&amp;lt;').replace(/>/g, '&amp;gt;')}</textarea>
              <div style="font-size: 11px; color: var(--bms-text-3); margin-top: 6px;">This message is shown to visitors on the maintenance page. Keep it informative and friendly.</div>
            </div>

            <div style="margin-top: 20px; display: flex; gap: 12px; flex-wrap: wrap; align-items: center;">
              <button class="btn-bms btn-bms-primary" id="saveMaintBtn" style="min-width:160px;">\uD83D\uDCBE Save Changes</button>
              <button class="btn-bms btn-bms-secondary" id="previewMaintBtn">\uD83D\uDC41\uFE0F Preview Page</button>
            </div>
          </div>

          <!-- Info Card -->
          <div class="bms-card">
            <div class="bms-card-header"><h3>\u2139\uFE0F How Maintenance Mode Works</h3></div>
            <div style="display: grid; gap: 16px; padding: 4px 0;">
              <div style="display: flex; gap: 14px; align-items: flex-start;">
                <div style="font-size: 20px; flex-shrink:0; margin-top:2px;">\uD83D\uDEA7</div>
                <div><div style="font-weight:600; font-size:13px; color:var(--bms-text);">Public Pages Blocked</div><div style="font-size:12px; color:var(--bms-text-2); margin-top:2px;">All public-facing pages (homepage, services, portfolio, etc.) redirect to the maintenance page with an HTTP 503 response.</div></div>
              </div>
              <div style="display: flex; gap: 14px; align-items: flex-start;">
                <div style="font-size: 20px; flex-shrink:0; margin-top:2px;">\uD83D\uDD12</div>
                <div><div style="font-weight:600; font-size:13px; color:var(--bms-text);">Admin Panel Always Accessible</div><div style="font-size:12px; color:var(--bms-text-2); margin-top:2px;">The admin panel (/admin.html) and all API routes remain fully accessible during maintenance.</div></div>
              </div>
              <div style="display: flex; gap: 14px; align-items: flex-start;">
                <div style="font-size: 20px; flex-shrink:0; margin-top:2px;">\u26A1</div>
                <div><div style="font-weight:600; font-size:13px; color:var(--bms-text);">Instant Toggle</div><div style="font-size:12px; color:var(--bms-text-2); margin-top:2px;">Changes take effect immediately — no server restart required. Just save and the site goes online/offline instantly.</div></div>
              </div>
              <div style="display: flex; gap: 14px; align-items: flex-start;">
                <div style="font-size: 20px; flex-shrink:0; margin-top:2px;">\uD83D\uDCCB</div>
                <div><div style="font-weight:600; font-size:13px; color:var(--bms-text);">SEO-Safe 503 Response</div><div style="font-size:12px; color:var(--bms-text-2); margin-top:2px;">The maintenance page returns HTTP 503 so search engines know the downtime is temporary and won't penalize your rankings.</div></div>
              </div>
            </div>
          </div>

        </div>

      `;

      // Wire up toggle visual
      const toggleCheck = document.getElementById('maintToggleCheck');
      const slider = container.querySelector('.maint-toggle-slider');
      const sliderKnob = slider?.querySelector('span');

      if (toggleCheck) {
        toggleCheck.onchange = () => {
          const on = toggleCheck.checked;
          if (slider) {
            slider.style.background = on ? 'var(--bms-red, #ef4444)' : 'var(--bms-bg-3, #1e293b)';
            slider.style.borderColor = on ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.1)';
          }
          if (sliderKnob) sliderKnob.style.left = on ? '31px' : '3px';
        };
      }

      // Save button
      document.getElementById('saveMaintBtn').onclick = async () => {
        const enabling = toggleCheck.checked;
        const bannerText = document.getElementById('maintBannerText').value.trim();
        const currentState = isActive;

        if (enabling && !currentState) {
          // Confirm enabling
          BMS.confirm(
            '\uD83D\uDEA7 This will take your website OFFLINE for all public visitors immediately. The admin panel will remain accessible. Are you sure?',
            async () => {
              await BMS._doSaveMaintenance(enabling, bannerText);
            },
            '\uD83D\uDEA7 Enable Maintenance Mode',
            'Enable Now',
            true
          );
        } else {
          await BMS._doSaveMaintenance(enabling, bannerText);
        }
      };

      // Preview button
      document.getElementById('previewMaintBtn').onclick = () => {
        const bannerText = document.getElementById('maintBannerText').value.trim() || settings.maintenanceBanner || '';
        BMS._showMaintenancePreviewModal(bannerText);
      };

    } catch (err) { BMS.showToast('Failed to load maintenance settings', 'error'); }
  },

  async _doSaveMaintenance(maintenanceMode, maintenanceBanner) {
    try {
      const settings = await BMS.apiFetch('/api/admin/settings');
      await BMS.apiFetch('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({ ...settings, maintenanceMode, maintenanceBanner })
      });
      BMS.showToast(maintenanceMode ? '\uD83D\uDEA7 Maintenance mode ENABLED — website is now offline.' : '\u2705 Maintenance mode DISABLED — website is back online.', maintenanceMode ? 'warning' : 'success');
      // Reload the section to reflect new state
      BMS.loadedSections['maintenance'] = false;
      await BMS.loadMaintenance();
    } catch (err) {
      const isMissingCol = err.message && (
        err.message.includes('maintenance_mode') ||
        err.message.includes('maintenance_banner') ||
        err.message.includes('schema cache')
      );
      if (isMissingCol) {
        BMS.showToast(
          '\u26A0\uFE0F Supabase needs a one-time schema migration. Open your Supabase SQL Editor and run:\n\nALTER TABLE public.settings ADD COLUMN IF NOT EXISTS maintenance_mode boolean default false;\nALTER TABLE public.settings ADD COLUMN IF NOT EXISTS maintenance_banner text default \'Maintenance in progress.\';',
          'warning',
          8000
        );
        // Show a more visible alert
        const msg = document.createElement('div');
        msg.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#1e293b;border:1px solid rgba(245,158,11,0.4);border-radius:12px;padding:16px 20px;max-width:560px;width:90%;z-index:9999;font-size:13px;color:#e2e8f0;box-shadow:0 8px 32px rgba(0,0,0,0.5);';
        msg.innerHTML = `
          <div style="font-weight:700;color:#fbbf24;margin-bottom:8px;">⚠️ Supabase Migration Required</div>
          <div style="color:#94a3b8;margin-bottom:12px;">The maintenance columns don't exist in your Supabase database yet. Run this SQL in your <a href="https://supabase.com/dashboard/project/wrjqyvgbzctbynupsnze/sql/new" target="_blank" style="color:#60a5fa;">Supabase SQL Editor</a>:</div>
          <code style="display:block;background:#0f172a;padding:10px 12px;border-radius:8px;font-size:11px;color:#34d399;white-space:pre;overflow-x:auto;">ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS maintenance_mode boolean default false;\nALTER TABLE public.settings ADD COLUMN IF NOT EXISTS maintenance_banner text default '🚧 Maintenance in progress. We will be back shortly.';</code>
          <button onclick="this.parentNode.remove()" style="margin-top:12px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.1);color:#94a3b8;border-radius:6px;padding:6px 14px;cursor:pointer;font-size:12px;">Dismiss</button>
        `;
        document.body.appendChild(msg);
      } else {
        BMS.showToast('Failed to save: ' + err.message, 'error');
      }
    }
  },

  _showMaintenancePreviewModal(bannerText) {
    const safe = (bannerText || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const existing = document.getElementById('maintPreviewOverlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'maintPreviewOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:linear-gradient(135deg,#f0f4ff 0%,#e8f0fe 50%,#f1f5f9 100%);display:flex;align-items:center;justify-content:center;padding:24px;font-family:Inter,sans-serif;';
    overlay.innerHTML = `
      <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(99,179,237,0.2);border-radius:20px;padding:48px 40px;max-width:520px;width:100%;text-align:center;backdrop-filter:blur(12px);box-shadow:0 25px 80px rgba(0,0,0,0.5);position:relative;">
        <button onclick="document.getElementById('maintPreviewOverlay').remove()" style="position:absolute;top:16px;right:16px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.1);color:#94a3b8;border-radius:8px;padding:6px 12px;cursor:pointer;font-size:12px;">✕ Close Preview</button>
        <div style="background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.25);border-radius:8px;padding:6px 14px;display:inline-flex;align-items:center;gap:8px;margin-bottom:24px;color:#f87171;font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;">
          <span style="width:8px;height:8px;border-radius:50%;background:#f87171;display:inline-block;animation:maintPulse 1.5s infinite;"></span>
          Maintenance Mode
        </div>
        <div style="width:64px;height:64px;background:linear-gradient(135deg,#3b82f6,#6366f1);border-radius:14px;display:inline-flex;align-items:center;justify-content:center;font-size:26px;font-weight:900;color:#fff;margin-bottom:20px;box-shadow:0 8px 32px rgba(99,102,241,0.4);">AX</div>
        <h1 style="font-size:26px;font-weight:800;color:#f1f5f9;margin-bottom:14px;">🚧 We'll Be Right Back</h1>
        <p style="font-size:14px;line-height:1.8;color:#94a3b8;margin-bottom:28px;">${safe}</p>
        <div style="width:100%;height:4px;background:rgba(255,255,255,0.08);border-radius:99px;overflow:hidden;margin-bottom:28px;">
          <div style="height:100%;background:linear-gradient(90deg,#3b82f6,#6366f1,#8b5cf6);border-radius:99px;width:60%;"></div>
        </div>
        <div style="font-size:12px;color:#475569;">Need urgent help? <a href="mailto:contact@ascorixtechsolutions.com" style="color:#60a5fa;text-decoration:none;">contact@ascorixtechsolutions.com</a></div>
      </div>
    `;
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  },

  async loadOfferCodes() {
    try {
      const codes = await BMS.apiFetch('/api/admin/offercodes');
      const container = document.getElementById('offerCodesContainer');
      if (!container) return;
      container.innerHTML = codes.length
        ? `<div class="bms-table-wrap"><table class="bms-table">
          <thead><tr><th>Code</th><th>Discount</th><th>Active</th><th>Actions</th></tr></thead>
          <tbody>${codes.map(c => `<tr>
            <td><strong>${c.code}</strong></td>
            <td>${c.discount}%</td>
            <td>${c.active ? '<span class="badge badge-green">Active</span>' : '<span class="badge badge-red">Inactive</span>'}</td>
            <td><button class="btn-bms btn-bms-danger btn-bms-sm" onclick="BMS.deleteOfferCode('${c._id}')">🗑</button></td>
          </tr>`).join('')}</tbody>
        </table></div>`
        : '<p class="text-muted">No offer codes yet.</p>';

      document.getElementById('addOfferCodeBtn').onclick = async () => {
        const code = prompt('Enter promo code (e.g. SAVE20):');
        if (!code) return;
        const disc = prompt('Discount percentage (1-100):');
        if (!disc || isNaN(disc)) return;
        try {
          await BMS.apiFetch('/api/admin/offercodes', {
            method: 'POST',
            body: JSON.stringify({ code: code.toUpperCase(), discount: parseInt(disc), active: true })
          });
          BMS.showToast('Offer code added', 'success');
          BMS.loadOfferCodes();
        } catch (err) { BMS.showToast(err.message, 'error'); }
      };
    } catch (err) { }
  },

  async deleteOfferCode(id) {
    BMS.confirm('Delete this offer code?', async () => {
      try {
        await BMS.apiFetch(`/api/admin/offercodes/${id}`, { method: 'DELETE' });
        BMS.showToast('Offer code deleted', 'success');
        BMS.loadOfferCodes();
      } catch (err) { BMS.showToast(err.message, 'error'); }
    });
  },

  switchPortfolioTab(tabId) {
    document.querySelectorAll('.portfolio-form-tab').forEach(el => el.style.display = 'none');
    const target = document.getElementById(`portfolio-${tabId}`);
    if (target) target.style.display = 'block';

    const tabHeader = document.querySelector('.modal-tabs');
    if (tabHeader) {
      tabHeader.querySelectorAll('button').forEach(btn => {
        if (btn.getAttribute('onclick').includes(tabId)) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    }
  },

  async loadPortfolio() {
    try {
      const data = await BMS.apiFetch('/api/portfolio');
      
      const projects = data.map(p => {
        let meta = {};
        try {
          meta = JSON.parse(p.description);
        } catch (e) {
          meta = {
            type: 'Demo Project',
            published: true,
            featured: false,
            short_desc: p.description,
            full_desc: p.description,
            slug: p.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            features: [],
            status: 'Completed',
            client_name: '',
            company_name: '',
            client_url: '',
            show_client: false,
            show_logo: false,
            show_testimonial: false,
            testimonial: '',
            img_desktop: '',
            img_mobile: '',
            img_tablet: '',
            img_admin: '',
            gallery: [],
            industry: 'Technology',
            dev_time: '2 Weeks',
            launch_date: '',
            demo_url: '',
            live_url: '',
            github_url: '',
            video_url: '',
            show_home: true,
            show_page: true,
            order: 0,
            meta_title: '',
            meta_desc: '',
            meta_keywords: '',
            og_image: ''
          };
        }
        return { ...p, meta };
      });

      const total = projects.length;
      const demo = projects.filter(p => p.meta.type === 'Demo Project').length;
      const client = projects.filter(p => p.meta.type === 'Client Project').length;
      const featured = projects.filter(p => p.meta.featured === true || p.meta.featured === 'true').length;
      const published = projects.filter(p => p.meta.published === true || p.meta.published === 'true').length;
      const drafts = total - published;

      document.getElementById('pm-total-projects').textContent = total;
      document.getElementById('pm-demo-projects').textContent = demo;
      document.getElementById('pm-client-projects').textContent = client;
      document.getElementById('pm-featured-projects').textContent = featured;
      document.getElementById('pm-published-projects').textContent = published;
      document.getElementById('pm-draft-projects').textContent = drafts;

      let currentFilter = 'all';
      let searchQuery = '';

      const renderGrid = () => {
        const grid = document.getElementById('portfolioCardGrid');
        if (!grid) return;

        let filtered = projects.filter(p => {
          const term = searchQuery.toLowerCase();
          const matchesSearch = !term || 
            p.title.toLowerCase().includes(term) ||
            p.category.toLowerCase().includes(term) ||
            p.tech.some(t => t.toLowerCase().includes(term)) ||
            (p.meta.industry && p.meta.industry.toLowerCase().includes(term));

          if (!matchesSearch) return false;

          if (currentFilter === 'all') return true;
          if (currentFilter === 'demo') return p.meta.type === 'Demo Project';
          if (currentFilter === 'client') return p.meta.type === 'Client Project';
          if (currentFilter === 'featured') return p.meta.featured === true || p.meta.featured === 'true';
          if (currentFilter === 'published') return p.meta.published === true || p.meta.published === 'true';
          if (currentFilter === 'draft') return p.meta.published === false || p.meta.published === 'false';
          return true;
        });

        if (filtered.length === 0) {
          grid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--bms-text-3);">No projects found matching the criteria.</div>`;
          return;
        }

        grid.innerHTML = filtered.map(p => {
          const typeBadge = p.meta.type === 'Client Project' ? 'badge-green' : 'badge-blue';
          const pubStatus = (p.meta.published === true || p.meta.published === 'true') ? 'Published' : 'Draft';
          const pubBadge = pubStatus === 'Published' ? 'badge-green' : 'badge-red';
          const featuredHtml = (p.meta.featured === true || p.meta.featured === 'true') ? `<span class="badge badge-orange" style="margin-left:5px">★ Featured</span>` : '';
          
          return `
            <div class="bms-card" style="padding: 0; overflow: hidden; display: flex; flex-direction: column;">
              <div style="width: 100%; height: 160px; position: relative; background: #111;">
                <img src="${p.image}" alt="${p.title}" style="width: 100%; height: 100%; object-fit: cover;">
                <span class="badge ${typeBadge}" style="position: absolute; top: 12px; left: 12px; font-size: 11px;">${p.meta.type}</span>
                <span class="badge ${pubBadge}" style="position: absolute; top: 12px; right: 12px; font-size: 11px;">${pubStatus}</span>
              </div>
              <div style="padding: 16px; flex-grow: 1; display: flex; flex-direction: column; justify-content: space-between;">
                <div>
                  <div style="font-size: 11px; color: var(--bms-text-3); text-transform: uppercase; font-weight: 600;">${p.category} ${featuredHtml}</div>
                  <h4 style="margin: 8px 0; color: #fff; font-size: 16px;">${p.title}</h4>
                  <p style="font-size: 12px; color: var(--bms-text-2); line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${p.meta.short_desc || p.meta.full_desc || ''}</p>
                </div>
                <div style="margin-top: 15px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 12px;">
                  <div style="font-size: 11px; color: var(--bms-text-3); margin-bottom: 12px;">Launch: ${p.meta.launch_date || 'N/A'} · Status: <strong>${p.meta.status}</strong></div>
                  <div style="display: flex; gap: 8px; justify-content: space-between; align-items: center;">
                    <div style="display: flex; gap: 4px;">
                      <button class="btn-bms btn-bms-secondary btn-bms-sm" onclick="BMS.editPortfolio(${JSON.stringify(p).replace(/"/g, '&quot;')})" title="Edit Project">✏️</button>
                      <button class="btn-bms btn-bms-secondary btn-bms-sm" onclick="BMS.duplicatePortfolio('${p._id || p.id}')" title="Duplicate Project">📋</button>
                      <button class="btn-bms btn-bms-danger btn-bms-sm" onclick="BMS.deletePortfolio('${p._id || p.id}')" title="Delete Project">🗑</button>
                    </div>
                    <button class="btn-bms btn-bms-sm btn-bms-secondary" onclick="BMS.togglePublishPortfolio('${p._id || p.id}', ${p.meta.published})">
                      ${pubStatus === 'Published' ? 'Unpublish' : 'Publish'}
                    </button>
                  </div>
                </div>
              </div>
            </div>`;
        }).join('');
      };

      const searchInput = document.getElementById('portfolioSearch');
      if (searchInput) {
        searchInput.oninput = (e) => {
          searchQuery = e.target.value;
          renderGrid();
        };
      }

      const filters = document.getElementById('portfolioAdminFilters');
      if (filters) {
        filters.querySelectorAll('button').forEach(btn => {
          btn.onclick = () => {
            filters.querySelectorAll('button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.getAttribute('data-filter');
            renderGrid();
          };
        });
      }

      const addBtn = document.getElementById('addPortfolioBtn');
      if (addBtn && !addBtn.dataset.bound) {
        addBtn.dataset.bound = 'true';
        addBtn.addEventListener('click', () => {
          document.getElementById('portfolioId').value = '';
          document.getElementById('portfolioForm').reset();
          const zipInput = document.getElementById('portfolioZipFile');
          if (zipInput) zipInput.value = '';
          const statusDiv = document.getElementById('zipUploadStatus');
          if (statusDiv) statusDiv.innerHTML = 'Upload a ZIP of static website files to auto-host under slug subdomain.';
          const checkGrid = document.getElementById('portfolioTechOptions');
          if (checkGrid) {
            checkGrid.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
          }
          document.getElementById('portfolioModalTitle').textContent = 'Add Portfolio Project';
          BMS.switchPortfolioTab('basic-tab');
          BMS.openModal('portfolioModal');
        });
      }
      document.getElementById('savePortfolioBtn').onclick = () => BMS.savePortfolio();

      // ZIP file change / upload handler
      const zipFileInput = document.getElementById('portfolioZipFile');
      if (zipFileInput && !zipFileInput.dataset.bound) {
        zipFileInput.dataset.bound = 'true';
        zipFileInput.addEventListener('change', async (e) => {
          const file = e.target.files[0];
          if (!file) return;

          const slug = document.getElementById('portfolioSlug').value.trim();
          const statusDiv = document.getElementById('zipUploadStatus');

          if (!slug) {
            BMS.showToast('Please enter a Project Name / Slug first.', 'warning');
            zipFileInput.value = '';
            return;
          }

          statusDiv.innerHTML = '<span style="color:#3b82f6;">Uploading and extracting ZIP folder...</span>';
          
          const formData = new FormData();
          formData.append('zipFile', file);
          formData.append('slug', slug);

          try {
            const res = await fetch('/api/portfolio/upload-demo', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${BMS.token}`
              },
              body: formData
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to upload ZIP.');

            statusDiv.innerHTML = `<span style="color:#10b981;">✓ Successfully hosted at <a href="${data.demoUrl}" target="_blank" style="color:#10b981;text-decoration:underline;">${data.demoUrl}</a></span>`;
            document.getElementById('portfolioDemoUrl').value = data.demoUrl;
            BMS.showToast('Project ZIP uploaded and subdomain created!', 'success');
          } catch (err) {
            statusDiv.innerHTML = `<span style="color:#ef4444;">✕ Error: ${err.message}</span>`;
            BMS.showToast(err.message, 'error');
            zipFileInput.value = '';
          }
        });
      }

      renderGrid();
    } catch (err) { BMS.showToast('Failed to load portfolio dashboard', 'error'); }
  },

  async editPortfolio(p) {
    const zipInput = document.getElementById('portfolioZipFile');
    if (zipInput) zipInput.value = '';
    const statusDiv = document.getElementById('zipUploadStatus');
    if (statusDiv) statusDiv.innerHTML = 'Upload a ZIP of static website files to auto-host under slug subdomain.';

    document.getElementById('portfolioId').value = p._id || p.id;
    document.getElementById('portfolioTitle').value = p.title;
    document.getElementById('portfolioSlug').value = p.meta.slug || '';
    document.getElementById('portfolioType').value = p.meta.type || 'Demo Project';
    
    const catSelect = document.getElementById('portfolioCategory');
    if (catSelect) {
      let exists = false;
      for (let i = 0; i < catSelect.options.length; i++) {
        if (catSelect.options[i].value === p.category) {
          exists = true;
          break;
        }
      }
      if (!exists && p.category) {
        const opt = document.createElement('option');
        opt.value = p.category;
        opt.textContent = p.category;
        catSelect.appendChild(opt);
      }
      catSelect.value = p.category || 'Technology';
    }
    document.getElementById('portfolioShortDesc').value = p.meta.short_desc || '';
    document.getElementById('portfolioDescription').value = p.meta.full_desc || p.description || '';
    
    document.getElementById('portfolioProblem').value = p.meta.problem || '';
    document.getElementById('portfolioSolution').value = p.meta.solution || '';

    document.getElementById('portfolioClientName').value = p.meta.client_name || '';
    document.getElementById('portfolioCompany').value = p.meta.company_name || '';
    document.getElementById('portfolioClientUrl').value = p.meta.client_url || '';
    document.getElementById('portfolioShowClient').value = String(p.meta.show_client === true || p.meta.show_client === 'true');
    document.getElementById('portfolioShowLogo').value = String(p.meta.show_logo === true || p.meta.show_logo === 'true');
    document.getElementById('portfolioShowTestimonial').value = String(p.meta.show_testimonial === true || p.meta.show_testimonial === 'true');
    document.getElementById('portfolioTestimonial').value = p.meta.testimonial || '';

    document.getElementById('portfolioImage').value = p.image;
    document.getElementById('portfolioImgDesktop').value = p.meta.img_desktop || '';
    document.getElementById('portfolioImgMobile').value = p.meta.img_mobile || '';
    document.getElementById('portfolioImgTablet').value = p.meta.img_tablet || '';
    document.getElementById('portfolioImgAdmin').value = p.meta.img_admin || '';
    document.getElementById('portfolioGallery').value = (p.meta.gallery || []).join('\n');

    document.getElementById('portfolioFeatures').value = (p.meta.features || []).join(', ');
    
    const checkGrid = document.getElementById('portfolioTechOptions');
    if (checkGrid) {
      checkGrid.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.checked = p.tech.includes(cb.value);
      });
    }

    document.getElementById('portfolioIndustry').value = p.meta.industry || '';
    document.getElementById('portfolioDevTime').value = p.meta.dev_time || '';
    document.getElementById('portfolioLaunchDate').value = p.meta.launch_date || '';
    document.getElementById('portfolioStatus').value = p.meta.status || 'Completed';
    document.getElementById('portfolioDemoUrl').value = p.meta.demo_url || '';
    document.getElementById('portfolioLiveUrl').value = p.meta.live_url || '';
    document.getElementById('portfolioGithubUrl').value = p.meta.github_url || '';
    document.getElementById('portfolioVideoUrl').value = p.meta.video_url || '';
    
    document.getElementById('portfolioIsFeatured').value = String(p.meta.featured === true || p.meta.featured === 'true');
    document.getElementById('portfolioShowHome').value = String(p.meta.show_home === true || p.meta.show_home === 'true');
    document.getElementById('portfolioShowPage').value = String(p.meta.show_page === true || p.meta.show_page === 'true');
    document.getElementById('portfolioOrder').value = p.meta.order || 0;
    document.getElementById('portfolioPublished').value = String(p.meta.published === true || p.meta.published === 'true');

    document.getElementById('portfolioMetaTitle').value = p.meta.meta_title || '';
    document.getElementById('portfolioOgImage').value = p.meta.og_image || '';
    document.getElementById('portfolioMetaKeywords').value = p.meta.meta_keywords || '';
    document.getElementById('portfolioMetaDesc').value = p.meta.meta_desc || '';

    document.getElementById('portfolioModalTitle').textContent = 'Edit Portfolio Project';
    BMS.switchPortfolioTab('basic-tab');
    BMS.openModal('portfolioModal');
  },

  async savePortfolio() {
    const id = document.getElementById('portfolioId').value;
    const title = document.getElementById('portfolioTitle').value.trim();
    const slug = document.getElementById('portfolioSlug').value.trim();
    const type = document.getElementById('portfolioType').value;
    const category = document.getElementById('portfolioCategory').value;
    const short_desc = document.getElementById('portfolioShortDesc').value.trim();
    const full_desc = document.getElementById('portfolioDescription').value.trim();

    const problem = document.getElementById('portfolioProblem').value.trim();
    const solution = document.getElementById('portfolioSolution').value.trim();

    const client_name = document.getElementById('portfolioClientName').value.trim();
    const company_name = document.getElementById('portfolioCompany').value.trim();
    const client_url = document.getElementById('portfolioClientUrl').value.trim();
    const show_client = document.getElementById('portfolioShowClient').value === 'true';
    const show_logo = document.getElementById('portfolioShowLogo').value === 'true';
    const show_testimonial = document.getElementById('portfolioShowTestimonial').value === 'true';
    const testimonial = document.getElementById('portfolioTestimonial').value.trim();

    const image = document.getElementById('portfolioImage').value.trim();
    const img_desktop = document.getElementById('portfolioImgDesktop').value.trim();
    const img_mobile = document.getElementById('portfolioImgMobile').value.trim();
    const img_tablet = document.getElementById('portfolioImgTablet').value.trim();
    const img_admin = document.getElementById('portfolioImgAdmin').value.trim();
    const gallery = document.getElementById('portfolioGallery').value.split('\n').map(l => l.trim()).filter(Boolean);

    const featuresInput = document.getElementById('portfolioFeatures').value.trim();
    const features = featuresInput.split(',').map(f => f.trim()).filter(Boolean);

    const tech = [];
    const checkGrid = document.getElementById('portfolioTechOptions');
    if (checkGrid) {
      checkGrid.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
        tech.push(cb.value);
      });
    }

    const industry = document.getElementById('portfolioIndustry').value.trim();
    const dev_time = document.getElementById('portfolioDevTime').value.trim();
    const launch_date = document.getElementById('portfolioLaunchDate').value;
    const status = document.getElementById('portfolioStatus').value;
    const demo_url = document.getElementById('portfolioDemoUrl').value.trim();
    const live_url = document.getElementById('portfolioLiveUrl').value.trim();
    const github_url = document.getElementById('portfolioGithubUrl').value.trim();
    const video_url = document.getElementById('portfolioVideoUrl').value.trim();

    const featured = document.getElementById('portfolioIsFeatured').value === 'true';
    const show_home = document.getElementById('portfolioShowHome').value === 'true';
    const show_page = document.getElementById('portfolioShowPage').value === 'true';
    const order = parseInt(document.getElementById('portfolioOrder').value) || 0;
    const published = document.getElementById('portfolioPublished').value === 'true';

    const meta_title = document.getElementById('portfolioMetaTitle').value.trim();
    const og_image = document.getElementById('portfolioOgImage').value.trim();
    const meta_keywords = document.getElementById('portfolioMetaKeywords').value.trim();
    const meta_desc = document.getElementById('portfolioMetaDesc').value.trim();

    if (!title || !slug || !image || !full_desc || !short_desc) {
      BMS.showToast('Please fill all basic info, thumbnail, and short description.', 'warning');
      return;
    }

    const metaPayload = {
      slug,
      type,
      short_desc,
      full_desc,
      problem,
      solution,
      client_name,
      company_name,
      client_url,
      show_client,
      show_logo,
      show_testimonial,
      testimonial,
      img_desktop,
      img_mobile,
      img_tablet,
      img_admin,
      gallery,
      features,
      industry,
      dev_time,
      launch_date,
      status,
      demo_url,
      live_url,
      github_url,
      video_url,
      featured,
      show_home,
      show_page,
      order,
      published,
      meta_title,
      og_image,
      meta_keywords,
      meta_desc
    };

    const description = JSON.stringify(metaPayload);
    const body = { title, category, image, tech, description };

    try {
      if (id) {
        await BMS.apiFetch(`/api/portfolio/${id}`, { method: 'PUT', body: JSON.stringify(body) });
      } else {
        await BMS.apiFetch('/api/portfolio', { method: 'POST', body: JSON.stringify(body) });
      }
      BMS.showToast('Portfolio project saved successfully', 'success');
      BMS.closeModal('portfolioModal');
      BMS.loadPortfolio();
    } catch (err) { BMS.showToast(err.message, 'error'); }
  },

  async deletePortfolio(id) {
    BMS.confirm('Are you sure you want to delete this project? This action is permanent.', async () => {
      try {
        await BMS.apiFetch(`/api/portfolio/${id}`, { method: 'DELETE' });
        BMS.showToast('Project deleted successfully', 'success');
        BMS.loadPortfolio();
      } catch (err) { BMS.showToast(err.message, 'error'); }
    });
  },

  async duplicatePortfolio(id) {
    try {
      await BMS.apiFetch(`/api/portfolio/${id}/duplicate`, { method: 'POST' });
      BMS.showToast('Project duplicated successfully', 'success');
      BMS.loadPortfolio();
    } catch (err) { BMS.showToast(err.message, 'error'); }
  },

  async togglePublishPortfolio(id, currentPublished) {
    try {
      const list = await BMS.apiFetch('/api/portfolio');
      const item = list.find(p => (p._id || p.id) === id);
      if (!item) return;

      let meta = {};
      try {
        meta = JSON.parse(item.description);
      } catch (e) {
        meta = { short_desc: item.description, full_desc: item.description };
      }

      meta.published = !currentPublished;
      item.description = JSON.stringify(meta);

      await BMS.apiFetch(`/api/portfolio/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: item.title,
          category: item.category,
          tech: item.tech,
          image: item.image,
          description: item.description
        })
      });
      BMS.showToast(meta.published ? 'Project published' : 'Project reverted to draft', 'success');
      BMS.loadPortfolio();
    } catch (err) { BMS.showToast('Failed to toggle publish status: ' + err.message, 'error'); }
  },

  setupTopbar() {
    document.querySelectorAll('[data-section]').forEach(el => {
      if (el.tagName === 'BUTTON' && !el.classList.contains('bms-nav-item')) {
        el.addEventListener('click', () => BMS.navigate(el.getAttribute('data-section')));
      }
    });
  }
};
window.BMS = BMS;

    // ==========================================
    // DASHBOARD MODULE
    // ==========================================
    const BMSDashboard = {
      charts: {},

      async load() {
        try {
          const data = await BMS.apiFetch('/api/bms/dashboard');
          this.renderKpis(data);
          this.renderCharts(data.charts);
          this.renderPipeline(data.leads);
        } catch (err) {
          BMS.showToast('Dashboard load failed: ' + err.message, 'error');
        }
      },

      renderKpis(data) {
        const l = data.leads;
        const f = data.finance;
        const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        setText('kpi-total-leads', l.total);
        setText('kpi-new-leads-sub', `${l.new || 0} new · ${l.contacted || 0} contacted`);
        setText('kpi-won', l.won || 0);
        setText('kpi-converted-sub', `${l.lost || 0} lost leads`);
        setText('kpi-active-projects', data.projects.active);
        setText('kpi-projects-sub', `${data.projects.pending} pending · ${data.projects.completed} done`);
        setText('kpi-revenue', BMS.formatCurrency(f.monthly_revenue));
        setText('kpi-pending-sub', `Yearly: ${BMS.formatCurrency(f.yearly_revenue)}`);
        setText('kpi-clients', data.clients.total);
        setText('kpi-clients-sub', `${data.clients.active} active`);
        setText('kpi-meetings', data.meetings.upcoming);
        setText('kpi-pending-inv', BMS.formatCurrency(f.pending_amount));
        setText('kpi-completed', data.projects.completed);
      },

      renderCharts(charts) {
        BMSCharts?.renderDashboardCharts(charts);
      },

      renderPipeline(leads) {
        const el = document.getElementById('dashPipelineContent');
        if (!el) return;
        const stages = [
          { label: 'New', key: 'new', color: '#3b82f6' },
          { label: 'Contacted', key: 'contacted', color: '#06b6d4' },
          { label: 'Qualified', key: 'qualified', color: '#8b5cf6' },
          { label: 'Proposal', key: 'proposal_sent', color: '#f59e0b' },
          { label: 'Negotiation', key: 'negotiation', color: '#f97316' },
          { label: 'Won', key: 'won', color: '#10b981' },
          { label: 'Lost', key: 'lost', color: '#ef4444' },
        ];
        const total = leads.total || 1;
        el.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:12px;padding:4px 0">
      ${stages.map(s => `
        <div style="text-align:center;padding:16px 8px;background:rgba(${s.color === '#3b82f6' ? '59,130,246' : s.color === '#10b981' ? '16,185,129' : '148,163,184'},0.08);border-radius:10px;border:1px solid rgba(255,255,255,0.06)">
          <div style="font-size:24px;font-weight:800;color:${s.color}">${leads[s.key] || 0}</div>
          <div style="font-size:11px;color:var(--bms-text-2);margin-top:4px">${s.label}</div>
        </div>`).join('')}
    </div>`;

        // View all leads link
        document.getElementById('viewAllLeads')?.addEventListener('click', () => BMS.navigate('crm'));
      }
    };
    window.BMSDashboard = BMSDashboard;

    document.addEventListener('DOMContentLoaded', () => {
      BMS.init();

      // Password toggle handler
      document.addEventListener('click', e => {
        const toggleBtn = e.target.closest('.toggle-password-btn');
        if (toggleBtn) {
          const targetId = toggleBtn.getAttribute('data-target');
          const input = document.getElementById(targetId);
          if (!input) return;
          const eyeIcon = toggleBtn.querySelector('.eye-icon');
          const eyeOffIcon = toggleBtn.querySelector('.eye-off-icon');
          if (input.type === 'password') {
            input.type = 'text';
            if (eyeIcon) eyeIcon.style.display = 'none';
            if (eyeOffIcon) eyeOffIcon.style.display = 'block';
          } else {
            input.type = 'password';
            if (eyeIcon) eyeIcon.style.display = 'block';
            if (eyeOffIcon) eyeOffIcon.style.display = 'none';
          }
        }
      });

      // Also trigger viewAllLeads button in dashboard
      document.addEventListener('click', e => {
        const btn = e.target.closest('[data-section]');
        if (btn && !btn.classList.contains('bms-nav-item') && !btn.classList.contains('bms-modal-close')) {
          const s = btn.getAttribute('data-section');
          if (s) BMS.navigate(s);
        }
      });
    });
