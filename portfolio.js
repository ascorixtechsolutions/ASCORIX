// portfolio.js - ASCORIX TECH SOLUTIONS Upgraded Portfolio System
import { db } from './db.js';

let allProjects = [];
let activeType = 'Demo Project'; // 'Demo Project' or 'Client Project'
let activeCategory = 'all';

export async function renderPortfolio() {
  const container = document.getElementById("portfolio-container");
  if (!container) return;

  try {
    const rawData = await db.getPortfolio();
    
    // Process and unpack serialized description JSON
    allProjects = rawData.map(p => {
      let meta = {};
      try {
        meta = JSON.parse(p.description);
      } catch (e) {
        // Fallback for legacy simple projects
        meta = {
          slug: p.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          type: 'Demo Project',
          short_desc: p.description,
          full_desc: p.description,
          problem: 'N/A',
          solution: 'N/A',
          features: ['Production-grade architecture', 'Secure credentials vaulting', 'Optimized asset delivery workflows'],
          published: true,
          featured: false,
          show_home: true,
          show_page: true,
          order: 0,
          status: 'Completed',
          client_name: '',
          company_name: '',
          client_url: '',
          show_client: false,
          show_logo: false,
          show_testimonial: false,
          testimonial: '',
          img_desktop: '',
          img_mobile: '',
          img_tablet: '',
          img_admin: '',
          gallery: [],
          industry: 'Technology',
          dev_time: '2 Weeks',
          launch_date: '',
          demo_url: '',
          live_url: '',
          github_url: '',
          video_url: ''
        };
      }
      return { ...p, meta };
    }).filter(p => p.meta.published === true || p.meta.published === 'true'); // Only show published items

    // Update statistics counters
    updateStatistics();

    // Filter projects by current active tab and category
    const filtered = allProjects.filter(p => {
      const typeMatch = p.meta.type === activeType;
      const categoryMatch = activeCategory === 'all' || p.category.toLowerCase() === activeCategory.toLowerCase();
      return typeMatch && categoryMatch;
    }).sort((a, b) => (b.meta.order || 0) - (a.meta.order || 0)); // Sort by priority order

    // Check empty states
    if (filtered.length === 0) {
      if (activeType === 'Client Project') {
        container.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 4rem; background: var(--glass-bg); border: 1px solid var(--glass-border); border-radius: 16px; color: var(--color-text-secondary);">
            <div style="font-size: 3rem; margin-bottom: 1.5rem;">👥</div>
            <p style="font-size: 1.15rem; max-width: 500px; margin: 0 auto; line-height: 1.6;">Client projects will be showcased here as we successfully complete projects for our valued customers.</p>
          </div>
        `;
      } else {
        container.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 4rem; background: var(--glass-bg); border: 1px solid var(--glass-border); border-radius: 16px; color: var(--color-text-secondary);">
            <div style="font-size: 3rem; margin-bottom: 1.5rem;">🛠️</div>
            <p style="font-size: 1.15rem; max-width: 500px; margin: 0 auto; line-height: 1.6;">Our demo portfolio is currently being prepared. Exciting projects will be added soon.</p>
          </div>
        `;
      }
      return;
    }

    // Render cards
    container.innerHTML = filtered.map(project => {
      const techTags = project.tech.map(t => `<span class="tech-tag" style="font-size: 0.7rem; padding: 0.2rem 0.5rem; background: rgba(255,255,255,0.05); border-radius: 4px; color: var(--color-text-secondary); border: 1px solid rgba(255,255,255,0.05);">${escapeHTML(t)}</span>`).join("");
      const featureTags = (project.meta.features || []).slice(0, 3).map(f => `<span style="font-size: 0.75rem; color: var(--accent-cyan); display: flex; align-items: center; gap: 4px;">● ${escapeHTML(f)}</span>`).join("");
      const id = project._id || project.id;
      const featuredBadge = (project.meta.featured === true || project.meta.featured === 'true') ? `<span class="badge badge-orange" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color:#fff; font-size: 0.65rem; padding: 0.2rem 0.6rem; border-radius: 4px; font-weight: 700; margin-left: 5px;">Featured</span>` : '';
      
      // Determine links
      const liveLink = project.meta.live_url || '';
      const demoLink = project.meta.demo_url || '';
      
      let buttonsHtml = `<button class="nav-btn view-details-btn" data-id="${id}" style="padding: 0.5rem 1rem; font-size: 0.8rem; border-radius: 50px; background: rgba(6, 182, 212, 0.15); border: 1px solid rgba(6, 182, 212, 0.3); color: var(--accent-cyan); cursor: pointer; transition: all 0.3s;">View Details</button>`;
      
      if (liveLink) {
        buttonsHtml += `<a href="${liveLink}" target="_blank" class="nav-btn" style="padding: 0.5rem 1rem; font-size: 0.8rem; border-radius: 50px; text-decoration: none; text-align: center; background: var(--gradient-primary); border: none; color: white; transition: all 0.3s;">Visit Website</a>`;
      } else if (demoLink) {
        buttonsHtml += `<a href="${demoLink}" target="_blank" class="nav-btn" style="padding: 0.5rem 1rem; font-size: 0.8rem; border-radius: 50px; text-decoration: none; text-align: center; background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border); color: white; transition: all 0.3s;">Live Demo</a>`;
      }

      return `
        <div class="portfolio-card" data-project-id="${id}" style="display: flex; flex-direction: column; background: var(--glass-bg); border: 1px solid var(--glass-border); border-radius: 16px; overflow: hidden; box-shadow: var(--glass-shadow); transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1); cursor: pointer;">
          <div class="portfolio-img-box" style="position: relative; width: 100%; height: 210px; overflow: hidden;">
            <img src="${project.image}" alt="${escapeHTML(project.title)}" style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);" loading="lazy">
            <div class="portfolio-overlay" style="position: absolute; inset: 0; background: linear-gradient(0deg, rgba(12,18,36,0.9) 0%, rgba(12,18,36,0.1) 100%); transition: opacity 0.3s;"></div>
            <span style="position: absolute; top: 12px; left: 12px; background: rgba(6,182,212,0.15); border: 1px solid rgba(6,182,212,0.3); color: var(--accent-cyan); font-size: 0.7rem; font-weight: 700; padding: 0.25rem 0.75rem; border-radius: 50px; text-transform: uppercase;">${escapeHTML(project.category)}</span>
          </div>
          <div class="portfolio-content" style="padding: 1.5rem; flex-grow: 1; display: flex; flex-direction: column; justify-content: space-between;">
            <div>
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem;">
                <span class="portfolio-cat" style="font-size: 0.75rem; color: var(--accent-cyan); font-weight: 700; letter-spacing: 0.05em;">${activeType === 'Demo Project' ? 'Demo Sandbox' : 'Client Launch'}</span>
                ${featuredBadge}
              </div>
              <h3 class="portfolio-title" style="font-size: 1.35rem; color: white; margin-bottom: 0.75rem; font-weight: 700;">${escapeHTML(project.title)}</h3>
              <p class="portfolio-desc" style="font-size: 0.9rem; color: var(--color-text-secondary); line-height: 1.5; margin-bottom: 1.25rem; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">${escapeHTML(project.meta.short_desc || '')}</p>
              
              <!-- Key features list -->
              <div style="display: flex; flex-wrap: wrap; gap: 8px 16px; margin-bottom: 1.5rem;">
                ${featureTags}
              </div>
            </div>
            
            <div style="border-top: 1px solid rgba(255,255,255,0.06); padding-top: 1.25rem;">
              <!-- Tech stack -->
              <div class="portfolio-tech" style="display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 1.25rem;">
                ${techTags}
              </div>
              
              <div style="display: flex; gap: 10px; align-items: center; margin-top: auto;">
                ${buttonsHtml}
              </div>
            </div>
          </div>
        </div>
      `;
    }).join("");

    // Attach click events to redirect to the new standalone demo page
    container.querySelectorAll(".portfolio-card").forEach(card => {
      card.addEventListener("click", (e) => {
        if (e.target.tagName === 'A' || e.target.closest('.view-details-btn')) return;
        const projectId = card.getAttribute("data-project-id");
        window.location.href = `demo/index.html?id=${projectId}`;
      });
    });

    container.querySelectorAll(".view-details-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const projectId = btn.getAttribute("data-id");
        window.location.href = `demo/index.html?id=${projectId}`;
      });
    });

  } catch (err) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 4rem; color: var(--accent-danger);">
        Error loading portfolio from database. Please reload or check connection settings.
      </div>
    `;
  }
}

function updateStatistics() {
  const compEl = document.getElementById('stat-completed-projects');
  const demoEl = document.getElementById('stat-counter-demo');
  const clientEl = document.getElementById('stat-counter-client');
  const featEl = document.getElementById('stat-featured-projects');
  const indEl = document.getElementById('stat-industries-served');

  // Map correctly to updated IDs in HTML
  const completedRef = compEl || document.getElementById('stat-completed-projects');
  const demoRef = demoEl || document.getElementById('stat-demo-projects');
  const clientRef = clientEl || document.getElementById('stat-client-projects');
  const featRef = featEl || document.getElementById('stat-featured-projects');
  const indRef = indEl || document.getElementById('stat-industries-served');

  if (!completedRef) return;

  const totalCompleted = allProjects.length;
  const demoCount = allProjects.filter(p => p.meta.type === 'Demo Project').length;
  const clientCount = allProjects.filter(p => p.meta.type === 'Client Project').length;
  const featuredCount = allProjects.filter(p => p.meta.featured === true || p.meta.featured === 'true').length;
  
  const industries = [...new Set(allProjects.map(p => p.meta.industry || p.category))].filter(Boolean).length;

  animateCounter(completedRef, totalCompleted);
  animateCounter(demoRef, demoCount);
  animateCounter(clientRef, clientCount);
  animateCounter(featRef, featuredCount);
  animateCounter(indRef, industries || 1);
}

function animateCounter(el, target) {
  let current = 0;
  const duration = 800; // ms
  const step = Math.ceil(target / (duration / 16)) || 1;
  const timer = setInterval(() => {
    current += step;
    if (current >= target) {
      el.textContent = target;
      clearInterval(timer);
    } else {
      el.textContent = current;
    }
  }, 16);
}

async function openProjectDetails(projectId) {
  try {
    const project = allProjects.find(p => (p._id === projectId || p.id === projectId));
    if (!project) return;

    const modal = document.getElementById("project-detail-modal");
    const content = document.getElementById("project-detail-content");

    if (!modal || !content) return;

    const featuresHtml = (project.meta.features || []).map(f => `
      <div style="display: flex; align-items: center; gap: 8px; font-size: 0.95rem; color: var(--color-text-secondary); margin-bottom: 6px;">
        <span style="color: var(--accent-cyan); font-weight: bold;">✓</span> ${escapeHTML(f)}
      </div>`).join('');

    const techTags = project.tech.map(t => `<span class="tech-tag" style="background: rgba(6, 182, 212, 0.15); color: var(--accent-cyan); font-weight: 600; font-size: 0.8rem; padding: 0.3rem 0.75rem; border-radius: 5px; border: 1px solid rgba(6,182,212,0.25);">${escapeHTML(t)}</span>`).join("");

    let galleryHtml = '';
    const allGalleryImages = [project.image, ...(project.meta.gallery || [])].filter(Boolean);
    if (allGalleryImages.length > 1) {
      galleryHtml = `
        <div style="margin-top: 2.5rem;">
          <h4 style="font-size: 1.15rem; color: white; margin-bottom: 1rem; font-weight: 700;">Project Gallery</h4>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;">
            ${allGalleryImages.map(img => `<img src="${img}" style="width: 100%; height: 120px; object-fit: cover; border-radius: 8px; border: 1px solid rgba(255,255,255,0.06); transition: transform 0.3s; cursor: pointer;" onmouseover="this.style.transform='scale(1.04)'" onmouseout="this.style.transform='scale(1)'" onclick="window.open('${img}', '_blank')">`).join('')}
          </div>
        </div>
      `;
    }

    let screensHtml = '';
    if (project.meta.img_desktop || project.meta.img_mobile || project.meta.img_tablet) {
      screensHtml = `
        <div style="margin-top: 2.5rem; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.03); border-radius: 16px; padding: 1.5rem;">
          <h4 style="font-size: 1.15rem; color: white; margin-bottom: 1.5rem; font-weight: 700; text-align: center;">Device Responsive Layout Previews</h4>
          <div style="display: flex; gap: 20px; align-items: flex-end; justify-content: center; flex-wrap: wrap;">
            ${project.meta.img_desktop ? `
              <div style="flex: 1; min-width: 250px; text-align: center;">
                <div style="border: 4px solid #333; border-radius: 8px; overflow: hidden; background: #000; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
                  <img src="${project.meta.img_desktop}" style="width: 100%; height: auto; display: block;">
                </div>
                <span style="font-size: 0.75rem; color: var(--color-text-secondary); margin-top: 8px; display: block;">Desktop Standard Layout</span>
              </div>` : ''}
            ${project.meta.img_tablet ? `
              <div style="width: 140px; text-align: center;">
                <div style="border: 5px solid #222; border-radius: 12px; overflow: hidden; background: #000; box-shadow: 0 10px 20px rgba(0,0,0,0.5);">
                  <img src="${project.meta.img_tablet}" style="width: 100%; height: auto; display: block;">
                </div>
                <span style="font-size: 0.75rem; color: var(--color-text-secondary); margin-top: 8px; display: block;">Tablet Portrait</span>
              </div>` : ''}
            ${project.meta.img_mobile ? `
              <div style="width: 90px; text-align: center;">
                <div style="border: 6px solid #111; border-radius: 14px; overflow: hidden; background: #000; box-shadow: 0 10px 20px rgba(0,0,0,0.5);">
                  <img src="${project.meta.img_mobile}" style="width: 100%; height: auto; display: block;">
                </div>
                <span style="font-size: 0.75rem; color: var(--color-text-secondary); margin-top: 8px; display: block;">Mobile Adaptive</span>
              </div>` : ''}
          </div>
        </div>
      `;
    }

    let testimonialHtml = '';
    if ((project.meta.show_testimonial === true || project.meta.show_testimonial === 'true') && project.meta.testimonial) {
      testimonialHtml = `
        <div style="margin-top: 2.5rem; background: radial-gradient(circle at 10% 20%, rgba(6,182,212,0.06) 0%, rgba(12,18,36,0) 100%); border-left: 4px solid var(--accent-cyan); border-radius: 0 12px 12px 0; padding: 1.5rem; margin-bottom: 1.5rem;">
          <p style="font-style: italic; color: white; font-size: 1rem; line-height: 1.6; margin-bottom: 0.75rem;">"${escapeHTML(project.meta.testimonial)}"</p>
          <div style="font-weight: 700; color: var(--accent-cyan); font-size: 0.9rem;">— ${escapeHTML(project.meta.client_name || 'Project Sponsor')}${project.meta.company_name ? `, ${escapeHTML(project.meta.company_name)}` : ''}</div>
        </div>
      `;
    }

    const visitBtn = project.meta.live_url ? `<a href="${project.meta.live_url}" target="_blank" class="nav-btn" style="text-decoration: none; padding: 0.75rem 2rem; background: var(--gradient-primary); border-radius: 50px; font-weight: 700; color: white; text-align: center;">Visit Live Website</a>` : '';
    const demoBtn = project.meta.demo_url ? `<a href="${project.meta.demo_url}" target="_blank" class="nav-btn btn-secondary" style="text-decoration: none; padding: 0.75rem 2rem; border-radius: 50px; font-weight: 700; text-align: center; border: 1px solid var(--glass-border); color: white;">Launch Sandbox Demo</a>` : '';

    content.innerHTML = `
      <div style="width: 100%; height: 320px; overflow: hidden; position: relative;">
        <img src="${project.image}" alt="${escapeHTML(project.title)}" style="width: 100%; height: 100%; object-fit: cover;">
        <div style="position: absolute; inset: 0; background: linear-gradient(180deg, rgba(12,18,36,0.3) 0%, rgba(12,18,36,0.95) 100%);"></div>
        <div style="position: absolute; bottom: 24px; left: 24px; right: 24px;">
          <span style="background: rgba(6, 182, 212, 0.2); color: var(--accent-cyan); padding: 0.25rem 0.75rem; border-radius: 50px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase;">${escapeHTML(project.category)}</span>
          <h2 style="font-size: 2.2rem; font-weight: 800; color: white; margin-top: 8px; line-height: 1.2;">${escapeHTML(project.title)}</h2>
        </div>
      </div>
      
      <div style="padding: 2.5rem; display: grid; grid-template-columns: 1.7fr 1.3fr; gap: 40px; border-top: 1px solid rgba(255,255,255,0.03);">
        <div>
          <h4 style="font-size: 1.15rem; color: white; margin-bottom: 0.75rem; font-weight: 700;">Project Overview</h4>
          <p style="color: var(--color-text-secondary); line-height: 1.6; font-size: 0.95rem; margin-bottom: 1.5rem;">${escapeHTML(project.meta.full_desc || project.description || '')}</p>
          
          ${project.meta.problem ? `
            <h4 style="font-size: 1.15rem; color: white; margin-bottom: 0.75rem; font-weight: 700; margin-top: 2rem;">The Business Challenge</h4>
            <p style="color: var(--color-text-secondary); line-height: 1.6; font-size: 0.95rem; margin-bottom: 1.5rem;">${escapeHTML(project.meta.problem)}</p>` : ''}
            
          ${project.meta.solution ? `
            <h4 style="font-size: 1.15rem; color: white; margin-bottom: 0.75rem; font-weight: 700; margin-top: 2rem;">Engineering Architecture Delivered</h4>
            <p style="color: var(--color-text-secondary); line-height: 1.6; font-size: 0.95rem; margin-bottom: 1.5rem;">${escapeHTML(project.meta.solution)}</p>` : ''}

          ${screensHtml}
          ${galleryHtml}
        </div>
        
        <div>
          <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.04); border-radius: 16px; padding: 1.5rem; margin-bottom: 2rem;">
            <h4 style="font-size: 1.05rem; color: white; margin-bottom: 1rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 8px;">Launch Specifications</h4>
            
            <div style="display: flex; flex-direction: column; gap: 12px; font-size: 0.9rem;">
              <div style="display: flex; justify-content: space-between;"><span style="color: var(--color-text-muted);">Industry:</span><strong style="color: white;">${escapeHTML(project.meta.industry || 'Technology')}</strong></div>
              <div style="display: flex; justify-content: space-between;"><span style="color: var(--color-text-muted);">Launch Date:</span><strong style="color: white;">${escapeHTML(project.meta.launch_date || 'N/A')}</strong></div>
              <div style="display: flex; justify-content: space-between;"><span style="color: var(--color-text-muted);">Build Timeline:</span><strong style="color: white;">${escapeHTML(project.meta.dev_time || '2 Weeks')}</strong></div>
              <div style="display: flex; justify-content: space-between;"><span style="color: var(--color-text-muted);">Launch Status:</span><span style="color: var(--accent-cyan); font-weight: bold;">● ${escapeHTML(project.meta.status || 'Completed')}</span></div>
              ${project.meta.company_name ? `<div style="display: flex; justify-content: space-between;"><span style="color: var(--color-text-muted);">Deployment:</span><strong style="color: white;">${escapeHTML(project.meta.company_name)}</strong></div>` : ''}
            </div>
          </div>

          <div style="margin-bottom: 2rem;">
            <h4 style="font-size: 1.1rem; color: white; margin-bottom: 0.75rem; font-weight: 700;">Key Features Built</h4>
            ${featuresHtml}
          </div>

          <div style="margin-bottom: 2rem;">
            <h4 style="font-size: 1.1rem; color: white; margin-top: 1.5rem; margin-bottom: 1rem;">Integrated Core Stack</h4>
            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
              ${techTags}
            </div>
          </div>

          ${testimonialHtml}

          <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 3rem;">
            ${visitBtn}
            ${demoBtn}
            <button class="nav-btn btn-secondary" onclick="document.getElementById('project-detail-modal').classList.remove('active')" style="padding: 0.75rem 2rem; border-radius: 50px; font-weight: 700; color: var(--color-text-secondary); cursor: pointer; border: 1px dashed rgba(255,255,255,0.15); background: none;">← Return to Portfolio</button>
          </div>
        </div>

      </div>
    `;

    modal.classList.add("active");
  } catch (err) {
    console.error("Error loading project detail:", err);
  }
}

function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

export async function initPortfolio() {
  await renderPortfolio();

  const tabDemo = document.getElementById('tab-demo-projects');
  const tabClient = document.getElementById('tab-client-projects');

  if (tabDemo && tabClient) {
    tabDemo.onclick = async () => {
      tabDemo.classList.add('active');
      tabClient.classList.remove('active');
      activeType = 'Demo Project';
      await renderPortfolio();
    };

    tabClient.onclick = async () => {
      tabClient.classList.add('active');
      tabDemo.classList.remove('active');
      activeType = 'Client Project';
      await renderPortfolio();
    };
  }

  const filterBtns = document.querySelectorAll(".portfolio-filters .filter-btn");
  filterBtns.forEach(btn => {
    btn.addEventListener("click", async () => {
      filterBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      
      activeCategory = btn.getAttribute("data-category");
      await renderPortfolio();
    });
  });

  const closeBtn = document.getElementById("close-project-detail-btn");
  const modal = document.getElementById("project-detail-modal");
  if (closeBtn && modal) {
    closeBtn.addEventListener("click", () => {
      modal.classList.remove("active");
    });
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.classList.remove("active");
      }
    });
  }

  window.addEventListener("ascorix_portfolio_updated", async () => {
    await renderPortfolio();
  });
}
