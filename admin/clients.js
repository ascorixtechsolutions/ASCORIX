// admin/clients.js — Client Management Module
'use strict';

const BMSClients = {
  clients: [],

  async load() {
    await this.fetchAndRender();
    this.setupButtons();
    this.setupSearch();
  },

  async fetchAndRender() {
    try {
      this.clients = await BMS.apiFetch('/api/bms/clients');
      BMS.clients = this.clients;
      this.renderTable(this.clients);
    } catch (err) { BMS.showToast('Failed to load clients: ' + err.message, 'error'); }
  },

  getFiltered() {
    const q = document.getElementById('clientsSearch')?.value.toLowerCase() || '';
    const status = document.getElementById('clientsStatusFilter')?.value || '';
    return this.clients.filter(c => {
      const matchQ = !q || (c.company_name + c.contact_person + c.email).toLowerCase().includes(q);
      const matchS = !status || c.status === status;
      return matchQ && matchS;
    });
  },

  renderTable(clients) {
    const tbody = document.getElementById('clientsTableBody');
    if (!tbody) return;
    if (!clients.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="bms-table-empty">No clients yet. Convert a lead or add manually.</td></tr>`;
      return;
    }
    tbody.innerHTML = clients.map(c => `
      <tr>
        <td><span style="color:var(--bms-text-3);font-size:11px">#${c.client_number || '—'}</span></td>
        <td>
          <div style="font-weight:600;color:var(--bms-white)">${c.company_name}</div>
          <div style="font-size:11px;color:var(--bms-text-2)">${c.city || ''}</div>
        </td>
        <td>${c.contact_person}</td>
        <td><a href="mailto:${c.email}" style="color:var(--bms-blue-light)">${c.email}</a></td>
        <td>${c.phone || '—'}</td>
        <td>${BMS.statusBadge(c.status)}</td>
        <td>
          <div style="display:flex;gap:6px">
            <button class="btn-bms btn-bms-secondary btn-bms-sm" onclick="BMS.openClientProfile('${c._id}')" title="View Profile">👁</button>
            <button class="btn-bms btn-bms-secondary btn-bms-sm" onclick="BMSClients.editClient('${c._id}')" title="Edit">✏️</button>
            <button class="btn-bms btn-bms-danger btn-bms-sm" onclick="BMSClients.deleteClient('${c._id}')" title="Delete">🗑</button>
          </div>
        </td>
      </tr>`).join('');
  },

  setupSearch() {
    document.getElementById('clientsSearch')?.addEventListener('input', () => this.renderTable(this.getFiltered()));
    document.getElementById('clientsStatusFilter')?.addEventListener('change', () => this.renderTable(this.getFiltered()));
  },

  setupButtons() {
    const addBtn = document.getElementById('addClientBtn');
    if (addBtn) addBtn.onclick = () => this.openAdd();
    const saveBtn = document.getElementById('saveClientBtn');
    if (saveBtn) saveBtn.onclick = () => this.saveClient();
  },

  openAdd() {
    document.getElementById('clientId').value = '';
    document.getElementById('clientForm').reset();
    document.getElementById('clientModalTitle').textContent = '➕ Add Client';
    document.getElementById('clientStatus').value = 'Active';
    BMS.openModal('clientModal');
  },

  editClient(id) {
    const c = this.clients.find(x => x._id === id);
    if (!c) return;
    document.getElementById('clientId').value = c._id;
    document.getElementById('clientCompany').value = c.company_name || '';
    document.getElementById('clientContact').value = c.contact_person || '';
    document.getElementById('clientEmail').value = c.email || '';
    document.getElementById('clientPhone').value = c.phone || '';
    document.getElementById('clientCity').value = c.city || '';
    document.getElementById('clientGst').value = c.gst || '';
    document.getElementById('clientAddress').value = c.address || '';
    document.getElementById('clientStatus').value = c.status || 'Active';
    document.getElementById('clientModalTitle').textContent = '✏️ Edit Client';
    BMS.openModal('clientModal');
  },

  async saveClient() {
    const id = document.getElementById('clientId').value;
    const body = {
      company_name: document.getElementById('clientCompany').value.trim(),
      contact_person: document.getElementById('clientContact').value.trim(),
      email: document.getElementById('clientEmail').value.trim(),
      phone: document.getElementById('clientPhone').value.trim(),
      city: document.getElementById('clientCity').value.trim(),
      gst: document.getElementById('clientGst').value.trim(),
      address: document.getElementById('clientAddress').value.trim(),
      status: document.getElementById('clientStatus').value,
    };
    if (!body.company_name || !body.contact_person || !body.email) {
      BMS.showToast('Company name, contact person and email are required', 'error'); return;
    }
    try {
      if (id) {
        await BMS.apiFetch(`/api/bms/clients/${id}`, { method: 'PUT', body: JSON.stringify(body) });
        BMS.showToast('Client updated', 'success');
      } else {
        await BMS.apiFetch('/api/bms/clients', { method: 'POST', body: JSON.stringify(body) });
        BMS.showToast('Client added', 'success');
      }
      BMS.closeModal('clientModal');
      BMS.clients = [];
      await this.fetchAndRender();
    } catch (err) { BMS.showToast(err.message, 'error'); }
  },

  async deleteClient(id) {
    BMS.confirm('Delete this client? All related data will be unlinked.', async () => {
      try {
        await BMS.apiFetch(`/api/bms/clients/${id}`, { method: 'DELETE' });
        BMS.showToast('Client deleted', 'success');
        BMS.clients = [];
        await this.fetchAndRender();
      } catch (err) { BMS.showToast(err.message, 'error'); }
    });
  }
};
