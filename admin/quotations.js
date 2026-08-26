// admin/quotations.js — Quotation Builder Module
'use strict';

const BMSQuotations = {
  quotations: [],

  async load() {
    await BMS.loadClientDatalist();
    await this.fetchAndRender();
    this.setupButtons();
    this.setupSearch();
  },

  async fetchAndRender() {
    try {
      this.quotations = await BMS.apiFetch('/api/bms/quotations');
      this.renderTable(this.quotations);
    } catch (err) { BMS.showToast('Failed to load quotations: ' + err.message, 'error'); }
  },

  getFiltered() {
    const q = document.getElementById('quotesSearch')?.value.toLowerCase() || '';
    const status = document.getElementById('quotesStatusFilter')?.value || '';
    return this.quotations.filter(qt => {
      const formattedNo = BMS.formatQuotationNumber(qt.quotation_number, qt.created_at);
      const matchQ = !q || (qt.client_name + formattedNo).toLowerCase().includes(q);
      const matchS = !status || qt.status === status;
      return matchQ && matchS;
    });
  },

  renderTable(quotes) {
    const tbody = document.getElementById('quotesTableBody');
    if (!tbody) return;
    if (!quotes.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="bms-table-empty">No quotations yet.</td></tr>`;
      return;
    }
    tbody.innerHTML = quotes.map(q => `
      <tr>
        <td><strong style="color:var(--bms-blue-light)">${BMS.formatQuotationNumber(q.quotation_number, q.created_at)}</strong></td>
        <td>
          <div style="font-weight:600">${q.client_name}</div>
          <div style="font-size:11px;color:var(--bms-text-2)">${q.client_email}</div>
        </td>
        <td><strong>${BMS.formatCurrency(q.total)}</strong></td>
        <td>${q.valid_until ? BMS.formatDate(q.valid_until) : '—'}</td>
        <td>${BMS.statusBadge(q.status)}</td>
        <td>${BMS.formatDate(q.created_at)}</td>
        <td>
          <div style="display:flex;gap:4px;flex-wrap:wrap">
            <button class="btn-bms btn-bms-secondary btn-bms-sm" onclick="BMSQuotations.preview('${q._id}')" title="Preview">👁</button>
            <button class="btn-bms btn-bms-secondary btn-bms-sm" onclick="BMSQuotations.editQuote('${q._id}')" title="Edit">✏️</button>
            ${q.status !== 'Rejected' && !q.converted_to_invoice ? `<button class="btn-bms btn-bms-success btn-bms-sm" onclick="BMSQuotations.convertToInvoice('${q._id}')" title="Convert to Invoice">🧾</button>` : ''}
            <button class="btn-bms btn-bms-danger btn-bms-sm" onclick="BMSQuotations.deleteQuote('${q._id}')">🗑</button>
          </div>
        </td>
      </tr>`).join('');
  },

  setupSearch() {
    document.getElementById('quotesSearch')?.addEventListener('input', () => this.renderTable(this.getFiltered()));
    document.getElementById('quotesStatusFilter')?.addEventListener('change', () => this.renderTable(this.getFiltered()));
  },

  setupButtons() {
    const addBtn = document.getElementById('addQuoteBtn');
    if (addBtn) addBtn.onclick = () => this.openAdd();
    const saveBtn = document.getElementById('saveQuoteBtn');
    if (saveBtn) saveBtn.onclick = () => this.saveQuote();
    const addItemBtn = document.getElementById('addQuoteItem');
    if (addItemBtn) addItemBtn.onclick = () => this.addItemRow('quoteItemsBody', 'quote');

    document.getElementById('quoteDiscount')?.addEventListener('input', () => this.recalculate('quote'));

    const clientNameInput = document.getElementById('quoteClientName');
    if (clientNameInput) {
      const handler = (e) => this.handleClientChange(e.target.value.trim());
      clientNameInput.addEventListener('input', handler);
      clientNameInput.addEventListener('change', handler);
    }
  },

  async handleClientChange(name) {
    const matched = BMS.clients.find(c => c.company_name === name || c.contact_person === name);
    if (matched) {
      document.getElementById('quoteClientId').value = matched._id;
      document.getElementById('quoteClientEmail').value = matched.email;
      document.getElementById('quoteClientGst').value = matched.gst || '';
      document.getElementById('quoteClientAddress').value = matched.address || '';
      await this.populateProjectsForClient(matched._id);
    } else {
      document.getElementById('quoteClientId').value = '';
      const projSelect = document.getElementById('quoteProjectId');
      if (projSelect) projSelect.innerHTML = '<option value="">None</option>';
    }
  },

  async populateProjectsForClient(clientId) {
    const projSelect = document.getElementById('quoteProjectId');
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
    document.getElementById('quoteId').value = '';
    document.getElementById('quoteClientId').value = '';
    document.getElementById('quoteForm').reset();
    document.getElementById('quoteModalTitle').textContent = '📄 New Quotation';
    document.getElementById('quoteItemsBody').innerHTML = '';
    document.getElementById('quoteStatus').value = 'Draft';
    document.getElementById('quoteDiscount').value = '0';
    const projSelect = document.getElementById('quoteProjectId');
    if (projSelect) projSelect.innerHTML = '<option value="">None</option>';
    
    const d = new Date(); d.setDate(d.getDate() + 30);
    document.getElementById('quoteValidUntil').value = d.toISOString().slice(0, 10);
    this.addItemRow('quoteItemsBody', 'quote');
    this.recalculate('quote');
    BMS.openModal('quoteModal');
  },

  async editQuote(id) {
    try {
      const q = await BMS.apiFetch(`/api/bms/quotations/${id}`);
      document.getElementById('quoteId').value = q._id;
      document.getElementById('quoteClientId').value = q.client_id || '';
      document.getElementById('quoteClientName').value = q.client_name || '';
      document.getElementById('quoteClientEmail').value = q.client_email || '';
      document.getElementById('quoteClientGst').value = q.client_gst || '';
      document.getElementById('quoteClientAddress').value = q.client_address || '';
      document.getElementById('quoteValidUntil').value = q.valid_until ? q.valid_until.substring(0, 10) : '';
      document.getElementById('quoteNotes').value = q.notes || '';
      document.getElementById('quoteTerms').value = q.terms || '';
      document.getElementById('quoteStatus').value = q.status || 'Draft';
      document.getElementById('quoteDiscount').value = q.discount_percent || 0;
      
      await this.populateProjectsForClient(q.client_id);
      const projSelect = document.getElementById('quoteProjectId');
      if (projSelect) projSelect.value = q.project_id || '';

      document.getElementById('quoteItemsBody').innerHTML = '';
      (q.items || []).forEach(item => this.addItemRow('quoteItemsBody', 'quote', item));
      if (!q.items?.length) this.addItemRow('quoteItemsBody', 'quote');
      this.recalculate('quote');
      document.getElementById('quoteModalTitle').textContent = '✏️ Edit Quotation';
      BMS.openModal('quoteModal');
    } catch (err) { BMS.showToast(err.message, 'error'); }
  },

  addItemRow(tbodyId, prefix, item = {}) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><input class="items-input" type="text" placeholder="Service Name (e.g. Logo Design)…" value="${item.service_name || ''}" style="font-weight:600" oninput="BMSQuotations.recalculate('${prefix}')" /></td>
      <td><input class="items-input" type="text" placeholder="Description…" value="${item.description || ''}" oninput="BMSQuotations.recalculate('${prefix}')" /></td>
      <td><input class="items-input" type="number" placeholder="1" value="${item.quantity || 1}" min="1" style="width:60px" oninput="BMSQuotations.recalculate('${prefix}')" /></td>
      <td><input class="items-input" type="number" placeholder="0.00" value="${item.unit_price || ''}" min="0" oninput="BMSQuotations.recalculate('${prefix}')" /></td>
      <td><input class="items-input" type="number" value="${item.amount || 0}" readonly style="background:rgba(59,130,246,0.05);color:var(--bms-text-2)" /></td>
      <td><button type="button" style="background:none;border:none;color:var(--bms-red);cursor:pointer;font-size:16px" onclick="this.closest('tr').remove();BMSQuotations.recalculate('${prefix}')">✕</button></td>`;
    tbody.appendChild(row);
  },

  recalculate(prefix) {
    const tbody = document.getElementById(`${prefix}ItemsBody`);
    if (!tbody) return;
    let subtotal = 0;
    tbody.querySelectorAll('tr').forEach(row => {
      const inputs = row.querySelectorAll('input');
      const qty = parseFloat(inputs[2]?.value) || 0;
      const price = parseFloat(inputs[3]?.value) || 0;
      const amount = qty * price;
      if (inputs[4]) inputs[4].value = amount.toFixed(2);
      subtotal += amount;
    });
    const discountPct = parseFloat(document.getElementById(`${prefix}Discount`)?.value) || 0;
    const discountAmt = subtotal * discountPct / 100;
    const total = subtotal - discountAmt;
    
    const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setText(`${prefix}Subtotal`, BMS.formatCurrency(subtotal));
    setText(`${prefix}Total`, BMS.formatCurrency(total));

    if (prefix === 'inv') {
      const advancePaidEl = document.getElementById('invAdvancePaid');
      const advancePaid = parseFloat(advancePaidEl?.dataset?.amount) || 0;
      const balanceDue = total - advancePaid;
      setText('invBalanceDue', BMS.formatCurrency(balanceDue));
    }
  },

  getItemsFromTable(tbodyId) {
    const rows = document.getElementById(tbodyId)?.querySelectorAll('tr') || [];
    return Array.from(rows).map(row => {
      const inputs = row.querySelectorAll('input');
      return {
        service_name: inputs[0]?.value || '',
        description: inputs[1]?.value || '',
        quantity: parseFloat(inputs[2]?.value) || 1,
        unit_price: parseFloat(inputs[3]?.value) || 0,
        amount: parseFloat(inputs[4]?.value) || 0,
      };
    }).filter(i => i.service_name || i.description);
  },

  getTotals(prefix) {
    const tbody = document.getElementById(`${prefix}ItemsBody`);
    let subtotal = 0;
    tbody?.querySelectorAll('tr').forEach(row => {
      const inputs = row.querySelectorAll('input');
      const qty = parseFloat(inputs[2]?.value) || 0;
      const price = parseFloat(inputs[3]?.value) || 0;
      subtotal += qty * price;
    });
    const discountPct = parseFloat(document.getElementById(`${prefix}Discount`)?.value) || 0;
    const discountAmt = subtotal * discountPct / 100;
    const total = subtotal - discountAmt;
    return { subtotal, discount_percent: discountPct, discount_amount: discountAmt, tax_percent: 0, tax_amount: 0, total };
  },

  async saveQuote() {
    const id = document.getElementById('quoteId').value;
    const totals = this.getTotals('quote');
    const body = {
      client_name: document.getElementById('quoteClientName').value.trim(),
      client_email: document.getElementById('quoteClientEmail').value.trim(),
      client_gst: document.getElementById('quoteClientGst').value.trim(),
      client_address: document.getElementById('quoteClientAddress').value.trim(),
      client_id: document.getElementById('quoteClientId').value || null,
      project_id: document.getElementById('quoteProjectId').value || null,
      valid_until: document.getElementById('quoteValidUntil').value || null,
      notes: document.getElementById('quoteNotes').value.trim(),
      terms: document.getElementById('quoteTerms').value.trim(),
      status: document.getElementById('quoteStatus').value,
      items: this.getItemsFromTable('quoteItemsBody'),
      ...totals
    };
    if (!body.client_name || !body.client_email) { BMS.showToast('Client name and email required', 'error'); return; }
    try {
      if (id) {
        await BMS.apiFetch(`/api/bms/quotations/${id}`, { method: 'PUT', body: JSON.stringify(body) });
        BMS.showToast('Quotation updated', 'success');
      } else {
        await BMS.apiFetch('/api/bms/quotations', { method: 'POST', body: JSON.stringify(body) });
        BMS.showToast('Quotation created', 'success');
      }
      BMS.closeModal('quoteModal');
      await this.fetchAndRender();
    } catch (err) { BMS.showToast(err.message, 'error'); }
  },

  async convertToInvoice(id) {
    BMS.confirm('Convert this quotation to an invoice?', async () => {
      try {
        const invoice = await BMS.apiFetch(`/api/bms/quotations/${id}/convert`, { method: 'POST' });
        BMS.showToast('Quotation converted to invoice!', 'success');
        await this.fetchAndRender();
      } catch (err) { BMS.showToast(err.message, 'error'); }
    }, '🧾 Convert to Invoice', 'Convert', false);
  },

  async deleteQuote(id) {
    BMS.confirm('Delete this quotation?', async () => {
      try {
        await BMS.apiFetch(`/api/bms/quotations/${id}`, { method: 'DELETE' });
        BMS.showToast('Quotation deleted', 'success');
        await this.fetchAndRender();
      } catch (err) { BMS.showToast(err.message, 'error'); }
    });
  },

  async preview(id) {
    try {
      const q = await BMS.apiFetch(`/api/bms/quotations/${id}`);
      await this.showPrintPreview(q, 'Quotation');
    } catch (err) { BMS.showToast(err.message, 'error'); }
  },

  async showPrintPreview(doc, type) {
    let settings = {};
    try {
      settings = await BMS.apiFetch('/api/admin/settings');
    } catch (e) {}

    const previewEl = document.getElementById('printPreviewContent');
    if (!previewEl) return;
    const items = doc.items || [];
    const isInvoice = type === 'Invoice';
    
    const year = new Date(doc.created_at || Date.now()).getFullYear();
    const seq = String(doc.quotation_number || doc.invoice_number || 1).padStart(4, '0');
    const formattedNo = isInvoice ? `ATS-I-${year}-${seq}` : `ATS-Q-${year}-${seq}`;

    let projectHtml = '';
    if (doc.project_id) {
      try {
        const proj = await BMS.apiFetch(`/api/bms/projects/${doc.project_id}`);
        projectHtml = `<div style="margin-top:8px; font-size:12px; color:#4a5568;"><strong>Project Reference:</strong> ${proj.name}</div>`;
      } catch (e) {}
    }

    let itemsRows = items.map((item, idx) => `
      <tr style="border-bottom:1px solid #edf2f7;">
        <td style="padding:12px 10px; text-align:center;">${idx + 1}</td>
        <td style="padding:12px 10px; font-weight:600; color:#2d3748;">${item.service_name || 'Service'}</td>
        <td style="padding:12px 10px; font-size:12px; color:#4a5568; white-space:pre-wrap;">${item.description || ''}</td>
        <td style="padding:12px 10px; text-align:center;">${item.quantity}</td>
        <td style="padding:12px 10px; text-align:right;">₹${Number(item.unit_price).toLocaleString('en-IN')}</td>
        <td style="padding:12px 10px; text-align:right; font-weight:600; color:#2d3748;">₹${Number(item.amount).toLocaleString('en-IN')}</td>
      </tr>
    `).join('');

    previewEl.innerHTML = `
      <div id="captureArea" style="font-family:'Inter', sans-serif; padding:40px; background:#fff; color:#2d3748; line-height:1.5; position:relative; box-sizing:border-box;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:30px; border-bottom:3px solid #0052D4; padding-bottom:20px;">
          <div>
            <div style="display:flex; align-items:center; gap:12px; margin-bottom:8px;">
              <img src="/logo-icon-cropped.png" alt="ASCORIX Logo" style="height: 42px; width: auto;" />
              <div style="display:flex; flex-direction:column; line-height:1.1; justify-content:center; text-align:left;">
                <div style="display:flex; align-items:baseline;">
                  <span style="font-family:'Inter', sans-serif; font-weight:800; font-size:22px; letter-spacing:0.03em; color:#0052D4; line-height:1.1;">ASCORIX</span>
                  <span style="font-size:22px; color:#00c9ff; margin-left:1px; line-height:1.1;">.</span>
                </div>
                <div style="display:flex; align-items:center; gap:4px; font-size:9px; font-weight:700; letter-spacing:0.15em; color:#718096; margin-top:2px;">
                  <span style="height:2px; width:14px; background:linear-gradient(90deg, #0052D4, #00C9FF); border-radius:1px;"></span>
                  <span>TECH SOLUTIONS</span>
                  <span style="height:2px; width:14px; background:linear-gradient(270deg, #F2994A, #F2C94C); border-radius:1px;"></span>
                </div>
              </div>
            </div>
            <p style="margin:0; font-size:11px; color:#4a5568; font-style:italic;">"Strengthening Cores. Elevating Futures."</p>
          </div>
          <div style="text-align:right;">
            <h2 style="margin:0; font-size:26px; font-weight:800; color:#2d3748; text-transform:uppercase; letter-spacing:1px;">${type}</h2>
            <div style="margin:6px 0; font-size:15px; font-weight:700; color:#0052D4;">${formattedNo}</div>
            <div style="font-size:12px; color:#718096;">Date: ${new Date(doc.created_at).toLocaleDateString('en-IN')}</div>
            ${doc.valid_until ? `<div style="font-size:12px; color:#e53e3e; font-weight:600; margin-top:4px;">Valid Until: ${new Date(doc.valid_until).toLocaleDateString('en-IN')}</div>` : ''}
            ${doc.due_date ? `<div style="font-size:12px; color:#e53e3e; font-weight:600; margin-top:4px;">Due Date: ${new Date(doc.due_date).toLocaleDateString('en-IN')}</div>` : ''}
            ${isInvoice ? `<div style="font-size:12px; margin-top:6px;">Payment Status: <span class="badge" style="background:${doc.payment_status === 'Paid' ? '#10b981' : '#f59e0b'}; color:#fff; padding:2px 8px; border-radius:12px; font-weight:700;">${doc.payment_status}</span></div>` : ''}
          </div>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:30px; margin-bottom:30px;">
          <div>
            <h4 style="margin:0 0 8px; font-size:11px; text-transform:uppercase; color:#718096; letter-spacing:1px; border-bottom:1px solid #edf2f7; padding-bottom:4px;">Billed By</h4>
            <strong style="font-size:14px; color:#1a202c;">ASCORIX TECH SOLUTIONS</strong>
            <div style="font-size:12px; color:#4a5568; margin-top:6px; display:flex; flex-direction:column; gap:3px;">
              <span><strong>Founder:</strong> ABHINIVESH L T</span>
              <span><strong>Phone:</strong> 8825556134</span>
              <span><strong>Email:</strong> ascorixtechsolutions@gmail.com</span>
              <span><strong>Website:</strong> www.ascorixtechsolutions.com</span>
              <span><strong>Location:</strong> Erode, Tamil Nadu</span>
            </div>
          </div>
          <div>
            <h4 style="margin:0 0 8px; font-size:11px; text-transform:uppercase; color:#718096; letter-spacing:1px; border-bottom:1px solid #edf2f7; padding-bottom:4px;">Billed To</h4>
            <strong style="font-size:14px; color:#1a202c;">${doc.client_name}</strong>
            <div style="font-size:12px; color:#4a5568; margin-top:6px; display:flex; flex-direction:column; gap:3px;">
              <span><strong>Email:</strong> ${doc.client_email}</span>
              ${doc.client_gst ? `<span><strong>GST:</strong> ${doc.client_gst}</span>` : ''}
              ${doc.client_address ? `<span><strong>Address:</strong><br/><span style="white-space:pre-line">${doc.client_address}</span></span>` : ''}
            </div>
            ${projectHtml}
          </div>
        </div>

        <table style="width:100%; border-collapse:collapse; margin-bottom:30px; font-size:12px; text-align:left;">
          <thead>
            <tr style="background:#edf2f7; color:#2d3748; font-weight:700;">
              <th style="padding:10px; width:40px; text-align:center; border:1px solid #edf2f7;">#</th>
              <th style="padding:10px; width:150px; border:1px solid #edf2f7;">Service Name</th>
              <th style="padding:10px; border:1px solid #edf2f7;">Description</th>
              <th style="padding:10px; width:60px; text-align:center; border:1px solid #edf2f7;">Qty</th>
              <th style="padding:10px; width:100px; text-align:right; border:1px solid #edf2f7;">Unit Price</th>
              <th style="padding:10px; width:100px; text-align:right; border:1px solid #edf2f7;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>

        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-top:20px; gap:20px;">
          <div style="flex:1;">
            ${isInvoice ? `
              <div style="padding:16px; border:1px dashed #cbd5e0; border-radius:6px; background:#f7fafc; font-size:12px; max-width:320px; box-sizing:border-box;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                  <div style="flex:1;">
                    <strong style="color:#0052D4; font-size:13px; display:block; margin-bottom:6px;">Bank Details</strong>
                    <strong>Account Name:</strong> Abhinivesh L T<br/>
                    <strong>Bank:</strong> Union Bank of India<br/>
                    <strong>Account Number:</strong> 317322010002514<br/>
                    <strong>IFSC:</strong> UBIN0931730
                  </div>
                  ${settings.upiQrCode ? `
                    <div style="margin-left:12px; text-align:center; flex-shrink:0;">
                      <img src="${settings.upiQrCode}" style="width:85px; height:85px; object-fit:contain; border:1px solid #e2e8f0; border-radius:4px; padding:2px; background:#fff;" />
                      <span style="font-size:9px; color:#718096; display:block; margin-top:2px; font-weight:600;">Scan to Pay</span>
                    </div>` : ''}
                </div>
              </div>` : ''}
              
              ${doc.notes ? `<div style="font-size:12px; margin-top:16px; color:#4a5568;"><strong>Notes:</strong><br/>${doc.notes}</div>` : ''}
              ${doc.terms ? `<div style="font-size:12px; margin-top:10px; color:#4a5568;"><strong>Terms & Conditions:</strong><br/>${doc.terms}</div>` : ''}
          </div>

          <div style="width:260px; flex-shrink:0; font-size:13px;">
            <table style="width:100%; border-collapse:collapse;">
              <tr>
                <td style="padding:6px 0; color:#718096;">Subtotal:</td>
                <td style="padding:6px 0; text-align:right; font-weight:600;">₹${Number(doc.subtotal).toLocaleString('en-IN')}</td>
              </tr>
              ${doc.discount_amount ? `
              <tr>
                <td style="padding:6px 0; color:#e53e3e;">Discount (${doc.discount_percent}%):</td>
                <td style="padding:6px 0; text-align:right; color:#e53e3e; font-weight:600;">-₹${Number(doc.discount_amount).toLocaleString('en-IN')}</td>
              </tr>` : ''}
              <tr style="border-top:2px solid #2d3748; font-size:15px; font-weight:700;">
                <td style="padding:10px 0; color:#0052D4;">Grand Total:</td>
                <td style="padding:10px 0; text-align:right; color:#0052D4;">₹${Number(doc.total).toLocaleString('en-IN')}</td>
              </tr>
              ${isInvoice ? `
              <tr style="color:#059669;">
                <td style="padding:6px 0;">Advance Paid:</td>
                <td style="padding:6px 0; text-align:right; font-weight:600;">₹${Number(doc.amount_paid || 0).toLocaleString('en-IN')}</td>
              </tr>
              <tr style="border-top:1px solid #edf2f7; font-size:15px; font-weight:700; color:#e53e3e;">
                <td style="padding:8px 0;">Balance Due:</td>
                <td style="padding:8px 0; text-align:right;">₹${Number(doc.balance_due || 0).toLocaleString('en-IN')}</td>
              </tr>` : ''}
            </table>
          </div>
        </div>

        <div style="margin-top:50px; display:flex; justify-content:space-between; align-items:flex-end;">
          <div style="font-size:11px; color:#718096;">
            Generated electronically. Valid signature not required.
          </div>
          <div style="text-align:right; width:200px;">
            <div style="font-size:11px; color:#718096; margin-bottom:30px;">For <strong>ASCORIX TECH SOLUTIONS</strong></div>
            <div style="border-top:1px solid #a0aec0; padding-top:4px; font-weight:700; font-size:12px; color:#2d3748;">Abhinivesh L T</div>
            <div style="font-size:11px; color:#718096;">Founder & Director</div>
          </div>
        </div>
      </div>`;

    document.getElementById('printModalTitle').textContent = `📄 ${type} Preview`;
    BMS.openModal('printModal');

    document.getElementById('btnPreviewPrint').onclick = () => {
      const restoreTitle = document.title;
      document.title = formattedNo;
      window.print();
      document.title = restoreTitle;
    };

    document.getElementById('btnPreviewDownloadPDF').onclick = () => {
      const element = document.getElementById('captureArea');
      const opt = {
        margin:       0.5,
        filename:     `${formattedNo}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
      };
      html2pdf().set(opt).from(element).save();
    };

    const emailBtn = document.getElementById('btnPreviewEmail');
    if (emailBtn) {
      emailBtn.onclick = async () => {
        emailBtn.disabled = true;
        emailBtn.textContent = 'Sending...';
        try {
          const apiPath = isInvoice ? `/api/bms/invoices/${doc._id}/email` : `/api/bms/quotations/${doc._id}/email`;
          await BMS.apiFetch(apiPath, { method: 'POST' });
          BMS.showToast('Document emailed to client!', 'success');
        } catch(err) {
          BMS.showToast('Email failed: ' + err.message, 'error');
        } finally {
          emailBtn.disabled = false;
          emailBtn.textContent = '📧 Email to Client';
        }
      };
    }

    const convertBtn = document.getElementById('btnPreviewConvert');
    if (convertBtn) {
      if (!isInvoice && !doc.converted_to_invoice && doc.status !== 'Rejected') {
        convertBtn.style.display = 'inline-block';
        convertBtn.onclick = () => {
          BMS.closeModal('printModal');
          BMSQuotations.convertToInvoice(doc._id);
        };
      } else {
        convertBtn.style.display = 'none';
      }
    }

    const markPaidBtn = document.getElementById('btnPreviewMarkPaid');
    if (markPaidBtn) {
      if (isInvoice && doc.payment_status !== 'Paid') {
        markPaidBtn.style.display = 'inline-block';
        markPaidBtn.onclick = () => {
          BMS.closeModal('printModal');
          BMSInvoices.markAsPaid(doc._id);
        };
      } else {
        markPaidBtn.style.display = 'none';
      }
    }
  }
};
