// admin/crm.js — CRM & Lead Management Module
'use strict';

const BMSCrm = {
  leads: [],
  isKanban: false,

  async load() {
    await BMS.loadClientDatalist();
    await this.fetchAndRender();
    this.setupSearch();
    this.setupButtons();
  },

  async fetchAndRender() {
    try {
      this.leads = await BMS.apiFetch('/api/bms/leads');
      this.renderTable(this.leads);
      if (this.isKanban) this.renderKanban(this.leads);
      const badge = document.getElementById('badge-crm');
      const newCount = this.leads.filter(l => l.status === 'New').length;
      if (badge) { badge.textContent = newCount; newCount > 0 ? badge.classList.remove('hidden') : badge.classList.add('hidden'); }
    } catch (err) {
      BMS.showToast('Failed to load leads: ' + err.message, 'error');
    }
  },

  getFiltered() {
    const q = document.getElementById('crmSearch')?.value.toLowerCase() || '';
    const status = document.getElementById('crmStatusFilter')?.value || '';
    const priority = document.getElementById('crmPriorityFilter')?.value || '';
    return this.leads.filter(l => {
      const matchQ = !q || (l.name + l.email + l.service + (l.company_name || '')).toLowerCase().includes(q);
      const matchS = !status || l.status === status;
      const matchP = !priority || l.priority === priority;
      return matchQ && matchS && matchP;
    });
  },

  renderTable(leads) {
    const tbody = document.getElementById('crmTableBody');
    if (!tbody) return;
    if (!leads.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="bms-table-empty">No leads found. <br>Click <strong>+ Add Lead</strong> to create one.</td></tr>`;
      return;
    }
    tbody.innerHTML = leads.map(l => `
      <tr>
        <td><span style="color:var(--bms-text-3);font-size:11px">#${l.lead_number || '—'}</span></td>
        <td>
          <div style="font-weight:600;color:var(--bms-white)">${l.name}</div>
          <div style="font-size:11px;color:var(--bms-text-2)">${l.company_name || ''}</div>
          <div style="font-size:11px;color:var(--bms-text-3)">${l.email}</div>
        </td>
        <td><span style="font-size:12px">${l.service}</span></td>
        <td><span style="font-size:12px">${l.lead_source}</span></td>
        <td>${BMS.priorityIcon(l.priority)} ${BMS.statusBadge(l.priority)}</td>
        <td>${BMS.statusBadge(l.status)}</td>
        <td>${l.follow_up_date ? '<span style="font-size:12px">' + BMS.formatDate(l.follow_up_date) + '</span>' : '<span style="color:var(--bms-text-3)">—</span>'}</td>
        <td>
          <div style="display:flex;gap:4px;flex-wrap:wrap">
            <button class="btn-bms btn-bms-secondary btn-bms-sm" onclick="BMSCrm.viewDetail('${l._id}')">👁</button>
            <button class="btn-bms btn-bms-secondary btn-bms-sm" onclick="BMSCrm.editLead('${l._id}')">✏️</button>
            ${!l.converted_to_client ? `<button class="btn-bms btn-bms-success btn-bms-sm" onclick="BMSCrm.convertToClient('${l._id}')" title="Convert to Client">👤</button>` : '<span class="badge badge-green">✓ Client</span>'}
            <button class="btn-bms btn-bms-danger btn-bms-sm" onclick="BMSCrm.deleteLead('${l._id}')">🗑</button>
          </div>
        </td>
      </tr>`).join('');
  },

  renderKanban(leads) {
    const container = document.getElementById('crmKanban');
    if (!container) return;
    const statuses = ['New', 'Contacted', 'Qualified', 'Proposal Sent', 'Negotiation', 'Won', 'Lost'];
    const colors = { New: '#3b82f6', Contacted: '#06b6d4', Qualified: '#8b5cf6', 'Proposal Sent': '#f59e0b', Negotiation: '#f97316', Won: '#10b981', Lost: '#ef4444' };
    container.innerHTML = statuses.map(status => {
      const cols = leads.filter(l => l.status === status);
      return `
        <div class="bms-kanban-col" data-status="${status}">
          <div class="bms-kanban-col-header" style="border-top:2px solid ${colors[status]}">
            <span style="color:${colors[status]};font-size:14px">●</span> ${status}
            <span class="bms-kanban-col-count">${cols.length}</span>
          </div>
          <div class="bms-kanban-cards" data-status="${status}" ondragover="BMSCrm.onDragOver(event)" ondrop="BMSCrm.onDrop(event,'${status}')">
            ${cols.map(l => `
              <div class="bms-kanban-card" draggable="true" data-id="${l._id}" ondragstart="BMSCrm.onDragStart(event,'${l._id}')">
                <h4>${l.name}</h4>
                <p>${l.service}</p>
                <div class="bms-kanban-card-meta">
                  <span>${BMS.priorityIcon(l.priority)} ${l.priority}</span>
                  <span style="display:flex;gap:4px">
                    <button class="btn-bms btn-bms-secondary btn-bms-sm btn-bms-icon-only" onclick="BMSCrm.editLead('${l._id}')">✏️</button>
                  </span>
                </div>
              </div>`).join('')}
          </div>
        </div>`;
    }).join('');
  },

  onDragStart(event, id) {
    event.dataTransfer.setData('leadId', id);
    event.target.classList.add('dragging');
  },

  onDragOver(event) {
    event.preventDefault();
    event.currentTarget.classList.add('drag-over');
  },

  async onDrop(event, newStatus) {
    event.preventDefault();
    event.currentTarget.classList.remove('drag-over');
    const id = event.dataTransfer.getData('leadId');
    if (!id) return;
    try {
      await BMS.apiFetch(`/api/bms/leads/${id}`, { method: 'PUT', body: JSON.stringify({ status: newStatus }) });
      BMS.showToast(`Lead moved to ${newStatus}`, 'success');
      await this.fetchAndRender();
    } catch (err) { BMS.showToast(err.message, 'error'); }
  },

  setupSearch() {
    const applyFilter = () => this.renderTable(this.getFiltered());
    document.getElementById('crmSearch')?.addEventListener('input', applyFilter);
    document.getElementById('crmStatusFilter')?.addEventListener('change', applyFilter);
    document.getElementById('crmPriorityFilter')?.addEventListener('change', applyFilter);
  },

  setupButtons() {
    const addBtn = document.getElementById('addLeadBtn');
    if (addBtn) addBtn.onclick = () => this.openAdd();

    const saveBtn = document.getElementById('saveLeadBtn');
    if (saveBtn) saveBtn.onclick = () => this.saveLead();

    const toggleBtn = document.getElementById('crm-view-toggle');
    if (toggleBtn) toggleBtn.onclick = () => this.toggleView();
  },

  toggleView() {
    this.isKanban = !this.isKanban;
    const tableView = document.getElementById('crm-table-view');
    const kanbanView = document.getElementById('crm-kanban-view');
    const btn = document.getElementById('crm-view-toggle');
    if (this.isKanban) {
      tableView?.classList.add('hidden');
      kanbanView?.classList.remove('hidden');
      if (btn) btn.textContent = '☰ Table';
      this.renderKanban(this.leads);
    } else {
      tableView?.classList.remove('hidden');
      kanbanView?.classList.add('hidden');
      if (btn) btn.textContent = '⊞ Kanban';
    }
  },

  openAdd() {
    document.getElementById('leadId').value = '';
    document.getElementById('leadForm').reset();
    document.getElementById('leadModalTitle').textContent = '➕ Add Lead';
    BMS.openModal('leadModal');
  },

  editLead(id) {
    const lead = this.leads.find(l => l._id === id);
    if (!lead) return;
    document.getElementById('leadId').value = lead._id;
    document.getElementById('leadName').value = lead.name || '';
    document.getElementById('leadCompany').value = lead.company_name || '';
    document.getElementById('leadEmail').value = lead.email || '';
    document.getElementById('leadPhone').value = lead.phone || '';
    document.getElementById('leadService').value = lead.service || '';
    document.getElementById('leadBudget').value = lead.budget || '';
    document.getElementById('leadSource').value = lead.lead_source || 'Website Form';
    document.getElementById('leadPriority').value = lead.priority || 'Medium';
    document.getElementById('leadStatus').value = lead.status || 'New';
    document.getElementById('leadFollowup').value = lead.follow_up_date ? lead.follow_up_date.substring(0, 10) : '';
    document.getElementById('leadMessage').value = lead.message || '';
    document.getElementById('leadModalTitle').textContent = '✏️ Edit Lead';
    BMS.openModal('leadModal');
  },

  async saveLead() {
    const id = document.getElementById('leadId').value;
    const body = {
      name: document.getElementById('leadName').value.trim(),
      company_name: document.getElementById('leadCompany').value.trim(),
      email: document.getElementById('leadEmail').value.trim(),
      phone: document.getElementById('leadPhone').value.trim(),
      service: document.getElementById('leadService').value,
      budget: document.getElementById('leadBudget').value.trim(),
      lead_source: document.getElementById('leadSource').value,
      priority: document.getElementById('leadPriority').value,
      status: document.getElementById('leadStatus').value,
      follow_up_date: document.getElementById('leadFollowup').value || null,
      message: document.getElementById('leadMessage').value.trim(),
    };
    if (!body.name || !body.email || !body.service) {
      BMS.showToast('Name, email and service are required', 'error'); return;
    }
    try {
      if (id) {
        await BMS.apiFetch(`/api/bms/leads/${id}`, { method: 'PUT', body: JSON.stringify(body) });
        BMS.showToast('Lead updated', 'success');
      } else {
        await BMS.apiFetch('/api/bms/leads', { method: 'POST', body: JSON.stringify(body) });
        BMS.showToast('Lead created', 'success');
      }
      BMS.closeModal('leadModal');
      await this.fetchAndRender();
    } catch (err) { BMS.showToast(err.message, 'error'); }
  },

  async deleteLead(id) {
    BMS.confirm('Delete this lead?', async () => {
      try {
        await BMS.apiFetch(`/api/bms/leads/${id}`, { method: 'DELETE' });
        BMS.showToast('Lead deleted', 'success');
        await this.fetchAndRender();
      } catch (err) { BMS.showToast(err.message, 'error'); }
    });
  },

  async convertToClient(id) {
    BMS.confirm('Convert this lead to a client?', async () => {
      try {
        await BMS.apiFetch(`/api/bms/leads/${id}/convert`, { method: 'POST' });
        BMS.showToast('Lead converted to client!', 'success');
        await this.fetchAndRender();
        BMS.clients = []; // Reset clients cache
      } catch (err) { BMS.showToast(err.message, 'error'); }
    });
  },

  async viewDetail(id) {
    BMS.openModal('leadDetailModal');
    const body = document.getElementById('leadDetailBody');
    if (body) body.innerHTML = '<div class="bms-loading-overlay"><div class="bms-spinner"></div></div>';
    try {
      const lead = await BMS.apiFetch(`/api/bms/leads/${id}`);
      document.getElementById('leadDetailName').textContent = `🎯 ${lead.name}`;
      if (body) body.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px">
          <div>
            <div style="color:var(--bms-text-3);font-size:11px;text-transform:uppercase;margin-bottom:12px">Lead Information</div>
            <div style="display:flex;flex-direction:column;gap:8px;font-size:13px">
              <div style="display:flex;gap:8px"><span style="color:var(--bms-text-2);min-width:100px">Company</span><strong>${lead.company_name || '—'}</strong></div>
              <div style="display:flex;gap:8px"><span style="color:var(--bms-text-2);min-width:100px">Email</span>${lead.email}</div>
              <div style="display:flex;gap:8px"><span style="color:var(--bms-text-2);min-width:100px">Phone</span>${lead.phone || '—'}</div>
              <div style="display:flex;gap:8px"><span style="color:var(--bms-text-2);min-width:100px">Service</span>${lead.service}</div>
              <div style="display:flex;gap:8px"><span style="color:var(--bms-text-2);min-width:100px">Budget</span>${lead.budget || '—'}</div>
              <div style="display:flex;gap:8px"><span style="color:var(--bms-text-2);min-width:100px">Source</span>${lead.lead_source}</div>
              <div style="display:flex;gap:8px"><span style="color:var(--bms-text-2);min-width:100px">Status</span>${BMS.statusBadge(lead.status)}</div>
              <div style="display:flex;gap:8px"><span style="color:var(--bms-text-2);min-width:100px">Priority</span>${BMS.statusBadge(lead.priority)}</div>
              <div style="display:flex;gap:8px"><span style="color:var(--bms-text-2);min-width:100px">Follow Up</span>${BMS.formatDate(lead.follow_up_date)}</div>
            </div>
            ${lead.message ? `<div style="margin-top:12px;padding:12px;background:var(--bms-bg-3);border-radius:8px;font-size:13px;color:var(--bms-text-2)">"${lead.message}"</div>` : ''}
          </div>
          <div>
            <div style="color:var(--bms-text-3);font-size:11px;text-transform:uppercase;margin-bottom:12px">Activity Timeline</div>
            <div class="bms-timeline">
              ${(lead.notes || []).length === 0 ? '<p style="color:var(--bms-text-3);font-size:13px">No activity yet.</p>' :
                (lead.notes || []).map(n => `
                  <div class="bms-timeline-item">
                    <div class="bms-timeline-dot">${n.type === 'Status Change' ? '🔄' : n.type === 'Call' ? '📞' : n.type === 'Email' ? '📧' : '📝'}</div>
                    <div class="bms-timeline-body">
                      <div class="bms-timeline-meta"><span>${n.author}</span> · ${BMS.timeAgo(n.created_at)}</div>
                      <div class="bms-timeline-content">${n.content}</div>
                    </div>
                  </div>`).join('')
              }
            </div>
          </div>
        </div>
        <div style="border-top:1px solid var(--bms-border);padding-top:16px">
          <div style="font-size:12px;font-weight:600;color:var(--bms-text-2);margin-bottom:8px">Add Note</div>
          <div style="display:flex;gap:8px">
            <select class="bms-filter-select" id="noteType" style="max-width:130px">
              <option>Note</option><option>Call</option><option>Email</option><option>Meeting</option>
            </select>
            <input class="bms-input" type="text" id="noteContent" placeholder="Add a note…" style="flex:1" />
            <button class="btn-bms btn-bms-primary" onclick="BMSCrm.addNote('${id}')">Add</button>
          </div>
        </div>`;
    } catch (err) {
      if (body) body.innerHTML = `<p style="color:var(--bms-red)">Failed to load lead: ${err.message}</p>`;
    }
  },

  async addNote(leadId) {
    const content = document.getElementById('noteContent')?.value.trim();
    const type = document.getElementById('noteType')?.value || 'Note';
    if (!content) return;
    try {
      await BMS.apiFetch(`/api/bms/leads/${leadId}/notes`, { method: 'POST', body: JSON.stringify({ content, type }) });
      BMS.showToast('Note added', 'success');
      this.viewDetail(leadId);
    } catch (err) { BMS.showToast(err.message, 'error'); }
  }
};
