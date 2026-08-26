// admin/reports.js — Reports & Analytics Module
'use strict';

const BMSReports = {
  dashData: null,

  async load() {
    try {
      if (!this.dashData) {
        this.dashData = await BMS.apiFetch('/api/bms/dashboard');
      }
      BMSCharts?.renderReportCharts(this.dashData);
      this.setupExport();
    } catch (err) { BMS.showToast('Failed to load reports: ' + err.message, 'error'); }
  },

  setupExport() {
    const btn = document.getElementById('exportReportBtn');
    if (btn) btn.onclick = () => this.exportCSV();
  },

  async exportCSV() {
    try {
      const [leads, clients, projects, invoices, payments] = await Promise.all([
        BMS.apiFetch('/api/bms/leads'),
        BMS.apiFetch('/api/bms/clients'),
        BMS.apiFetch('/api/bms/projects'),
        BMS.apiFetch('/api/bms/invoices'),
        BMS.apiFetch('/api/bms/payments'),
      ]);

      const sections = [
        { title: 'LEADS', headers: ['Name', 'Company', 'Email', 'Service', 'Status', 'Priority', 'Source', 'Budget', 'Created'],
          data: leads.map(l => [l.name, l.company_name || '', l.email, l.service, l.status, l.priority, l.lead_source, l.budget || '', BMS.formatDate(l.created_at)]) },
        { title: 'CLIENTS', headers: ['Company', 'Contact', 'Email', 'Phone', 'Status'],
          data: clients.map(c => [c.company_name, c.contact_person, c.email, c.phone || '', c.status]) },
        { title: 'PROJECTS', headers: ['Name', 'Client', 'Status', 'Priority', 'Progress %', 'Deadline'],
          data: projects.map(p => [p.name, p.client_name || '', p.status, p.priority, p.progress || 0, BMS.formatDate(p.deadline)]) },
        { title: 'INVOICES', headers: ['Invoice #', 'Client', 'Total', 'Paid', 'Balance', 'Status', 'Due Date'],
          data: invoices.map(i => [i.invoice_number || '', i.client_name, i.total, i.amount_paid || 0, i.balance_due || 0, i.payment_status, BMS.formatDate(i.due_date)]) },
        { title: 'PAYMENTS', headers: ['Date', 'Client', 'Amount', 'Method', 'Type', 'Reference'],
          data: payments.map(p => [BMS.formatDate(p.payment_date), p.client_name, p.amount, p.payment_method, p.payment_type, p.reference || '']) },
      ];

      let csv = `ASCORIX TECH SOLUTIONS - Business Report\nGenerated: ${new Date().toLocaleString('en-IN')}\n\n`;
      sections.forEach(section => {
        csv += `${section.title}\n`;
        csv += section.headers.map(h => `"${h}"`).join(',') + '\n';
        section.data.forEach(row => {
          csv += row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(',') + '\n';
        });
        csv += '\n';
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ASCORIX_Report_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      BMS.showToast('Report exported successfully!', 'success');
    } catch (err) { BMS.showToast('Export failed: ' + err.message, 'error'); }
  }
};
