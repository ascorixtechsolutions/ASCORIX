// admin/ai-assistant.js — AI Assistant Module
'use strict';

const BMSAi = {
  initialized: false,

  init() {
    if (this.initialized) return;
    this.initialized = true;
    this.setupChat();
    this.setupQuickActions();
  },

  setupChat() {
    const input = document.getElementById('aiInput');
    const sendBtn = document.getElementById('aiSendBtn');
    if (!input || !sendBtn) return;

    sendBtn.addEventListener('click', () => this.sendMessage());
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.sendMessage();
    });
  },

  setupQuickActions() {
    document.querySelectorAll('.ai-quick-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.getAttribute('data-action');
        this.triggerAction(action, btn.textContent.replace(/[^a-zA-Z ]/g, '').trim());
      });
    });
  },

  async sendMessage() {
    const input = document.getElementById('aiInput');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    input.value = '';

    this.appendMessage(text, 'user');

    // Parse intent from user text
    const action = this.parseIntent(text.toLowerCase());
    await this.callAI(action, text);
  },

  parseIntent(text) {
    const t = text.trim().toLowerCase();
    if (t.includes('overdue') || t.includes('follow') || t.includes('missed') || t.includes('late') || t.includes('delay')) {
      if (t.includes('template') || t.includes('email') || t.includes('message')) {
        return 'suggest_followup';
      }
      return 'overdue_followups';
    }
    if (t.includes('template') || t.includes('email') || t.includes('message') || t.includes('follow up')) return 'suggest_followup';
    if (t.includes('pric') || t.includes('cost') || t.includes('rate') || t.includes('fee') || t.includes('prc') || t.includes('proc') || t.includes('charge')) return 'suggest_pricing';
    if (t.includes('quot') || t.includes('proposal') || t.includes('draft') || t.includes('estimate') || t.includes('qout')) return 'draft_quotation';
    if (t.includes('lead') || t.includes('summar') || t.includes('info')) return 'summarize_lead';
    return 'default';
  },

  async triggerAction(action, label) {
    this.appendMessage(label, 'user');
    await this.callAI(action);
  },

  async callAI(action, inputText) {
    const msgEl = this.appendMessage('Thinking…', 'bot');

    try {
      let data = {};

      // For lead-specific actions, grab latest lead context if available
      if (['summarize_lead', 'suggest_followup', 'draft_quotation'].includes(action)) {
        try {
          const leads = await BMS.apiFetch('/api/bms/leads');
          const newest = leads.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
          if (newest) data = newest;
        } catch (e) {}
      }
      if (action === 'suggest_pricing' && inputText) {
        data = { service: inputText };
      }

      const res = await BMS.apiFetch('/api/bms/ai', {
        method: 'POST',
        body: JSON.stringify({ action, data })
      });
      msgEl.textContent = res.response || 'Done!';
    } catch (err) {
      msgEl.textContent = `❌ Error: ${err.message}`;
    }
  },

  appendMessage(text, role) {
    const messages = document.getElementById('aiMessages');
    if (!messages) return;
    const div = document.createElement('div');
    div.className = `ai-msg ${role === 'user' ? 'user' : ''}`;
    div.innerHTML = `
      <div class="ai-msg-avatar">${role === 'user' ? '👤' : '🤖'}</div>
      <div class="ai-msg-content">${text}</div>`;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
    return div.querySelector('.ai-msg-content');
  }
};
