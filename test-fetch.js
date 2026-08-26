import { db } from './db.js';
window.db = db;

// admin-portal.js — ASCORIX BMS Main Orchestrator
// Handles auth, routing, sidebar, modals, toast, and cross-module data

const BMS = {
  token: null,
  user: null,
  currentSection: 'dashboard',
  clients: [],
  projects: [],
  invoices: [],

  async init() {
    this.token = localStorage.getItem('ascorix_token');
    const userStr = localStorage.getItem('ascorix_user');

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
      settings: ['Settings', 'Admin panel configuration'],
    };

    const [title, sub] = titles[section] || [section, ''];
    const titleEl = document.getElementById('topbarTitle');
    const subEl = document.getElementById('topbarSub');
    if (titleEl) titleEl.textContent = title;
    if (subEl) subEl.textContent = sub;

    // Load section data
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
        case 'settings': await BMS.loadSettings(); break;
      }
    } catch (err) {
      console.error(`Error loading section ${section}:`, err);
      BMS.showToast(`Failed to load ${section}: ${err.message}`, 'error');
    }
  },

  logout() {
    localStorage.removeItem('ascorix_token');
    localStorage.removeItem('ascorix_user');
    window.location.href = '/';
  },

  startHeartbeat() {
    setInterval(async () => {
      try {
        const r = await fetch('/api/auth/me', {
          headers: { 'Authorization': `Bearer ${this.token}` }
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
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.token}`,
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

  confirm(message, callback) {
    document.getElementById('confirmMsg').textContent = message;
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
        tbody.innerHTML = `<tr><td colspan="6" class="bms-table-empty">No users found.</td></tr>`;
        return;
      }
      tbody.innerHTML = data.map(u => `
        <tr>
          <td><strong>${u.name}</strong></td>
          <td>${u.email}</td>
          <td>${BMS.statusBadge(u.role === 'admin' ? 'Active' : 'Inactive').replace(u.role === 'admin' ? 'Active' : 'Inactive', u.role)}</td>
          <td>${u.is_verified ? '<span class="badge badge-green">✓ Verified</span>' : '<span class="badge badge-yellow">Pending</span>'}</td>
          <td>${BMS.formatDate(u.createdAt || u.created_at)}</td>
          <td>
            <div style="display:flex;gap:6px">
              <button class="btn-bms btn-bms-secondary btn-bms-sm" onclick="BMS.editUser('${u._id}','${u.name}','${u.email}','${u.role}')">✏️</button>
              <button class="btn-bms btn-bms-danger btn-bms-sm" onclick="BMS.deleteUser('${u._id}')">🗑</button>
            </div>
          </td>
        </tr>`).join('');

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

  editUser(id, name, email, role) {
    document.getElementById('userId').value = id;
    document.getElementById('userName').value = name;
    document.getElementById('userEmail').value = email;
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
    } catch (err) { BMS.showToast(err.message, 'error'); }
  },

  async deleteService(id) {
    BMS.confirm('Delete this service?', async () => {
      try {
        await BMS.apiFetch(`/api/services/${id}`, { method: 'DELETE' });
        BMS.showToast('Service deleted', 'success');
        BMS.loadServices();
      } catch (err) { BMS.showToast(err.message, 'error'); }
    });
  },

  async loadSettings() {
    try {
      const settings = await BMS.apiFetch('/api/admin/settings');
      const container = document.getElementById('settingsContainer');
      if (!container) return;
      container.innerHTML = `
        <div style="max-width:600px">
          <div class="bms-card mb-24">
            <div class="bms-card-header"><h3>🛒 Checkout Settings</h3></div>
            <div class="bms-form-group">
              <label>Enable Checkout</label>
              <select class="bms-select" id="settCheckout" style="max-width:200px">
                <option value="true" ${settings.checkoutEnabled ? 'selected' : ''}>Enabled</option>
                <option value="false" ${!settings.checkoutEnabled ? 'selected' : ''}>Disabled</option>
              </select>
            </div>
            <div class="bms-form-group">
              <label>Pricing Margin Multiplier</label>
              <input class="bms-input" type="number" id="settMargin" value="${settings.pricingMargin || 1}" step="0.01" min="0.1" style="max-width:200px" />
            </div>
            <button class="btn-bms btn-bms-primary" id="saveSettingsBtn">Save Settings</button>
          </div>
          <div class="bms-card">
            <div class="bms-card-header"><h3>🔑 Offer Codes</h3>
              <button class="btn-bms btn-bms-primary btn-bms-sm" id="addOfferCodeBtn">+ Add Code</button>
            </div>
            <div id="offerCodesContainer">Loading…</div>
          </div>
        </div>`;

      document.getElementById('saveSettingsBtn').onclick = async () => {
        try {
          await BMS.apiFetch('/api/admin/settings', {
            method: 'PUT',
            body: JSON.stringify({
              checkoutEnabled: document.getElementById('settCheckout').value === 'true',
              pricingMargin: parseFloat(document.getElementById('settMargin').value)
            })
          });
          BMS.showToast('Settings saved', 'success');
        } catch (err) { BMS.showToast(err.message, 'error'); }
      };

      BMS.loadOfferCodes();
    } catch (err) { BMS.showToast('Failed to load settings', 'error'); }
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

    // ==========================================
    // INIT
    // ==========================================
    document.addEventListener('DOMContentLoaded', () => {
      BMS.init();

      // Also trigger viewAllLeads button in dashboard
      document.addEventListener('click', e => {
        const btn = e.target.closest('[data-section]');
        if (btn && !btn.classList.contains('bms-nav-item') && !btn.classList.contains('bms-modal-close')) {
          const s = btn.getAttribute('data-section');
          if (s) BMS.navigate(s);
        }
      });
    });
