// admin/notifications.js — Notifications Module
'use strict';

const BMSNotifications = {
  notifications: [],

  async load() {
    try {
      this.notifications = await BMS.apiFetch('/api/bms/notifications');
      this.render();
      this.setupButtons();
    } catch (err) { BMS.showToast('Failed to load notifications: ' + err.message, 'error'); }
  },

  typeIcon(type) {
    const icons = {
      lead: '🎯', success: '✅', error: '❌', info: 'ℹ️',
      payment: '💰', warning: '⚠️', meeting: '📅', system: '⚙️'
    };
    return icons[type] || '🔔';
  },

  typeBg(type) {
    const map = {
      lead: 'rgba(59,130,246,0.15)', success: 'rgba(16,185,129,0.15)',
      payment: 'rgba(245,158,11,0.15)', warning: 'rgba(239,68,68,0.15)',
      info: 'rgba(6,182,212,0.15)', meeting: 'rgba(139,92,246,0.15)'
    };
    return map[type] || 'rgba(148,163,184,0.1)';
  },

  render() {
    const list = document.getElementById('notifList');
    if (!list) return;
    if (!this.notifications.length) {
      list.innerHTML = `<div class="bms-loading-overlay"><p style="color:var(--bms-text-3)">🎉 No notifications. You're all caught up!</p></div>`;
      return;
    }
    list.innerHTML = this.notifications.map(n => `
      <div class="bms-notif-item ${n.is_read ? '' : 'unread'}" onclick="BMSNotifications.markRead('${n._id}')">
        <div class="bms-notif-dot" style="background:${this.typeBg(n.type)}">${this.typeIcon(n.type)}</div>
        <div class="bms-notif-body">
          <div class="bms-notif-title">${n.title}</div>
          <div class="bms-notif-msg">${n.message}</div>
          <div class="bms-notif-time">${BMS.timeAgo(n.created_at)}</div>
        </div>
        ${!n.is_read ? '<div style="width:8px;height:8px;background:var(--bms-blue);border-radius:50%;flex-shrink:0;margin-top:4px"></div>' : ''}
      </div>`).join('');
  },

  async markRead(id) {
    const notif = this.notifications.find(n => n._id === id);
    if (notif?.is_read) return;
    try {
      await BMS.apiFetch(`/api/bms/notifications/${id}/read`, { method: 'PUT' });
      if (notif) notif.is_read = true;
      this.render();
      const count = this.notifications.filter(n => !n.is_read).length;
      BMS.updateNotifBadge(count);
    } catch (err) {}
  },

  async markAllRead() {
    try {
      await BMS.apiFetch('/api/bms/notifications/mark-all-read', { method: 'PUT' });
      this.notifications.forEach(n => n.is_read = true);
      this.render();
      BMS.updateNotifBadge(0);
      BMS.showToast('All notifications marked as read', 'success');
    } catch (err) { BMS.showToast(err.message, 'error'); }
  },

  setupButtons() {
    const markBtn = document.getElementById('markAllReadBtn');
    if (markBtn) markBtn.onclick = () => this.markAllRead();
  }
};
