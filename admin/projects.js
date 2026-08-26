// admin/projects.js — Project & Task Management Module
'use strict';

const BMSProjects = {
  projects: [],
  isKanban: false,

  async load() {
    await BMS.loadClientDatalist();
    await this.fetchAndRender();
    this.setupButtons();
    this.setupSearch();
    this.populateProjectSelect();
  },

  async fetchAndRender() {
    try {
      this.projects = await BMS.apiFetch('/api/bms/projects');
      BMS.projects = this.projects;
      this.renderTable(this.projects);
      if (this.isKanban) this.renderKanban(this.projects);
    } catch (err) { BMS.showToast('Failed to load projects: ' + err.message, 'error'); }
  },

  getFiltered() {
    const q = document.getElementById('projectsSearch')?.value.toLowerCase() || '';
    const status = document.getElementById('projectsStatusFilter')?.value || '';
    return this.projects.filter(p => {
      const matchQ = !q || (p.name + (p.client_name || '')).toLowerCase().includes(q);
      const matchS = !status || p.status === status;
      return matchQ && matchS;
    });
  },

  renderTable(projects) {
    const tbody = document.getElementById('projectsTableBody');
    if (!tbody) return;
    if (!projects.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="bms-table-empty">No projects yet.</td></tr>`;
      return;
    }
    tbody.innerHTML = projects.map(p => {
      const progress = p.progress || 0;
      const isOverdue = p.deadline && new Date(p.deadline) < new Date() && !['Completed','Delivered'].includes(p.status);
      return `
        <tr>
          <td><span style="color:var(--bms-text-3);font-size:11px">#${p.project_number || '—'}</span></td>
          <td>
            <div style="font-weight:600;color:var(--bms-white)">${p.name}</div>
            <div style="font-size:11px;color:var(--bms-text-2)">${p.service_type || ''}</div>
          </td>
          <td>${p.client_name || '—'}</td>
          <td>${BMS.statusBadge(p.status)}</td>
          <td>${BMS.priorityIcon(p.priority)} ${BMS.statusBadge(p.priority)}</td>
          <td>
            <div style="display:flex;align-items:center;gap:8px">
              <div class="bms-progress" style="flex:1;max-width:100px"><div class="bms-progress-bar" style="width:${progress}%"></div></div>
              <span style="font-size:12px;color:var(--bms-text-2)">${progress}%</span>
            </div>
          </td>
          <td>
            ${p.deadline ? `<span style="color:${isOverdue ? 'var(--bms-red)' : 'var(--bms-text-2)'};font-size:12px">${isOverdue ? '⚠️ ' : ''}${BMS.formatDate(p.deadline)}</span>` : '—'}
          </td>
          <td>
            <div style="display:flex;gap:4px">
              <button class="btn-bms btn-bms-secondary btn-bms-sm" onclick="BMSProjects.editProject('${p._id}')">✏️</button>
              <button class="btn-bms btn-bms-danger btn-bms-sm" onclick="BMSProjects.deleteProject('${p._id}')">🗑</button>
            </div>
          </td>
        </tr>`;
    }).join('');
  },

  renderKanban(projects) {
    const container = document.getElementById('projectsKanban');
    if (!container) return;
    const statuses = ['Pending', 'Planning', 'UI Design', 'Development', 'Testing', 'Review', 'Completed', 'Delivered'];
    const colors = { Pending: '#64748b', Planning: '#8b5cf6', 'UI Design': '#06b6d4', Development: '#3b82f6', Testing: '#f97316', Review: '#f59e0b', Completed: '#10b981', Delivered: '#34d399' };
    container.innerHTML = statuses.map(status => {
      const cols = projects.filter(p => p.status === status);
      return `
        <div class="bms-kanban-col" data-status="${status}">
          <div class="bms-kanban-col-header" style="border-top:2px solid ${colors[status]}">
            <span style="color:${colors[status]}">●</span> ${status}
            <span class="bms-kanban-col-count">${cols.length}</span>
          </div>
          <div class="bms-kanban-cards" data-status="${status}" ondragover="BMSProjects.onDragOver(event)" ondrop="BMSProjects.onDrop(event,'${status}')">
            ${cols.map(p => `
              <div class="bms-kanban-card" draggable="true" data-id="${p._id}" ondragstart="BMSProjects.onDragStart(event,'${p._id}')">
                <h4>${p.name}</h4>
                <p>${p.client_name || 'No client'}</p>
                <div style="margin-bottom:6px">
                  <div class="bms-progress"><div class="bms-progress-bar" style="width:${p.progress || 0}%"></div></div>
                </div>
                <div class="bms-kanban-card-meta">
                  <span>${BMS.priorityIcon(p.priority)}</span>
                  <span style="font-size:11px;color:var(--bms-text-3)">${p.deadline ? BMS.formatDate(p.deadline) : ''}</span>
                </div>
              </div>`).join('')}
          </div>
        </div>`;
    }).join('');
  },

  onDragStart(event, id) { event.dataTransfer.setData('projectId', id); },
  onDragOver(event) { event.preventDefault(); },
  async onDrop(event, newStatus) {
    event.preventDefault();
    const id = event.dataTransfer.getData('projectId');
    if (!id) return;
    try {
      await BMS.apiFetch(`/api/bms/projects/${id}`, { method: 'PUT', body: JSON.stringify({ status: newStatus }) });
      BMS.showToast(`Project moved to ${newStatus}`, 'success');
      await this.fetchAndRender();
    } catch (err) { BMS.showToast(err.message, 'error'); }
  },

  setupSearch() {
    document.getElementById('projectsSearch')?.addEventListener('input', () => this.renderTable(this.getFiltered()));
    document.getElementById('projectsStatusFilter')?.addEventListener('change', () => this.renderTable(this.getFiltered()));
  },

  setupButtons() {
    const addBtn = document.getElementById('addProjectBtn');
    if (addBtn) addBtn.onclick = () => this.openAdd();
    const saveBtn = document.getElementById('saveProjectBtn');
    if (saveBtn) saveBtn.onclick = () => this.saveProject();

    const toggleBtn = document.getElementById('proj-view-toggle');
    if (toggleBtn) toggleBtn.onclick = () => {
      this.isKanban = !this.isKanban;
      document.getElementById('projects-table-view')?.classList.toggle('hidden', this.isKanban);
      document.getElementById('projects-kanban-view')?.classList.toggle('hidden', !this.isKanban);
      toggleBtn.textContent = this.isKanban ? '☰ Table' : '⊞ Kanban';
      if (this.isKanban) this.renderKanban(this.projects);
    };
  },

  populateProjectSelect() {
    const select = document.getElementById('taskProject');
    if (!select) return;
    const existing = select.value;
    select.innerHTML = '<option value="">Select project…</option>';
    this.projects.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p._id;
      opt.textContent = p.name;
      if (opt.value === existing) opt.selected = true;
      select.appendChild(opt);
    });
  },

  openAdd() {
    document.getElementById('projectId').value = '';
    document.getElementById('projectForm').reset();
    document.getElementById('projectModalTitle').textContent = '➕ New Project';
    document.getElementById('projectStatus').value = 'Pending';
    document.getElementById('projectPriority').value = 'Medium';
    BMS.openModal('projectModal');
  },

  editProject(id) {
    const p = this.projects.find(x => x._id === id);
    if (!p) return;
    document.getElementById('projectId').value = p._id;
    document.getElementById('projectName').value = p.name || '';
    document.getElementById('projectClientName').value = p.client_name || '';
    document.getElementById('projectServiceType').value = p.service_type || '';
    document.getElementById('projectStatus').value = p.status || 'Pending';
    document.getElementById('projectPriority').value = p.priority || 'Medium';
    document.getElementById('projectStart').value = p.start_date ? p.start_date.substring(0, 10) : '';
    document.getElementById('projectDeadline').value = p.deadline ? p.deadline.substring(0, 10) : '';
    document.getElementById('projectBudget').value = p.budget || '';
    document.getElementById('projectProgress').value = p.progress || 0;
    document.getElementById('projectDesc').value = p.description || '';
    document.getElementById('projectModalTitle').textContent = '✏️ Edit Project';
    BMS.openModal('projectModal');
  },

  async saveProject() {
    const id = document.getElementById('projectId').value;
    const body = {
      name: document.getElementById('projectName').value.trim(),
      client_name: document.getElementById('projectClientName').value.trim(),
      service_type: document.getElementById('projectServiceType').value,
      status: document.getElementById('projectStatus').value,
      priority: document.getElementById('projectPriority').value,
      start_date: document.getElementById('projectStart').value || null,
      deadline: document.getElementById('projectDeadline').value || null,
      budget: parseFloat(document.getElementById('projectBudget').value) || 0,
      progress: parseInt(document.getElementById('projectProgress').value) || 0,
      description: document.getElementById('projectDesc').value.trim(),
    };
    if (!body.name) { BMS.showToast('Project name is required', 'error'); return; }
    try {
      if (id) {
        await BMS.apiFetch(`/api/bms/projects/${id}`, { method: 'PUT', body: JSON.stringify(body) });
        BMS.showToast('Project updated', 'success');
      } else {
        await BMS.apiFetch('/api/bms/projects', { method: 'POST', body: JSON.stringify(body) });
        BMS.showToast('Project created', 'success');
      }
      BMS.closeModal('projectModal');
      await this.fetchAndRender();
      this.populateProjectSelect();
    } catch (err) { BMS.showToast(err.message, 'error'); }
  },

  async deleteProject(id) {
    BMS.confirm('Delete this project? Tasks will also be deleted.', async () => {
      try {
        await BMS.apiFetch(`/api/bms/projects/${id}`, { method: 'DELETE' });
        BMS.showToast('Project deleted', 'success');
        await this.fetchAndRender();
      } catch (err) { BMS.showToast(err.message, 'error'); }
    });
  }
};

// ==========================================
// TASKS MODULE
// ==========================================
const BMSTasks = {
  tasks: [],

  async load() {
    try {
      this.tasks = await BMS.apiFetch('/api/bms/tasks');
      this.renderTable(this.tasks);
      this.setupButtons();
      this.setupSearch();
    } catch (err) { BMS.showToast('Failed to load tasks: ' + err.message, 'error'); }
  },

  getFiltered() {
    const q = document.getElementById('tasksSearch')?.value.toLowerCase() || '';
    const status = document.getElementById('tasksStatusFilter')?.value || '';
    return this.tasks.filter(t => {
      const matchQ = !q || t.title.toLowerCase().includes(q);
      const matchS = !status || t.status === status;
      return matchQ && matchS;
    });
  },

  renderTable(tasks) {
    const tbody = document.getElementById('tasksTableBody');
    if (!tbody) return;
    if (!tasks.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="bms-table-empty">No tasks found.</td></tr>`;
      return;
    }
    tbody.innerHTML = tasks.map(t => {
      const projectName = (BMS.projects || []).find(p => p._id === t.project_id)?.name || t.project_id || '—';
      const isOverdue = t.due_date && new Date(t.due_date) < new Date() && t.status !== 'Completed';
      return `
        <tr>
          <td><strong>${t.title}</strong>${t.description ? `<br><span style="font-size:11px;color:var(--bms-text-3)">${t.description}</span>` : ''}</td>
          <td><span class="badge badge-blue">${projectName}</span></td>
          <td>${t.assigned_to || '—'}</td>
          <td>${BMS.priorityIcon(t.priority)} ${BMS.statusBadge(t.priority)}</td>
          <td>${BMS.statusBadge(t.status)}</td>
          <td>${t.due_date ? `<span style="color:${isOverdue ? 'var(--bms-red)' : 'var(--bms-text-2)'};font-size:12px">${isOverdue ? '⚠️ ' : ''}${BMS.formatDate(t.due_date)}</span>` : '—'}</td>
          <td>
            <div style="display:flex;gap:4px">
              <select class="bms-filter-select" style="padding:4px 8px;font-size:12px" onchange="BMSTasks.updateStatus('${t._id}',this.value)">
                <option ${t.status==='Pending'?'selected':''}>Pending</option>
                <option ${t.status==='In Progress'?'selected':''}>In Progress</option>
                <option ${t.status==='Completed'?'selected':''}>Completed</option>
              </select>
              <button class="btn-bms btn-bms-secondary btn-bms-sm" onclick="BMSTasks.editTask('${t._id}')">✏️</button>
              <button class="btn-bms btn-bms-danger btn-bms-sm" onclick="BMSTasks.deleteTask('${t._id}')">🗑</button>
            </div>
          </td>
        </tr>`;
    }).join('');
  },

  setupSearch() {
    document.getElementById('tasksSearch')?.addEventListener('input', () => this.renderTable(this.getFiltered()));
    document.getElementById('tasksStatusFilter')?.addEventListener('change', () => this.renderTable(this.getFiltered()));
  },

  setupButtons() {
    const addBtn = document.getElementById('addTaskBtn');
    if (addBtn) addBtn.onclick = () => {
      document.getElementById('taskId').value = '';
      document.getElementById('taskForm').reset();
      document.getElementById('taskModalTitle').textContent = '➕ Add Task';
      BMSProjects.populateProjectSelect();
      BMS.openModal('taskModal');
    };
    const saveBtn = document.getElementById('saveTaskBtn');
    if (saveBtn) saveBtn.onclick = () => this.saveTask();
  },

  editTask(id) {
    const t = this.tasks.find(x => x._id === id);
    if (!t) return;
    document.getElementById('taskId').value = t._id;
    document.getElementById('taskTitle').value = t.title || '';
    document.getElementById('taskProject').value = t.project_id || '';
    document.getElementById('taskAssigned').value = t.assigned_to || '';
    document.getElementById('taskPriority').value = t.priority || 'Medium';
    document.getElementById('taskStatus').value = t.status || 'Pending';
    document.getElementById('taskDue').value = t.due_date ? t.due_date.substring(0, 10) : '';
    document.getElementById('taskDesc').value = t.description || '';
    document.getElementById('taskModalTitle').textContent = '✏️ Edit Task';
    BMSProjects.populateProjectSelect();
    document.getElementById('taskProject').value = t.project_id || '';
    BMS.openModal('taskModal');
  },

  async updateStatus(id, status) {
    try {
      await BMS.apiFetch(`/api/bms/tasks/${id}`, { method: 'PUT', body: JSON.stringify({ status }) });
      const task = this.tasks.find(t => t._id === id);
      if (task) task.status = status;
      BMS.showToast('Task status updated', 'success');
    } catch (err) { BMS.showToast(err.message, 'error'); }
  },

  async saveTask() {
    const id = document.getElementById('taskId').value;
    const body = {
      title: document.getElementById('taskTitle').value.trim(),
      project_id: document.getElementById('taskProject').value,
      assigned_to: document.getElementById('taskAssigned').value.trim(),
      priority: document.getElementById('taskPriority').value,
      status: document.getElementById('taskStatus').value,
      due_date: document.getElementById('taskDue').value || null,
      description: document.getElementById('taskDesc').value.trim(),
    };
    if (!body.title || !body.project_id) { BMS.showToast('Title and project are required', 'error'); return; }
    try {
      if (id) {
        await BMS.apiFetch(`/api/bms/tasks/${id}`, { method: 'PUT', body: JSON.stringify(body) });
        BMS.showToast('Task updated', 'success');
      } else {
        await BMS.apiFetch('/api/bms/tasks', { method: 'POST', body: JSON.stringify(body) });
        BMS.showToast('Task created', 'success');
      }
      BMS.closeModal('taskModal');
      this.tasks = await BMS.apiFetch('/api/bms/tasks');
      this.renderTable(this.tasks);
    } catch (err) { BMS.showToast(err.message, 'error'); }
  },

  async deleteTask(id) {
    BMS.confirm('Delete this task?', async () => {
      try {
        await BMS.apiFetch(`/api/bms/tasks/${id}`, { method: 'DELETE' });
        BMS.showToast('Task deleted', 'success');
        this.tasks = this.tasks.filter(t => t._id !== id);
        this.renderTable(this.tasks);
      } catch (err) { BMS.showToast(err.message, 'error'); }
    });
  }
};
