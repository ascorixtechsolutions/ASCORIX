// admin/invoices.js — Invoice Module
'use strict';

const BMSInvoices = {
  invoices: [],

  async load() {
    await BMS.loadClientDatalist();
    await this.fetchAndRender();
    this.setupButtons();
    this.setupSearch();
  },

  async fetchAndRender() {
    try {
      this.invoices = await BMS.apiFetch('/api/bms/invoices');
      BMS.invoices = this.invoices;
      this.renderTable(this.invoices);
    } catch (err) { BMS.showToast('Failed to load invoices: ' + err.message, 'error'); }
  },

  getFiltered() {
    const q = document.getElementById('invoicesSearch')?.value.toLowerCase() || '';
    const status = document.getElementById('invoicesStatusFilter')?.value || '';
    return this.invoices.filter(i => {
      const formattedNo = BMS.formatInvoiceNumber(i.invoice_number, i.created_at);
      const matchQ = !q || (i.client_name + formattedNo).toLowerCase().includes(q);
      const matchS = !status || i.payment_status === status;
      return matchQ && matchS;
    });
  },

  renderTable(invoices) {
    const tbody = document.getElementById('invoicesTableBody');
    if (!tbody) return;
    if (!invoices.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="bms-table-empty">No invoices yet.</td></tr>`;
      return;
    }
    tbody.innerHTML = invoices.map(inv => {
      const isOverdue = inv.due_date && new Date(inv.due_date) < new Date() && inv.payment_status !== 'Paid';
      const status = isOverdue && inv.payment_status === 'Pending' ? 'Overdue' : inv.payment_status;
      return `
        <tr>
          <td><strong style="color:var(--bms-blue-light)">${BMS.formatInvoiceNumber(inv.invoice_number, inv.created_at)}</strong></td>
          <td>
            <div style="font-weight:600">${inv.client_name}</div>
            <div style="font-size:11px;color:var(--bms-text-2)">${inv.client_email}</div>
          </td>
          <td><strong>${BMS.formatCurrency(inv.total)}</strong></td>
          <td><span style="color:var(--bms-green)">${BMS.formatCurrency(inv.amount_paid || 0)}</span></td>
          <td><span style="color:${(inv.balance_due || 0) > 0 ? 'var(--bms-red)' : 'var(--bms-green)'}">${BMS.formatCurrency(inv.balance_due || 0)}</span></td>
          <td>${inv.due_date ? BMS.formatDate(inv.due_date) : '—'}</td>
          <td>${BMS.statusBadge(status)}</td>
          <td>
            <div style="display:flex;gap:4px;flex-wrap:wrap">
              <button class="btn-bms btn-bms-secondary btn-bms-sm" onclick="BMSInvoices.preview('${inv._id}')" title="Preview">👁</button>
              <button class="btn-bms btn-bms-secondary btn-bms-sm" onclick="BMSInvoices.editInvoice('${inv._id}')" title="Edit">✏️</button>
              ${inv.payment_status !== 'Paid' ? `
                <button class="btn-bms btn-bms-success btn-bms-sm" onclick="BMSInvoices.markAsPaid('${inv._id}')" title="Mark as Paid">💰</button>
                <button class="btn-bms btn-bms-secondary btn-bms-sm" onclick="BMSPayments.openForInvoice('${inv._id}','${inv.client_name}')" title="Record Payment">💸</button>
              ` : ''}
              <button class="btn-bms btn-bms-danger btn-bms-sm" onclick="BMSInvoices.deleteInvoice('${inv._id}')">🗑</button>
            </div>
          </td>
        </tr>`;
    }).join('');
  },

  setupSearch() {
    document.getElementById('invoicesSearch')?.addEventListener('input', () => this.renderTable(this.getFiltered()));
    document.getElementById('invoicesStatusFilter')?.addEventListener('change', () => this.renderTable(this.getFiltered()));
  },

  setupButtons() {
    const addBtn = document.getElementById('addInvoiceBtn');
    if (addBtn) addBtn.onclick = () => this.openAdd();
    const saveBtn = document.getElementById('saveInvoiceBtn');
    if (saveBtn) saveBtn.onclick = () => this.saveInvoice();
    const addItemBtn = document.getElementById('addInvoiceItem');
    if (addItemBtn) addItemBtn.onclick = () => BMSQuotations.addItemRow('invItemsBody', 'inv');

    // Discount input recalculate
    document.getElementById('invDiscount')?.addEventListener('input', () => BMSQuotations.recalculate('inv'));

    const clientNameInput = document.getElementById('invClientName');
    if (clientNameInput) {
      const handler = (e) => this.handleClientChange(e.target.value.trim());
      clientNameInput.addEventListener('input', handler);
      clientNameInput.addEventListener('change', handler);
    }
  },

  async handleClientChange(name) {
    const matched = BMS.clients.find(c => c.company_name === name || c.contact_person === name);
    if (matched) {
      document.getElementById('invClientId').value = matched._id;
      document.getElementById('invClientEmail').value = matched.email;
      document.getElementById('invClientGst').value = matched.gst || '';
      document.getElementById('invClientAddress').value = matched.address || '';
      await this.populateProjectsForClient(matched._id);
    } else {
      document.getElementById('invClientId').value = '';
      const projSelect = document.getElementById('invProjectId');
      if (projSelect) projSelect.innerHTML = '<option value="">None</option>';
    }
  },

  async populateProjectsForClient(clientId) {
    const projSelect = document.getElementById('invProjectId');
    if (!projSelect) return;
    projSelect.innerHTML = '<option value="">None</option>';
    if (!clientId) return;
    try {
      let projects = [];
      try {
        projects = await BMS.apiFetch(`/api/bms/projects?client_id=${clientId}`);
      } catch (e) {
        const allProjects = await BMS.apiFetch('/api/bms/projects');
        projects = allProjects.filter(p => p.client_id === clientId);
      }
      projSelect.innerHTML = '<option value="">None</option>' + projects.map(p => `
        <option value="${p._id || p.id}">${p.name}</option>
      `).join('');
    } catch (e) {
      console.warn("Failed to populate projects", e);
    }
  },

  openAdd() {
    document.getElementById('invoiceId').value = '';
    document.getElementById('invClientId').value = '';
    document.getElementById('invoiceForm').reset();
    document.getElementById('invoiceModalTitle').textContent = '🧾 New Invoice';
    document.getElementById('invItemsBody').innerHTML = '';
    document.getElementById('invPaymentStatus').value = 'Pending';
    document.getElementById('invDiscount').value = '0';
    const projSelect = document.getElementById('invProjectId');
    if (projSelect) projSelect.innerHTML = '<option value="">None</option>';

    // Reset advance paid and balance due UI
    const advancePaidEl = document.getElementById('invAdvancePaid');
    if (advancePaidEl) {
      advancePaidEl.textContent = BMS.formatCurrency(0);
      advancePaidEl.dataset.amount = 0;
    }
    const balanceDueEl = document.getElementById('invBalanceDue');
    if (balanceDueEl) {
      balanceDueEl.textContent = BMS.formatCurrency(0);
    }

    const d = new Date(); d.setDate(d.getDate() + 7);
    document.getElementById('invDueDate').value = d.toISOString().slice(0, 10);
    BMSQuotations.addItemRow('invItemsBody', 'inv');
    BMSQuotations.recalculate('inv');
    BMS.openModal('invoiceModal');
  },

  async editInvoice(id) {
    try {
      const inv = await BMS.apiFetch(`/api/bms/invoices/${id}`);
      document.getElementById('invoiceId').value = inv._id;
      document.getElementById('invClientId').value = inv.client_id || '';
      document.getElementById('invClientName').value = inv.client_name || '';
      document.getElementById('invClientEmail').value = inv.client_email || '';
      document.getElementById('invClientGst').value = inv.client_gst || '';
      document.getElementById('invClientAddress').value = inv.client_address || '';
      document.getElementById('invDueDate').value = inv.due_date ? inv.due_date.substring(0, 10) : '';
      document.getElementById('invNotes').value = inv.notes || '';
      document.getElementById('invTerms').value = inv.terms || '';
      document.getElementById('invPaymentStatus').value = inv.payment_status || 'Pending';
      document.getElementById('invDiscount').value = inv.discount_percent || 0;
      
      await this.populateProjectsForClient(inv.client_id);
      const projSelect = document.getElementById('invProjectId');
      if (projSelect) projSelect.value = inv.project_id || '';

      // Initialize advance paid and balance due UI
      const advancePaid = inv.amount_paid || 0;
      const advancePaidEl = document.getElementById('invAdvancePaid');
      if (advancePaidEl) {
        advancePaidEl.textContent = BMS.formatCurrency(advancePaid);
        advancePaidEl.dataset.amount = advancePaid;
      }
      const balanceDueEl = document.getElementById('invBalanceDue');
      if (balanceDueEl) {
        const initialBalance = (inv.total || 0) - advancePaid;
        balanceDueEl.textContent = BMS.formatCurrency(initialBalance);
      }

      document.getElementById('invItemsBody').innerHTML = '';
      (inv.items || []).forEach(item => BMSQuotations.addItemRow('invItemsBody', 'inv', item));
      if (!inv.items?.length) BMSQuotations.addItemRow('invItemsBody', 'inv');
      BMSQuotations.recalculate('inv');
      document.getElementById('invoiceModalTitle').textContent = '✏️ Edit Invoice';
      BMS.openModal('invoiceModal');
    } catch (err) { BMS.showToast(err.message, 'error'); }
  },

  async saveInvoice() {
    const id = document.getElementById('invoiceId').value;
    const totals = BMSQuotations.getTotals('inv');
    const advancePaid = parseFloat(document.getElementById('invAdvancePaid')?.dataset?.amount) || 0;
    const balanceDue = totals.total - advancePaid;
    const body = {
      client_name: document.getElementById('invClientName').value.trim(),
      client_email: document.getElementById('invClientEmail').value.trim(),
      client_gst: document.getElementById('invClientGst').value.trim(),
      client_address: document.getElementById('invClientAddress').value.trim(),
      client_id: document.getElementById('invClientId').value || null,
      project_id: document.getElementById('invProjectId').value || null,
      due_date: document.getElementById('invDueDate').value || null,
      notes: document.getElementById('invNotes').value.trim(),
      terms: document.getElementById('invTerms').value.trim(),
      payment_status: document.getElementById('invPaymentStatus').value,
      items: BMSQuotations.getItemsFromTable('invItemsBody'),
      amount_paid: advancePaid,
      balance_due: balanceDue,
      ...totals
    };
    if (!body.client_name || !body.client_email) { BMS.showToast('Client name and email required', 'error'); return; }
    try {
      if (id) {
        await BMS.apiFetch(`/api/bms/invoices/${id}`, { method: 'PUT', body: JSON.stringify(body) });
        BMS.showToast('Invoice updated', 'success');
      } else {
        await BMS.apiFetch('/api/bms/invoices', { method: 'POST', body: JSON.stringify(body) });
        BMS.showToast('Invoice created', 'success');
      }
      BMS.closeModal('invoiceModal');
      await this.fetchAndRender();
    } catch (err) { BMS.showToast(err.message, 'error'); }
  },

  async deleteInvoice(id) {
    BMS.confirm('Delete this invoice?', async () => {
      try {
        await BMS.apiFetch(`/api/bms/invoices/${id}`, { method: 'DELETE' });
        BMS.showToast('Invoice deleted', 'success');
        await this.fetchAndRender();
      } catch (err) { BMS.showToast(err.message, 'error'); }
    });
  },

  async preview(id) {
    try {
      const inv = await BMS.apiFetch(`/api/bms/invoices/${id}`);
      await BMSQuotations.showPrintPreview(inv, 'Invoice');
    } catch (err) { BMS.showToast(err.message, 'error'); }
  },

  async markAsPaid(id) {
    BMS.confirm('Mark this invoice as Paid? This will record a total payment transaction automatically.', async () => {
      try {
        const inv = await BMS.apiFetch(`/api/bms/invoices/${id}`);
        const balance = inv.balance_due;
        if (balance <= 0) {
          BMS.showToast('This invoice has no balance due.', 'warning');
          return;
        }
        const payment = {
          client_name: inv.client_name,
          client_id: inv.client_id || null,
          amount: balance,
          payment_date: new Date().toISOString().split('T')[0],
          payment_method: 'Bank Transfer',
          payment_type: 'Full',
          invoice_id: inv._id,
          reference: `PAID_INV_${inv.invoice_number}`,
          notes: 'Marked as paid from invoice actions.'
        };
        await BMS.apiFetch('/api/bms/payments', { method: 'POST', body: JSON.stringify(payment) });
        BMS.showToast('Invoice marked as paid and payment recorded!', 'success');
        await this.fetchAndRender();
      } catch (err) { BMS.showToast(err.message, 'error'); }
    }, '💰 Mark as Paid', 'Confirm', false);
  }
};
