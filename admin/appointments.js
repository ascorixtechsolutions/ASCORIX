// admin/appointments.js — Appointments & Calendar Module
'use strict';

const BMSAppointments = {
  appointments: [],
  isCalendar: false,
  calDate: new Date(),

  async load() {
    await BMS.loadClientDatalist();
    try {
      this.appointments = await BMS.apiFetch('/api/bms/appointments');
      this.renderTable(this.appointments);
      this.setupButtons();
      this.setupSearch();
    } catch (err) { BMS.showToast('Failed to load appointments: ' + err.message, 'error'); }
  },

  getFiltered() {
    const q = document.getElementById('apptSearch')?.value.toLowerCase() || '';
    const status = document.getElementById('apptStatusFilter')?.value || '';
    return this.appointments.filter(a => {
      const matchQ = !q || (a.title + (a.client_name || '')).toLowerCase().includes(q);
      const matchS = !status || a.status === status;
      return matchQ && matchS;
    });
  },

  renderTable(appts) {
    const tbody = document.getElementById('apptTableBody');
    if (!tbody) return;
    if (!appts.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="bms-table-empty">No appointments scheduled.</td></tr>`;
      return;
    }
    tbody.innerHTML = appts.map(a => `
      <tr>
        <td>
          <div style="font-weight:600;color:var(--bms-white)">${a.title}</div>
          ${a.meeting_link ? `<a href="${a.meeting_link}" target="_blank" style="font-size:11px;color:var(--bms-blue-light)">🔗 Join Meeting</a>` : ''}
        </td>
        <td>${a.client_name || '—'}</td>
        <td>
          <div style="font-size:13px">${BMS.formatDateTime(a.appointment_date)}</div>
          ${a.duration_minutes ? `<div style="font-size:11px;color:var(--bms-text-3)">${a.duration_minutes} minutes</div>` : ''}
        </td>
        <td><span class="badge badge-blue">${a.type || 'Call'}</span></td>
        <td>${BMS.statusBadge(a.status)}</td>
        <td>
          <div style="display:flex;gap:4px">
            <button class="btn-bms btn-bms-secondary btn-bms-sm" onclick="BMSAppointments.editAppt('${a._id}')">✏️</button>
            <button class="btn-bms btn-bms-danger btn-bms-sm" onclick="BMSAppointments.deleteAppt('${a._id}')">🗑</button>
          </div>
        </td>
      </tr>`).join('');
  },

  renderCalendar() {
    const container = document.getElementById('apptCalendar');
    if (!container) return;
    const year = this.calDate.getFullYear();
    const month = this.calDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();

    const monthName = this.calDate.toLocaleString('en', { month: 'long', year: 'numeric' });
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const apptsByDay = {};
    this.appointments.forEach(a => {
      const d = new Date(a.appointment_date);
      if (d.getMonth() === month && d.getFullYear() === year) {
        const key = d.getDate();
        if (!apptsByDay[key]) apptsByDay[key] = [];
        apptsByDay[key].push(a);
      }
    });

    let html = `
      <div class="bms-calendar-header">
        <button class="bms-calendar-nav" onclick="BMSAppointments.prevMonth()">◀</button>
        <h3>${monthName}</h3>
        <button class="bms-calendar-nav" onclick="BMSAppointments.nextMonth()">▶</button>
      </div>
      <div class="bms-calendar-grid">
        ${days.map(d => `<div class="bms-calendar-day-label">${d}</div>`).join('')}`;

    for (let i = 0; i < firstDay; i++) {
      html += `<div class="bms-calendar-day other-month"></div>`;
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
      const dayAppts = apptsByDay[d] || [];
      html += `<div class="bms-calendar-day ${isToday ? 'today' : ''}">
        <div class="day-num">${d}</div>
        ${dayAppts.slice(0, 2).map(a => `<div class="cal-event">${new Date(a.appointment_date).toLocaleTimeString('en', {hour:'2-digit',minute:'2-digit'})} ${a.title}</div>`).join('')}
        ${dayAppts.length > 2 ? `<div class="cal-event">+${dayAppts.length - 2} more</div>` : ''}
      </div>`;
    }
    html += `</div>`;
    container.innerHTML = html;
  },

  prevMonth() { this.calDate.setMonth(this.calDate.getMonth() - 1); this.renderCalendar(); },
  nextMonth() { this.calDate.setMonth(this.calDate.getMonth() + 1); this.renderCalendar(); },

  setupSearch() {
    document.getElementById('apptSearch')?.addEventListener('input', () => this.renderTable(this.getFiltered()));
    document.getElementById('apptStatusFilter')?.addEventListener('change', () => this.renderTable(this.getFiltered()));
  },

  setupButtons() {
    const addBtn = document.getElementById('addApptBtn');
    if (addBtn) addBtn.onclick = () => this.openAdd();

    const saveBtn = document.getElementById('saveApptBtn');
    if (saveBtn) saveBtn.onclick = () => this.saveAppt();

    const toggleBtn = document.getElementById('appt-view-toggle');
    if (toggleBtn) toggleBtn.onclick = () => {
      this.isCalendar = !this.isCalendar;
      document.getElementById('appt-list-view')?.classList.toggle('hidden', this.isCalendar);
      document.getElementById('appt-calendar-view')?.classList.toggle('hidden', !this.isCalendar);
      toggleBtn.textContent = this.isCalendar ? '☰ List' : '📅 Calendar';
      if (this.isCalendar) this.renderCalendar();
    };
  },

  openAdd() {
    document.getElementById('apptId').value = '';
    document.getElementById('apptForm').reset();
    document.getElementById('apptModalTitle').textContent = '📅 Schedule Meeting';
    document.getElementById('apptStatus').value = 'Upcoming';
    // Default to next hour
    const next = new Date(); next.setHours(next.getHours() + 1, 0, 0, 0);
    document.getElementById('apptDateTime').value = next.toISOString().slice(0, 16);
    BMS.openModal('apptModal');
  },

  editAppt(id) {
    const a = this.appointments.find(x => x._id === id);
    if (!a) return;
    document.getElementById('apptId').value = a._id;
    document.getElementById('apptTitle').value = a.title || '';
    document.getElementById('apptClientName').value = a.client_name || '';
    document.getElementById('apptClientEmail').value = a.client_email || '';
    document.getElementById('apptDateTime').value = a.appointment_date ? a.appointment_date.substring(0, 16) : '';
    document.getElementById('apptDuration').value = a.duration_minutes || 60;
    document.getElementById('apptType').value = a.type || 'Video Call';
    document.getElementById('apptStatus').value = a.status || 'Upcoming';
    document.getElementById('apptLink').value = a.meeting_link || '';
    document.getElementById('apptNotes').value = a.notes || '';
    document.getElementById('apptModalTitle').textContent = '✏️ Edit Appointment';
    BMS.openModal('apptModal');
  },

  async saveAppt() {
    const id = document.getElementById('apptId').value;
    const body = {
      title: document.getElementById('apptTitle').value.trim(),
      client_name: document.getElementById('apptClientName').value.trim(),
      client_email: document.getElementById('apptClientEmail').value.trim(),
      appointment_date: document.getElementById('apptDateTime').value,
      duration_minutes: parseInt(document.getElementById('apptDuration').value) || 60,
      type: document.getElementById('apptType').value,
      status: document.getElementById('apptStatus').value,
      meeting_link: document.getElementById('apptLink').value.trim(),
      notes: document.getElementById('apptNotes').value.trim(),
    };
    if (!body.title || !body.appointment_date) { BMS.showToast('Title and date are required', 'error'); return; }
    try {
      if (id) {
        await BMS.apiFetch(`/api/bms/appointments/${id}`, { method: 'PUT', body: JSON.stringify(body) });
        BMS.showToast('Appointment updated', 'success');
      } else {
        await BMS.apiFetch('/api/bms/appointments', { method: 'POST', body: JSON.stringify(body) });
        BMS.showToast('Appointment scheduled', 'success');
      }
      BMS.closeModal('apptModal');
      this.appointments = await BMS.apiFetch('/api/bms/appointments');
      this.renderTable(this.appointments);
      if (this.isCalendar) this.renderCalendar();
    } catch (err) { BMS.showToast(err.message, 'error'); }
  },

  async deleteAppt(id) {
    BMS.confirm('Cancel this appointment?', async () => {
      try {
        await BMS.apiFetch(`/api/bms/appointments/${id}`, { method: 'DELETE' });
        BMS.showToast('Appointment deleted', 'success');
        this.appointments = this.appointments.filter(a => a._id !== id);
        this.renderTable(this.appointments);
      } catch (err) { BMS.showToast(err.message, 'error'); }
    });
  }
};
