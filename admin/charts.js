// admin/charts.js — Dashboard Chart.js Wrappers
'use strict';

const BMSCharts = {
  instances: {},

  chartDefaults() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#94a3b8', font: { size: 11, family: 'Inter' }, padding: 14, boxWidth: 12 } },
        tooltip: {
          backgroundColor: '#0a1228',
          borderColor: 'rgba(59,130,246,0.3)',
          borderWidth: 1,
          titleColor: '#e2e8f0',
          bodyColor: '#94a3b8',
          padding: 10,
          cornerRadius: 8
        }
      },
      scales: {
        x: { ticks: { color: '#64748b', font: { size: 11 } }, grid: { color: 'rgba(59,130,246,0.06)' } },
        y: { ticks: { color: '#64748b', font: { size: 11 } }, grid: { color: 'rgba(59,130,246,0.06)' } }
      }
    };
  },

  destroy(id) {
    if (this.instances[id]) {
      this.instances[id].destroy();
      delete this.instances[id];
    }
  },

  renderDashboardCharts(charts) {
    if (!charts) return;

    // Leads per month (bar)
    this.renderBar('chart-leads-monthly',
      charts.leads_per_month?.map(d => d.label) || [],
      [{ label: 'Leads', data: charts.leads_per_month?.map(d => d.count) || [], backgroundColor: 'rgba(59,130,246,0.6)', borderColor: '#3b82f6', borderWidth: 2, borderRadius: 6 }]
    );

    // Revenue bar
    this.renderBar('chart-revenue',
      charts.revenue_per_month?.map(d => d.label) || [],
      [{ label: 'Revenue (₹)', data: charts.revenue_per_month?.map(d => d.amount) || [], backgroundColor: 'rgba(16,185,129,0.6)', borderColor: '#10b981', borderWidth: 2, borderRadius: 6 }]
    );

    // Lead sources doughnut
    this.renderDoughnut('chart-sources',
      charts.lead_sources?.map(d => d.name) || [],
      charts.lead_sources?.map(d => d.value) || []
    );

    // Service distribution
    this.renderDoughnut('chart-services',
      charts.service_distribution?.map(d => d.name) || [],
      charts.service_distribution?.map(d => d.value) || [],
      ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#f97316', '#ec4899']
    );
  },

  renderBar(canvasId, labels, datasets) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    this.destroy(canvasId);
    const defaults = this.chartDefaults();
    this.instances[canvasId] = new Chart(canvas, {
      type: 'bar',
      data: { labels, datasets },
      options: { ...defaults }
    });
  },

  renderLine(canvasId, labels, datasets) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    this.destroy(canvasId);
    this.instances[canvasId] = new Chart(canvas, {
      type: 'line',
      data: { labels, datasets },
      options: this.chartDefaults()
    });
  },

  renderDoughnut(canvasId, labels, data, colors) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    this.destroy(canvasId);
    const defaultColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899'];
    const defaults = this.chartDefaults();
    delete defaults.scales;
    this.instances[canvasId] = new Chart(canvas, {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: colors || defaultColors, borderColor: '#060c1a', borderWidth: 2 }] },
      options: { ...defaults, cutout: '65%' }
    });
  },

  renderReportCharts(dashData) {
    if (!dashData) return;

    // Revenue line chart
    this.renderLine('chart-rev-report',
      dashData.charts?.revenue_per_month?.map(d => d.label) || [],
      [{
        label: 'Revenue (₹)',
        data: dashData.charts?.revenue_per_month?.map(d => d.amount) || [],
        borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)',
        fill: true, tension: 0.4, pointBackgroundColor: '#10b981'
      }]
    );

    // Lead conversion funnel (horizontal bar)
    const canvas = document.getElementById('chart-conv-report');
    if (canvas) {
      this.destroy('chart-conv-report');
      const l = dashData.leads || {};
      const defaults = this.chartDefaults();
      this.instances['chart-conv-report'] = new Chart(canvas, {
        type: 'bar',
        data: {
          labels: ['New', 'Contacted', 'Qualified', 'Proposal', 'Won', 'Lost'],
          datasets: [{
            label: 'Leads',
            data: [l.new || 0, l.contacted || 0, l.qualified || 0, l.proposal_sent || 0, l.won || 0, l.lost || 0],
            backgroundColor: ['#3b82f6', '#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444'],
            borderRadius: 6
          }]
        },
        options: { ...defaults, indexAxis: 'y' }
      });
    }

    // Service demand
    this.renderDoughnut('chart-svc-report',
      dashData.charts?.service_distribution?.map(d => d.name) || [],
      dashData.charts?.service_distribution?.map(d => d.value) || []
    );

    // Project status doughnut
    const p = dashData.projects || {};
    this.renderDoughnut('chart-proj-report',
      ['Active', 'Pending', 'Completed'],
      [p.active || 0, p.pending || 0, p.completed || 0],
      ['#3b82f6', '#f59e0b', '#10b981']
    );
  }
};
