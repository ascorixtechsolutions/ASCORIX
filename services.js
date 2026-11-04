// services.js - ASCORIX TECH SOLUTIONS Client Services Module
import { db } from './db.js';

// SVG icon mapper for crisp inline icons
export const ICON_MAP = {
  cpu: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="1" x2="9" y2="4"></line><line x1="15" y1="1" x2="15" y2="4"></line><line x1="9" y1="20" x2="9" y2="23"></line><line x1="15" y1="20" x2="15" y2="23"></line><line x1="20" y1="9" x2="23" y2="9"></line><line x1="20" y1="15" x2="23" y2="15"></line><line x1="1" y1="9" x2="4" y2="9"></line><line x1="1" y1="15" x2="4" y2="15"></line></svg>`,
  cloud: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path></svg>`,
  shield: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`,
  code: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>`
};

export function formatPriceText(priceStr) {
  if (!priceStr) return "";
  let clean = priceStr.trim();
  clean = clean.replace(/\s*base/gi, "");
  clean = clean.replace(/\s*starting/gi, "");
  
  if (clean.toLowerCase().includes("/mo")) {
    clean = clean.replace(/\/mo/gi, "");
    return `${clean}/mo starting`;
  }
  return `${clean} starting`;
}

export function getDynamicCategories(allServices, customCategories = []) {
  const categoryMetadata = {
    "Website Development": {
      id: "web-dev",
      description: "High-performance responsive corporate websites, custom landing pages, and web applications engineered to convert visitors.",
      icon: "code"
    },
    "Digital Marketing": {
      id: "digital-marketing",
      description: "Strategic monthly social content management, copywriting, targeted campaigns, and media production to scale your brand.",
      icon: "cloud"
    },
    "AI Automation": {
      id: "ai-automation",
      description: "Custom WhatsApp auto-responders, automated lead capture pipelines, and seamless CRM workflow integrations.",
      icon: "cpu"
    },
    "Business Automation": {
      id: "business-automation",
      description: "Custom WhatsApp auto-responders, automated lead capture pipelines, and seamless CRM workflow integrations.",
      icon: "cpu"
    },
    "Google Business Profile": {
      id: "google-profile",
      description: "Local maps search optimization, category optimization, and review booster setups to drive organic local calls.",
      icon: "shield"
    },
    "Bundle Packages": {
      id: "bundles",
      description: "Complete combined digital presence starter growth engines offering maximum value and massive discounts.",
      icon: "shield"
    }
  };

  const uniqueNames = [...new Set([
    ...allServices.map(s => s.category.trim()),
    ...customCategories.map(c => c.trim())
  ])].filter(Boolean);

  return uniqueNames.map(name => {
    const meta = categoryMetadata[name] || {
      id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      description: "Premium customized solutions and packages tailored for your business.",
      icon: "code"
    };

    const catServices = allServices.filter(s => s.category.trim() === name);
    let rangeText = "";
    if (catServices.length > 0) {
      const prices = catServices.map(s => {
        if (s.original_price > 0 && s.discount_percent > 0) {
          return Math.round(s.original_price * (1 - s.discount_percent / 100));
        }
        return parseCost(s.cost);
      }).sort((a, b) => a - b);

      const minPrice = prices[0];
      const maxPrice = prices[prices.length - 1];
      
      const hasMonthly = catServices.some(s => s.cost && s.cost.toLowerCase().includes("/mo"));
      const suffix = hasMonthly ? "/mo starting" : " starting";

      if (minPrice === maxPrice) {
        rangeText = `₹${minPrice.toLocaleString('en-IN')}${suffix}`;
      } else {
        rangeText = `₹${minPrice.toLocaleString('en-IN')} - ₹${maxPrice.toLocaleString('en-IN')}${suffix}`;
      }
    } else {
      rangeText = "Custom pricing";
    }

    return {
      id: meta.id,
      title: name,
      range: rangeText,
      description: meta.description,
      icon: catServices[0]?.icon || meta.icon
    };
  });
}

export async function renderServices() {
  const container = document.getElementById("services-container");
  if (!container) return;

  try {
    const allServices = await db.getServices();
    let customCategories = [];
    try {
      const settings = await db.getSettings();
      if (settings && settings.customCategories) {
        customCategories = settings.customCategories;
      }
    } catch (e) {
      console.error("Failed to fetch settings for custom categories:", e);
    }
    const dynamicCategories = getDynamicCategories(allServices, customCategories);

    // Render high-level categories on the public homepage services section
    container.innerHTML = dynamicCategories.map(category => {
      const iconSVG = ICON_MAP[category.icon] || ICON_MAP.code;
      return `
        <div class="service-card high-level-category-card" data-category-title="${escapeHTML(category.title)}">
          <div class="service-header">
            <div class="service-icon-box">
              ${iconSVG}
            </div>
            <span class="service-cost" style="color: var(--accent-cyan); font-weight: 700; border-color: rgba(6,182,212,0.2);">${escapeHTML(category.range)}</span>
          </div>
          <div>
            <h3 class="service-title-text">${escapeHTML(category.title)}</h3>
            <p class="service-desc">${escapeHTML(category.description)}</p>
          </div>
          <div class="service-footer">
            <span class="service-cat">Capability Group</span>
            <a href="#" class="service-btn explore-plans-btn" data-category-title="${escapeHTML(category.title)}">
              Explore Plans
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12,5 19,12 12,19"></polyline></svg>
            </a>
          </div>
        </div>
      `;
    }).join("");

    // Update footer capabilities list dynamically
    const footerUl = document.getElementById("footer-capabilities-list");
    if (footerUl) {
      footerUl.innerHTML = dynamicCategories.map(category => {
        return `<li><a href="#services" data-category-title="${escapeHTML(category.title)}">${escapeHTML(category.title)}</a></li>`;
      }).join("");

      footerUl.querySelectorAll("a").forEach(link => {
        link.addEventListener("click", (e) => {
          e.preventDefault();
          const title = link.getAttribute("data-category-title");
          const card = document.querySelector(`.high-level-category-card[data-category-title="${title}"]`);
          if (card) {
            card.scrollIntoView({ behavior: 'smooth' });
            const exploreBtn = card.querySelector(".explore-plans-btn");
            if (exploreBtn) exploreBtn.click();
          }
        });
      });
    }

    // Update navbar categories dropdown dynamically
    const navDropdownMenu = document.getElementById("nav-categories-dropdown");
    if (navDropdownMenu) {
      navDropdownMenu.innerHTML = dynamicCategories.map(category => {
        return `<a href="#services" class="dropdown-item" data-category-title="${escapeHTML(category.title)}">${escapeHTML(category.title)}</a>`;
      }).join("");

      navDropdownMenu.querySelectorAll(".dropdown-item").forEach(link => {
        link.addEventListener("click", async (e) => {
          e.preventDefault();
          const title = link.getAttribute("data-category-title");
          
          const isDashboard = document.body.classList.contains("client-dashboard-mode");
          const isCheckout = document.body.classList.contains("checkout-mode");
          const isExplorer = document.body.classList.contains("category-explorer-mode");
          
          // Helper to exit modes and scroll
          const exitModes = () => {
            if (isDashboard) {
              const exitBtn = document.getElementById("exit-dashboard-btn") || document.getElementById("user-signout-btn");
              if (exitBtn) {
                // If dashboard is active, we can trigger dashboard exit helper or handle exit manually
                document.body.classList.remove("client-dashboard-mode");
                sessionStorage.removeItem("ascorix_active_view");
              }
            }
            if (isCheckout) {
              document.body.classList.remove("checkout-mode");
              sessionStorage.removeItem("ascorix_active_view");
            }
            if (isExplorer) {
              document.body.classList.remove("category-explorer-mode");
              sessionStorage.removeItem("ascorix_active_view");
            }
          };

          const user = db.getCurrentUser();
          if (user) {
            exitModes();
            // Authenticated: open sub-plans explorer immediately
            await openCategoryExplorer(title);
          } else {
            exitModes();
            // Guest: scroll to services section and trigger the card's explore button
            const card = document.querySelector(`.high-level-category-card[data-category-title="${title}"]`);
            if (card) {
              card.scrollIntoView({ behavior: 'smooth' });
              // Trigger the explore plans flow which handles guest auth flow
              const exploreBtn = card.querySelector(".explore-plans-btn");
              if (exploreBtn) {
                setTimeout(() => exploreBtn.click(), 100);
              }
            } else {
              const servicesSec = document.getElementById("services");
              if (servicesSec) {
                servicesSec.scrollIntoView({ behavior: 'smooth' });
              }
            }
          }
        });
      });
    }

    // Entire Category Card Clickable
    container.querySelectorAll(".high-level-category-card").forEach(card => {
      card.style.cursor = "pointer";
      card.addEventListener("click", (e) => {
        if (e.target.closest(".explore-plans-btn")) return;
        const title = card.getAttribute("data-category-title");
        const btn = card.querySelector(`.explore-plans-btn[data-category-title="${title}"]`);
        if (btn) btn.click();
      });
    });

    // Attach event click to Explore Plans buttons
    container.querySelectorAll(".explore-plans-btn").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        const title = btn.getAttribute("data-category-title");
        const category = dynamicCategories.find(c => c.title === title);
        if (!category) return;

        const user = db.getCurrentUser();
        if (user) {
          // Authenticated: open sub-plans explorer immediately
          await openCategoryExplorer(title);
        } else {
          // Guest: prompt login/register gate with custom attract banner
          window.pendingSelectedCategory = title;

          const banner = document.getElementById("auth-product-banner");
          const bannerTitle = document.getElementById("auth-product-title");
          const bannerCost = document.getElementById("auth-product-cost");
          
          if (banner && bannerTitle && bannerCost) {
            bannerTitle.textContent = `${title} Catalog`;
            bannerCost.textContent = `Pricing Range: ${category.range}`;
            banner.style.display = "block";
          }

          // Open auth portal modal
          const authBtn = document.getElementById("auth-signup-btn") || document.getElementById("auth-signin-btn") || document.getElementById("auth-portal-btn");
          if (authBtn) {
            authBtn.click();
          }
        }
      });
    });
  } catch (err) {
    console.error("Failed to render capability categories:", err);
  }
}

// Open Category Explorer view displaying individual plans in selected category
export async function openCategoryExplorer(categoryTitle) {
  try {
    const allServices = await db.getServices();
    // Filter services that belong to selected high-level category
    const subPlans = allServices.filter(s => s.category.toLowerCase().trim() === categoryTitle.toLowerCase().trim());

    const titleEl = document.getElementById("explorer-category-title");
    const container = document.getElementById("explorer-plans-container");
    
    if (!titleEl || !container) return;

    titleEl.textContent = `${categoryTitle} Packages`;
    sessionStorage.setItem("ascorix_active_view", "explorer");
    sessionStorage.setItem("ascorix_explorer_category", categoryTitle);
    document.body.classList.add("category-explorer-mode");
    window.scrollTo({ top: 0, behavior: "smooth" });

    if (subPlans.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 4rem; color: var(--color-text-muted);">
          No individual packages currently loaded for this category. Check back soon!
        </div>
      `;
      return;
    }

    // Check if checkout is active
    let checkoutEnabled = false;
    try {
      const settings = await db.getSettings();
      checkoutEnabled = settings.checkoutEnabled;
    } catch (e) {
      console.warn("Could not retrieve checkout settings:", e);
    }

    container.innerHTML = subPlans.map(plan => {
      const planId = plan._id || plan.id;
      
      // Parse description features
      const desc = plan.description || '';
      const lines = desc.split('\n');
      let parsedFeatures = [];
      let hasCustomFormat = false;
      let generalText = '';

      lines.forEach(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith('+ ')) {
          parsedFeatures.push({ text: trimmed.substring(2), type: 'included' });
          hasCustomFormat = true;
        } else if (trimmed.startsWith('- ')) {
          parsedFeatures.push({ text: trimmed.substring(2), type: 'not_included' });
          hasCustomFormat = true;
        } else {
          if (trimmed) {
            if (generalText) generalText += ' ';
            generalText += trimmed;
          }
        }
      });

      // If it's a legacy comma-separated description
      if (!hasCustomFormat) {
        const legacyFeatures = desc.split(", ").map(f => f.trim()).filter(Boolean);
        parsedFeatures = legacyFeatures.map(f => ({ text: f, type: 'included' }));
      }
      
      const isMonthly = plan.cost && plan.cost.toLowerCase().includes("/mo");
      
      // Calculate discount price if original_price & discount_percent exist
      let costHTML = "";
      let finalCostText = plan.cost;

      if (plan.original_price > 0 && plan.discount_percent > 0) {
        const finalPrice = Math.round(plan.original_price * (1 - plan.discount_percent / 100));
        let origPriceText = `₹${plan.original_price.toLocaleString('en-IN')}`;
        if (isMonthly) origPriceText += "/mo";
        origPriceText = formatPriceText(origPriceText);
        
        let finalCostTextRaw = `₹${finalPrice.toLocaleString('en-IN')}`;
        if (isMonthly) finalCostTextRaw += "/mo";
        finalCostText = formatPriceText(finalCostTextRaw);

        let badgeHTML = "";
        if (plan.discount_reason) {
          badgeHTML = `
            <span class="discount-badge" style="background: linear-gradient(135deg, var(--accent-pink) 0%, #ec4899 100%); color: white; padding: 0.25rem 0.75rem; border-radius: 100px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; display: inline-block; margin-bottom: 0.5rem; box-shadow: 0 4px 10px rgba(236,72,153,0.3);">
              ${plan.discount_percent}% OFF - ${escapeHTML(plan.discount_reason)}
            </span>
          `;
        } else {
          badgeHTML = `
            <span class="discount-badge" style="background: linear-gradient(135deg, var(--accent-pink) 0%, #ec4899 100%); color: white; padding: 0.25rem 0.75rem; border-radius: 100px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; display: inline-block; margin-bottom: 0.5rem; box-shadow: 0 4px 10px rgba(236,72,153,0.3);">
              ${plan.discount_percent}% OFF
            </span>
          `;
        }
        
        costHTML = `
          <div style="display: flex; flex-direction: column; align-items: flex-start;">
            ${badgeHTML}
            <del style="font-size: 1.2rem; color: var(--color-text-muted); text-decoration: line-through; margin-bottom: 0.25rem;">
              ${origPriceText}
            </del>
            <span class="amount" style="font-size: 2.2rem; color: var(--accent-cyan); font-weight: 800;">
              ${finalCostText}
            </span>
          </div>
        `;
      } else {
        const cleanPrice = formatPriceText(plan.cost);
        costHTML = `<span class="amount" style="font-size: 2.2rem; color: var(--accent-cyan); font-weight: 800;">${cleanPrice}</span>`;
        finalCostText = cleanPrice;
      }
      
      let actionButtonsHTML = "";
      if (checkoutEnabled) {
        actionButtonsHTML = `
          <button class="btn btn-primary proceed-checkout-btn" data-plan-title="${escapeHTML(plan.title)}" data-plan-cost="${escapeHTML(finalCostText)}" data-plan-desc="${escapeHTML(plan.description)}" style="width: 100%; margin-top: 1.5rem; border-radius: 8px;">
            Instant Checkout (50% Advance)
          </button>
          <button class="btn btn-secondary select-subplan-btn" data-plan-id="${planId}" data-plan-title="${escapeHTML(plan.title)}" style="width: 100%; margin-top: 0.5rem; border-radius: 8px; font-size: 0.85rem; padding: 0.5rem;">
            Or Estimate Custom Scope
          </button>
        `;
      } else {
        actionButtonsHTML = `
          <button class="btn btn-primary select-subplan-btn" data-plan-id="${planId}" data-plan-title="${escapeHTML(plan.title)}" style="width: 100%; margin-top: 2rem; border-radius: 8px;">
            Select Plan & Quote
          </button>
        `;
      }

      return `
        <div class="pricing-card" style="padding: 2.5rem 2rem;">
          <div class="pricing-header">
            <h3 style="font-size: 1.4rem; font-weight: 700; color: white; margin-bottom: 0.5rem;">${escapeHTML(plan.title)}</h3>
            ${generalText ? `<p style="font-size: 0.85rem; color: var(--color-text-secondary); margin-bottom: 1rem; line-height: 1.4;">${escapeHTML(generalText)}</p>` : ''}
            <div class="pricing-price" style="border: none; padding: 0; margin-bottom: 1.5rem;">
              ${costHTML}
            </div>
          </div>
          <ul class="pricing-features" style="border-top: 1px solid rgba(255,255,255,0.05); padding-top: 1.5rem; margin-top: 0;">
            ${parsedFeatures.map(f => {
              if (f.type === 'included') {
                return `<li class="feat-included" style="color: var(--color-text-secondary);">${escapeHTML(f.text)}</li>`;
              } else {
                return `<li class="feat-not-included" style="color: var(--color-text-muted); opacity: 0.65;">${escapeHTML(f.text)}</li>`;
              }
            }).join("")}
          </ul>
          ${actionButtonsHTML}
        </div>
      `;
    }).join("");

    // Bind sub-plan selection action buttons
    container.querySelectorAll(".select-subplan-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const planId = btn.getAttribute("data-plan-id");
        const planTitle = btn.getAttribute("data-plan-title");

        // Close explorer
        sessionStorage.removeItem("ascorix_active_view");
        document.body.classList.remove("category-explorer-mode");

        // Populate calculator
        const select = document.getElementById("calc-service-select");
        if (select) {
          select.value = planId;
          select.dispatchEvent(new Event("change"));
          updateCalculation();
        }

        // Scroll to calculator
        setTimeout(() => {
          document.getElementById("estimate").scrollIntoView({ behavior: "smooth" });
          showToastNotification(`Loaded ${planTitle} into scoping estimator.`);
        }, 300);
      });
    });

    // Bind instant checkout proceed buttons
    container.querySelectorAll(".proceed-checkout-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const planTitle = btn.getAttribute("data-plan-title");
        const planCost = btn.getAttribute("data-plan-cost");
        const planDesc = btn.getAttribute("data-plan-desc");

        // Close explorer
        sessionStorage.removeItem("ascorix_active_view");
        document.body.classList.remove("category-explorer-mode");

        // Open checkout page
        openCheckoutView(planTitle, planCost, planDesc);
      });
    });

  } catch (err) {
    console.error("Error opening category explorer:", err);
  }
}

// Open checkout page
export function openCheckoutView(planTitle, planCost, planDesc) {
  const checkoutView = document.getElementById("checkout-view");
  if (!checkoutView) return;

  // Set checkout plan details
  document.getElementById("checkout-plan-title").textContent = planTitle;
  document.getElementById("checkout-plan-desc").textContent = planDesc;

  // Calculate pricing subtotals
  const subtotal = parseCost(planCost);
  
  // Save active checkout details on window
  window.activeCheckout = {
    title: planTitle,
    cost: planCost,
    subtotal: subtotal,
    discount: 0,
    coupon: null
  };

  // Reset coupon form
  const couponInput = document.getElementById("checkout-coupon-input");
  const feedbackMsg = document.getElementById("coupon-feedback-msg");
  if (couponInput) couponInput.value = "";
  if (feedbackMsg) {
    feedbackMsg.textContent = "";
    feedbackMsg.style.color = "inherit";
  }
  document.getElementById("checkout-discount-row").style.display = "none";
  
  updateCheckoutPricingDisplay();

  // Enter checkout view routing state
  sessionStorage.setItem("ascorix_active_view", "checkout");
  sessionStorage.setItem("ascorix_checkout_plan", JSON.stringify({
    title: planTitle,
    cost: planCost,
    desc: planDesc
  }));
  document.body.classList.add("checkout-mode");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// Re-compute totals
export function updateCheckoutPricingDisplay() {
  const ac = window.activeCheckout;
  if (!ac) return;

  const netValue = ac.subtotal - ac.discount;
  const advanceDue = Math.round(netValue * 0.5);
  const balanceRemaining = netValue - advanceDue;

  const formatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  });

  document.getElementById("checkout-subtotal").textContent = formatter.format(ac.subtotal);
  document.getElementById("checkout-net-value").textContent = formatter.format(netValue);
  document.getElementById("checkout-advance-due").textContent = formatter.format(advanceDue);
  document.getElementById("checkout-balance-remaining").textContent = formatter.format(balanceRemaining);

  if (ac.discount > 0) {
    document.getElementById("applied-coupon-code").textContent = ac.coupon;
    document.getElementById("checkout-discount-row").querySelector("span:last-child").textContent = `-${formatter.format(ac.discount)}`;
    document.getElementById("checkout-discount-row").style.display = "flex";
  } else {
    document.getElementById("checkout-discount-row").style.display = "none";
  }
}

// Populates service dropdown for pricing calculator
export async function populateServiceCalculatorDropdown() {
  const select = document.getElementById("calc-service-select");
  if (!select) return;

  try {
    const services = await db.getServices();
    
    if (services.length === 0) {
      select.innerHTML = `<option value="">No Services Available</option>`;
      return;
    }

    select.innerHTML = services.map(service => {
      const id = service._id || service.id;
      return `<option value="${id}">${escapeHTML(service.title)}</option>`;
    }).join("");
  } catch (err) {
    select.innerHTML = `<option value="">Error Loading Options</option>`;
  }
}

// Custom simple parser to parse cost strings
export function parseCost(costStr) {
  if (!costStr) return 0;
  const numeric = parseInt(costStr.replace(/[^0-9]/g, ''), 10);
  if (isNaN(numeric)) return 4999;

  const lower = costStr.toLowerCase();
  if (lower.includes('/hr') || lower.includes('hour') || lower.includes('/hour')) {
    return numeric * 20;
  }
  return numeric;
}

// Update the real-time project cost estimator calculator
export async function updateCalculation() {
  const select = document.getElementById("calc-service-select");
  const scaleSelect = document.getElementById("project-scale");
  const display = document.getElementById("calc-result-display");
  
  if (!select || !scaleSelect || !display) return;
  
  const serviceId = select.value;
  if (!serviceId) {
    display.textContent = "₹0";
    return;
  }

  try {
    const services = await db.getServices();
    const selectedService = services.find(s => (s._id === serviceId || s.id === serviceId));
    
    if (!selectedService) {
      display.textContent = "₹0";
      return;
    }

    let basePrice = parseCost(selectedService.cost);
    if (selectedService.original_price > 0 && selectedService.discount_percent > 0) {
      basePrice = Math.round(selectedService.original_price * (1 - selectedService.discount_percent / 100));
    }
    const multiplier = parseFloat(scaleSelect.value) || 1;
    const calculated = Math.round(basePrice * multiplier);

    // Format currency nicely in INR
    const formatter = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    });

    let displayPrice = formatter.format(calculated);
    displayPrice = formatPriceText(displayPrice);
    if (selectedService.cost && selectedService.cost.toLowerCase().includes("/mo")) {
      // make sure it has /mo
      if (!displayPrice.toLowerCase().includes("/mo")) {
        displayPrice = displayPrice.replace(/\s*starting/gi, "/mo starting");
      }
    }
    display.textContent = displayPrice;
  } catch (err) {
    display.textContent = "₹0";
  }
}

// Helper to escape HTML and prevent injection attacks
function escapeHTML(str) {
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

// Toast notification helper (copied to avoid cross-module timing bugs)
function showToastNotification(message) {
  const toast = document.createElement("div");
  toast.style.position = "fixed";
  toast.style.bottom = "2rem";
  toast.style.right = "2rem";
  toast.style.background = "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)";
  toast.style.color = "#fff";
  toast.style.padding = "1rem 2rem";
  toast.style.borderRadius = "8px";
  toast.style.boxShadow = "0 8px 30px rgba(16, 185, 129, 0.4)";
  toast.style.fontWeight = "600";
  toast.style.zIndex = "3000";
  toast.style.opacity = "0";
  toast.style.transform = "translateY(20px)";
  toast.style.transition = "all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)";
  toast.textContent = message;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";
  }, 100);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(20px)";
    setTimeout(() => {
      toast.remove();
    }, 400);
  }, 4000);
}

// Initialize listeners
export async function initServices() {
  await renderServices();
  await populateServiceCalculatorDropdown();
  
  const select = document.getElementById("calc-service-select");
  const scaleSelect = document.getElementById("project-scale");
  
  if (select) select.addEventListener("change", updateCalculation);
  if (scaleSelect) scaleSelect.addEventListener("change", updateCalculation);

  // Bind explorer back button
  const closeExplorerBtn = document.getElementById("close-explorer-btn");
  if (closeExplorerBtn) {
    closeExplorerBtn.addEventListener("click", () => {
      sessionStorage.removeItem("ascorix_active_view");
      document.body.classList.remove("category-explorer-mode");
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  // Re-render when db broadcasts updates
  window.addEventListener("ascorix_services_updated", async () => {
    await renderServices();
    await populateServiceCalculatorDropdown();
    await updateCalculation();
  });
  
  await updateCalculation();
}
