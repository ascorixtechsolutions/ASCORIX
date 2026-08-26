// admin/payments.js — Payment Records Module
'use strict';

const BMSPayments = {
  payments: [],

  async load() {
    await BMS.loadClientDatalist();
    await this.fetchAndRender();
    this.setupButtons();
    this.setupSearch();
    await this.populateInvoiceDropdown();
  },

  async fetchAndRender() {
    try {
      this.payments = await BMS.apiFetch('/api/bms/payments');
      this.renderTable(this.payments);
    } catch (err) { BMS.showToast('Failed to load payments: ' + err.message, 'error'); }
  },

  getFiltered() {
    const q = document.getElementById('paymentsSearch')?.value.toLowerCase() || '';
    const method = document.getElementById('paymentsMethodFilter')?.value || '';
    return this.payments.filter(p => {
      const matchQ = !q || (p.client_name + (p.reference || '')).toLowerCase().includes(q);
      const matchM = !method || p.payment_method === method;
      return matchQ && matchM;
    });
  },

  renderTable(payments) {
    const tbody = document.getElementById('paymentsTableBody');
    if (!tbody) return;
    if (!payments.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="bms-table-empty">No payments recorded yet.</td></tr>`;
      return;
    }
    tbody.innerHTML = payments.map(p => `
      <tr>
        <td>${BMS.formatDate(p.payment_date || p.created_at)}</td>
        <td><strong>${p.client_name}</strong></td>
        <td><strong style="color:var(--bms-green)">${BMS.formatCurrency(p.amount)}</strong></td>
        <td><span class="badge badge-blue">${p.payment_method || '—'}</span></td>
        <td><span class="badge badge-violet">${p.payment_type || '—'}</span></td>
        <td>${p.invoice_id ? `<span class="badge badge-cyan">Inv #${(BMS.invoices || []).find(i => i._id === p.invoice_id)?.invoice_number || p.invoice_id.slice(-6)}</span>` : '—'}</td>
        <td><span style="font-size:12px;color:var(--bms-text-2)">${p.reference || '—'}</span></td>
        <td>
          <button class="btn-bms btn-bms-danger btn-bms-sm" onclick="BMSPayments.deletePayment('${p._id}')">🗑</button>
        </td>
      </tr>`).join('');
  },

  setupSearch() {
    document.getElementById('paymentsSearch')?.addEventListener('input', () => this.renderTable(this.getFiltered()));
    document.getElementById('paymentsMethodFilter')?.addEventListener('change', () => this.renderTable(this.getFiltered()));
  },

  setupButtons() {
    const addBtn = document.getElementById('addPaymentBtn');
    if (addBtn) addBtn.onclick = () => this.openAdd();
    const saveBtn = document.getElementById('savePaymentBtn');
    if (saveBtn) saveBtn.onclick = () => this.savePayment();
  },

  async populateInvoiceDropdown() {
    try {
      if (!BMS.invoices?.length) BMS.invoices = await BMS.apiFetch('/api/bms/invoices');
      const sel = document.getElementById('payInvoiceId');
      if (!sel) return;
      sel.innerHTML = '<option value="">None</option>';
      (BMS.invoices || []).filter(i => i.payment_status !== 'Paid').forEach(inv => {
        const opt = document.createElement('option');
        opt.value = inv._id;
        opt.textContent = `${inv.invoice_number || '—'} – ${inv.client_name} (${BMS.formatCurrency(inv.balance_due)})`;
        sel.appendChild(opt);
      });
    } catch (e) {}
  },

  openAdd() {
    document.getElementById('paymentForm').reset();
    // Default to today
    const today = new Date().toISOString().slice(0, 10);
    document.getElementById('payDate').value = today;
    this.populateInvoiceDropdown();
    BMS.openModal('paymentModal');
  },

  openForInvoice(invoiceId, clientName) {
    document.getElementById('paymentForm').reset();
    document.getElementById('payDate').value = new Date().toISOString().slice(0, 10);
    document.getElementById('payClientName').value = clientName;
    this.populateInvoiceDropdown().then(() => {
      document.getElementById('payInvoiceId').value = invoiceId;
    });
    BMS.openModal('paymentModal');
  },

  async savePayment() {
    const clientName = document.getElementById('payClientName').value.trim();
    const matchedClient = BMS.clients.find(c => c.company_name === clientName || c.contact_person === clientName);
    const body = {
      client_name: clientName,
      client_id: matchedClient ? matchedClient._id : null,
      amount: parseFloat(document.getElementById('payAmount').value),
      payment_date: document.getElementById('payDate').value || null,
      payment_method: document.getElementById('payMethod').value,
      payment_type: document.getElementById('payType').value,
      invoice_id: document.getElementById('payInvoiceId').value || null,
      reference: document.getElementById('payReference').value.trim(),
      notes: document.getElementById('payNotes').value.trim(),
    };
    if (!body.client_name || !body.amount) { BMS.showToast('Client name and amount required', 'error'); return; }
    try {
      await BMS.apiFetch('/api/bms/payments', { method: 'POST', body: JSON.stringify(body) });
      BMS.showToast('Payment recorded!', 'success');
      BMS.closeModal('paymentModal');
      await this.fetchAndRender();
      // Refresh invoices table if visible
      if (BMS.currentSection === 'invoices') {
        BMS.invoices = [];
        await BMSInvoices.fetchAndRender();
      }
    } catch (err) { BMS.showToast(err.message, 'error'); }
  },

  async deletePayment(id) {
    BMS.confirm('Delete this payment record?', async () => {
      try {
        await BMS.apiFetch(`/api/bms/payments/${id}`, { method: 'DELETE' });
        BMS.showToast('Payment deleted', 'success');
        await this.fetchAndRender();
      } catch (err) { BMS.showToast(err.message, 'error'); }
    });
  }
};
