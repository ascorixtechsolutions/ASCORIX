// app.js - ASCORIX TECH SOLUTIONS Main Orchestrator & Particle Canvas
import { initServices, updateCalculation, openCategoryExplorer, openCheckoutView } from './services.js';
import { initPortfolio } from './portfolio.js';
import { db } from './db.js';

document.addEventListener("DOMContentLoaded", async () => {
  window.showToastNotification = showToastNotification;
  // 1. Initialize Sub-modules
  await initServices();
  await initPortfolio();

  // 2. Setup Canvas Particles Telemetry
  setupParticleCanvas();

  // 3. Header Scroll Styling
  const header = document.querySelector("header");
  window.addEventListener("scroll", () => {
    if (window.scrollY > 50) {
      header.classList.add("scrolled");
    } else {
      header.classList.remove("scrolled");
    }
    highlightNavLink();
  });

  // 4. Smooth Scrolling Active Navigation Link Highlighting
  const navLinks = document.querySelectorAll(".nav-link");
  const sections = document.querySelectorAll("main#client-view section");

  function highlightNavLink() {
    let currentSectionId = "hero";
    sections.forEach(section => {
      const sectionTop = section.offsetTop;
      if (window.scrollY >= sectionTop - 150) {
        currentSectionId = section.getAttribute("id");
      }
    });

    navLinks.forEach(link => {
      link.classList.remove("active");
      if (link.getAttribute("href") === `#${currentSectionId}`) {
        link.classList.add("active");
      }
    });
  }

  // Initial check for scroll styling and active link on page load/reload
  if (window.scrollY > 50) {
    header.classList.add("scrolled");
  }
  highlightNavLink();

  // Handle navigation link clicks when in dashboard, checkout, or explorer modes
  const handleNavClick = (e) => {
    const targetId = e.currentTarget.getAttribute("href");
    if (targetId && targetId.startsWith("#")) {
      const isDashboard = document.body.classList.contains("client-dashboard-mode");
      const isCheckout = document.body.classList.contains("checkout-mode");
      const isExplorer = document.body.classList.contains("category-explorer-mode");
      
      if (isDashboard || isCheckout || isExplorer) {
        e.preventDefault();
        
        if (isDashboard) exitClientDashboard();
        if (isCheckout) {
          document.body.classList.remove("checkout-mode");
          sessionStorage.removeItem("ascorix_active_view");
        }
        if (isExplorer) {
          document.body.classList.remove("category-explorer-mode");
          sessionStorage.removeItem("ascorix_active_view");
        }
        
        const targetEl = document.querySelector(targetId);
        if (targetEl) {
          setTimeout(() => {
            targetEl.scrollIntoView({ behavior: "smooth" });
          }, 50);
        }
      }
    }
  };

  navLinks.forEach(link => {
    link.addEventListener("click", handleNavClick);
  });

  const logoBtn = document.getElementById("nav-logo");
  if (logoBtn) {
    logoBtn.addEventListener("click", () => {
      const isDashboard = document.body.classList.contains("client-dashboard-mode");
      const isCheckout = document.body.classList.contains("checkout-mode");
      const isExplorer = document.body.classList.contains("category-explorer-mode");
      
      if (isDashboard || isCheckout || isExplorer) {
        if (isDashboard) exitClientDashboard();
        if (isCheckout) {
          document.body.classList.remove("checkout-mode");
          sessionStorage.removeItem("ascorix_active_view");
        }
        if (isExplorer) {
          document.body.classList.remove("category-explorer-mode");
          sessionStorage.removeItem("ascorix_active_view");
        }
      }
      
      const targetEl = document.getElementById("hero");
      if (targetEl) {
        setTimeout(() => {
          targetEl.scrollIntoView({ behavior: "smooth" });
        }, 50);
      }
    });
  }

  // Hamburger Dropdown Toggle (Universal for all viewports)
  const menuToggle = document.getElementById("menu-toggle-btn");
  const nav = document.getElementById("client-nav");

  function closeMenu() {
    if (nav) {
      nav.classList.remove("active");
    }
  }

  if (menuToggle && nav) {
    menuToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      nav.classList.toggle("active");
    });

    // Auto-close menu when navigation items or buttons are clicked inside nav menu
    nav.addEventListener("click", (e) => {
      // If clicking the categories dropdown toggle, just toggle the dropdown open/close state
      const isDropdownToggle = e.target.closest("#categories-nav-link");
      if (isDropdownToggle) {
        e.preventDefault();
        const dropdownContainer = isDropdownToggle.closest(".nav-dropdown");
        if (dropdownContainer) {
          dropdownContainer.classList.toggle("active");
          const arrow = isDropdownToggle.querySelector(".dropdown-arrow");
          if (arrow) {
            if (dropdownContainer.classList.contains("active")) {
              arrow.style.transform = "rotate(180deg)";
            } else {
              arrow.style.transform = "";
            }
          }
        }
        return; // Don't close main hamburger menu
      }

      if (e.target.closest("a") || e.target.closest("button")) {
        closeMenu();
        // Reset active state of nested categories dropdown if we navigated away
        const dropdownContainer = nav.querySelector(".nav-dropdown");
        if (dropdownContainer) {
          dropdownContainer.classList.remove("active");
          const arrow = dropdownContainer.querySelector(".dropdown-arrow");
          if (arrow) arrow.style.transform = "";
        }
      }
    });

    // Close menu when clicking outside
    document.addEventListener("click", (e) => {
      if (!nav.contains(e.target) && !menuToggle.contains(e.target)) {
        closeMenu();
      }
    });
  }
  // 5. Get Started CTA scrolling
  const contactBtn = document.getElementById("contact-btn");
  if (contactBtn) {
    contactBtn.addEventListener("click", () => {
      document.getElementById("estimate").scrollIntoView({ behavior: "smooth" });
    });
  }

  // Password Visibility Toggle Handler
  document.querySelectorAll(".toggle-password-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-target");
      const input = document.getElementById(targetId);
      if (!input) return;
      
      const eyeIcon = btn.querySelector(".eye-icon");
      const eyeOffIcon = btn.querySelector(".eye-off-icon");
      
      if (input.type === "password") {
        input.type = "text";
        if (eyeIcon) eyeIcon.style.display = "none";
        if (eyeOffIcon) eyeOffIcon.style.display = "block";
      } else {
        input.type = "password";
        if (eyeIcon) eyeIcon.style.display = "block";
        if (eyeOffIcon) eyeOffIcon.style.display = "none";
      }
    });
  });

  // ==========================================
  // AUTHENTICATION MODAL AND TABS HANDLERS
  // ==========================================

  const authPortalBtn = document.getElementById("auth-portal-btn");
  const loginModal = document.getElementById("login-modal");
  const closeLogin = document.getElementById("close-login-btn");
  
  // Forms
  const loginForm = document.getElementById("auth-login-form");
  const registerForm = document.getElementById("auth-register-form");
  
  // Tabs
  const tabLoginBtn = document.getElementById("auth-tab-login");
  const tabRegisterBtn = document.getElementById("auth-tab-register");
  
  // Errors
  const loginErrorMsg = document.getElementById("login-error-msg");
  const regErrorMsg = document.getElementById("reg-error-msg");

  if (authPortalBtn && loginModal && closeLogin) {
    // Open Auth Modal
    authPortalBtn.addEventListener("click", () => {
      loginModal.classList.add("active");
      showAuthTab("login");
      loginErrorMsg.style.display = "none";
      regErrorMsg.style.display = "none";
      loginForm.reset();
      registerForm.reset();
    });

    // Close Auth Modal
    closeBtnHandler(closeLogin, loginModal);

    // Tab Selection
    tabLoginBtn.addEventListener("click", () => showAuthTab("login"));
    tabRegisterBtn.addEventListener("click", () => {
      showAuthTab("register");
    });

    // Login Submit
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      loginErrorMsg.style.display = "none";
      
      const email = document.getElementById("login-email").value;
      const password = document.getElementById("login-password").value;

      try {
        const result = await db.login(email, password);
        handleAuthSuccess(result.user);
      } catch (err) {
        loginErrorMsg.textContent = err.message || "Invalid credentials.";
        loginErrorMsg.style.display = "block";
      }
    });

    let regEmail = "";
    let regPassword = "";
    let resendTimer = null;

    function startResendCountdown() {
      const btn = document.getElementById("resend-otp-btn");
      const countdown = document.getElementById("resend-countdown");
      if (!btn || !countdown) return;

      let seconds = 60;
      btn.disabled = true;
      btn.style.cursor = "not-allowed";
      btn.style.opacity = "0.5";
      countdown.textContent = `(${seconds}s)`;

      if (resendTimer) clearInterval(resendTimer);
      
      resendTimer = setInterval(() => {
        seconds--;
        if (seconds <= 0) {
          clearInterval(resendTimer);
          btn.disabled = false;
          btn.style.cursor = "pointer";
          btn.style.opacity = "1";
          countdown.textContent = "";
        } else {
          countdown.textContent = `(${seconds}s)`;
        }
      }, 1000);
    }

    // Register Submit
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      regErrorMsg.style.display = "none";

      const name = document.getElementById("reg-name").value.trim();
      const email = document.getElementById("reg-email").value.trim();
      const phone = document.getElementById("reg-phone").value.trim();
      const password = document.getElementById("reg-password").value;

      if (!phone) {
        regErrorMsg.textContent = "Mobile Number is required.";
        regErrorMsg.style.display = "block";
        return;
      }

      try {
        const result = await db.register(name, email, password, phone);
        
        regEmail = email;
        regPassword = password;
        
        // Hide registration modal, open verification modal
        loginModal.classList.remove("active");
        
        const verifyModal = document.getElementById("verify-otp-modal");
        const recipientSpan = document.getElementById("verify-email-recipient");
        if (recipientSpan) recipientSpan.textContent = email;
        if (verifyModal) verifyModal.classList.add("active");
        
        // Clear old messages and inputs
        document.getElementById("verify-error-msg").style.display = "none";
        document.getElementById("verify-success-msg").style.display = "none";
        document.querySelectorAll(".otp-box").forEach(input => input.value = "");
        
        // Focus first box
        const firstBox = document.querySelector(".otp-box");
        if (firstBox) firstBox.focus();

        startResendCountdown();
        showToastNotification("Registration completed! Verification OTP dispatched.");
      } catch (err) {
        regErrorMsg.textContent = err.message || "Registration failed.";
        regErrorMsg.style.display = "block";
      }
    });

    // Verification Modal Handlers
    const verifyOtpModal = document.getElementById("verify-otp-modal");
    const closeVerifyBtn = document.getElementById("close-verify-otp-btn");
    if (closeVerifyBtn && verifyOtpModal) {
      closeVerifyBtn.addEventListener("click", () => {
        verifyOtpModal.classList.remove("active");
        if (resendTimer) clearInterval(resendTimer);
      });
    }

    // OTP Input Navigation and Pasting
    const otpBoxes = document.querySelectorAll(".otp-box");
    otpBoxes.forEach((box, index) => {
      box.addEventListener("input", (e) => {
        const value = e.target.value;
        if (value.length === 1 && index < otpBoxes.length - 1) {
          otpBoxes[index + 1].focus();
        }
      });

      box.addEventListener("keydown", (e) => {
        if (e.key === "Backspace" && box.value === "" && index > 0) {
          otpBoxes[index - 1].focus();
        }
      });

      box.addEventListener("paste", (e) => {
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData).getData("text").trim();
        if (text.length === 6 && /^\d+$/.test(text)) {
          otpBoxes.forEach((b, idx) => b.value = text[idx]);
          otpBoxes[5].focus();
        }
      });
    });

    // Confirm verification submit handler
    const confirmVerifyBtn = document.getElementById("confirm-verify-btn");
    if (confirmVerifyBtn) {
      confirmVerifyBtn.addEventListener("click", async () => {
        const errorMsg = document.getElementById("verify-error-msg");
        const successMsg = document.getElementById("verify-success-msg");
        errorMsg.style.display = "none";
        successMsg.style.display = "none";

        let code = "";
        otpBoxes.forEach(box => code += box.value.trim());

        if (code.length !== 6 || !/^\d+$/.test(code)) {
          errorMsg.textContent = "Please enter a valid 6-digit code.";
          errorMsg.style.display = "block";
          return;
        }

        // Set Loading state
        confirmVerifyBtn.disabled = true;
        confirmVerifyBtn.textContent = "Verifying code...";

        try {
          const res = await db.verifyOTP(regEmail, code);
          successMsg.textContent = res.message;
          successMsg.style.display = "block";

          // Auto-login
          const loginResult = await db.login(regEmail, regPassword);
          
          setTimeout(() => {
            if (verifyOtpModal) verifyOtpModal.classList.remove("active");
            if (resendTimer) clearInterval(resendTimer);
            handleAuthSuccess(loginResult.user);
          }, 1500);

        } catch (err) {
          errorMsg.textContent = err.message || "Verification failed.";
          errorMsg.style.display = "block";
        } finally {
          confirmVerifyBtn.disabled = false;
          confirmVerifyBtn.textContent = "Verify Account";
        }
      });
    }

    // Resend OTP Button Handler
    const resendBtn = document.getElementById("resend-otp-btn");
    if (resendBtn) {
      resendBtn.addEventListener("click", async () => {
        const errorMsg = document.getElementById("verify-error-msg");
        errorMsg.style.display = "none";
        resendBtn.disabled = true;

        try {
          const res = await db.resendOTP(regEmail);
          showToastNotification(res.message || "A new code has been dispatched.");
          startResendCountdown();
        } catch (err) {
          errorMsg.textContent = err.message || "Failed to resend code.";
          errorMsg.style.display = "block";
          resendBtn.disabled = false;
        }
      });
    }
  }

  // Handle post-login / post-registration redirects
  async function handleAuthSuccess(user) {
    loginModal.classList.remove("active");
    
    // Hide auth banner in the modal
    const banner = document.getElementById("auth-product-banner");
    if (banner) banner.style.display = "none";
    
    if (window.pendingSelectedCategory) {
      const selectedCat = window.pendingSelectedCategory;
      showToastNotification(`Welcome, ${user.name}! Opening ${selectedCat} plans catalog.`);
      
      // Make sure we are on client view, not dashboard view
      exitClientDashboard();
      
      // Open Category Explorer
      await openCategoryExplorer(selectedCat);
      
      // Clear pending
      window.pendingSelectedCategory = null;
    } else if (window.pendingSelectedService) {
      const selected = window.pendingSelectedService;
      showToastNotification(`Welcome, ${user.name}! Unlocking offer for ${selected.title}.`);
      
      // Make sure we are on client view, not dashboard view
      exitClientDashboard();
      
      // Configure estimator dropdown
      const select = document.getElementById("calc-service-select");
      if (select) {
        select.value = selected.id;
        // Trigger dropdown calculation
        select.dispatchEvent(new Event("change"));
        updateCalculation();
      }
      
      // Scroll to calculator
      const estimateSec = document.getElementById("estimate");
      if (estimateSec) {
        setTimeout(() => {
          estimateSec.scrollIntoView({ behavior: "smooth" });
        }, 300);
      }
      
      // Clear pending
      window.pendingSelectedService = null;
    } else {
      showToastNotification(`Welcome back, ${user.name}!`);
      if (user.role === 'admin') {
        window.open("/admin", "_blank");
      } else {
        showClientDashboard();
      }
    }
  }

  function closeBtnHandler(btn, modal) {
    btn.addEventListener("click", () => {
      modal.classList.remove("active");
      const banner = document.getElementById("auth-product-banner");
      if (banner) banner.style.display = "none";
      window.pendingSelectedService = null;
      window.pendingSelectedCategory = null;
    });
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.classList.remove("active");
        const banner = document.getElementById("auth-product-banner");
        if (banner) banner.style.display = "none";
        window.pendingSelectedService = null;
        window.pendingSelectedCategory = null;
      }
    });
  }

  function showAuthTab(tab) {
    if (tab === "login") {
      tabLoginBtn.classList.add("active");
      tabRegisterBtn.classList.remove("active");
      loginForm.style.display = "block";
      registerForm.style.display = "none";
      document.getElementById("auth-modal-title").textContent = "Authorized Sign In";
    } else {
      tabLoginBtn.classList.remove("active");
      tabRegisterBtn.classList.add("active");
      loginForm.style.display = "none";
      registerForm.style.display = "block";
      document.getElementById("auth-modal-title").textContent = "Account Registration";
    }
  }

  // ==========================================
  // CLIENT PORTAL DASHBOARD ORCHESTRATION
  // ==========================================

  const clientDashboardBtn = document.getElementById("client-dashboard-btn");
  const closeDashboardBtn = document.getElementById("close-dashboard-btn");

  if (clientDashboardBtn) {
    clientDashboardBtn.addEventListener("click", () => {
      showClientDashboard();
    });
  }
  if (closeDashboardBtn) {
    closeDashboardBtn.addEventListener("click", () => {
      exitClientDashboard();
    });
  }

  async function showClientDashboard() {
    const user = db.getCurrentUser();
    if (!user) return;

    sessionStorage.setItem("ascorix_active_view", "dashboard");
    document.body.classList.add("client-dashboard-mode");
    const userProfileName = document.getElementById("user-profile-name");
    if (userProfileName) userProfileName.textContent = user.name;

    // Populate User Profile Header Card
    const dashName = document.getElementById("dash-user-name");
    const dashEmail = document.getElementById("dash-user-email");
    const dashPhone = document.getElementById("dash-user-phone");
    const dashAvatar = document.getElementById("dash-avatar-text");
    const dashStatus = document.getElementById("dash-user-status");

    if (dashName) dashName.textContent = user.name || "Client Account";
    if (dashEmail) dashEmail.textContent = user.email || "—";
    if (dashPhone) dashPhone.textContent = user.phone || "—";
    if (dashAvatar) dashAvatar.textContent = (user.name || "U").charAt(0).toUpperCase();
    if (dashStatus) {
      dashStatus.textContent = user.is_verified === false ? "⚠️ Verification Pending" : "✓ Verified Client Account";
    }

    window.scrollTo({ top: 0, behavior: "smooth" });

    // Render Inquiries List
    await renderClientInquiries();
  }

  function exitClientDashboard() {
    sessionStorage.removeItem("ascorix_active_view");
    document.body.classList.remove("client-dashboard-mode");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function renderClientInquiries() {
    const container = document.getElementById("client-inquiries-list");
    if (!container) return;

    container.innerHTML = `<div style="text-align: center; padding: 2rem; color: var(--color-text-secondary);">Syncing database records...</div>`;

    try {
      const inquiries = await db.getInquiries();
      
      if (inquiries.length === 0) {
        container.innerHTML = `
          <div style="text-align: center; padding: 3rem; border: 1px dashed var(--glass-border); border-radius: 8px; color: var(--color-text-muted);">
            You have not submitted any consultation inquiries yet. Use our Scope Calculator below to send your first request!
          </div>
        `;
        return;
      }

      container.innerHTML = inquiries.map(inq => {
        const formattedDate = new Date(inq.date).toLocaleString('en-IN', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
        const status = inq.status || 'Pending';
        const badgeClass = status.toLowerCase().replace(" ", "-");

        return `
          <div class="inbox-item" style="margin-bottom: 1rem;">
            <div style="flex-grow: 1;">
              <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                <h4 style="font-size: 1.1rem; color: white; margin: 0;">
                  ${escapeHTML(inq.service)}
                </h4>
                <span class="status-badge ${badgeClass}">${status}</span>
              </div>
              <p class="inbox-body" style="margin-top: 0.5rem; font-size: 0.9rem;">
                ${escapeHTML(inq.message || "No project specifics detailed.")}
              </p>
              <div style="margin-top: 0.75rem; font-size: 0.8rem; color: var(--color-text-muted);">
                Submitted: ${formattedDate}
              </div>
            </div>
          </div>
        `;
      }).join("");
    } catch (err) {
      container.innerHTML = `
        <div style="text-align: center; padding: 3rem; color: var(--accent-danger);">
          Failed to fetch inquiry history: ${err.message}
        </div>
      `;
    }
  }

  // ==========================================
  // SIGN OUT & SESSION MANAGEMENT
  // ==========================================

  const signOutBtn = document.getElementById("user-signout-btn");
  if (signOutBtn) {
    signOutBtn.addEventListener("click", () => {
      db.logout();
      showToastNotification("Logged out successfully.");
      exitClientDashboard();
    });
  }

  // Listen to Auth State Events
  window.addEventListener("ascorix_auth_state_changed", () => {
    syncAuthUI();
  });

  // ==========================================
  // SESSION HEARTBEAT - Detect account deletion
  // Polls /api/auth/me every 30 seconds.
  // If the account no longer exists on the server
  // (deleted by admin), verifySession() will call
  // logout() which fires ascorix_auth_state_changed
  // and syncAuthUI() will restore the Sign In button.
  // ==========================================
  let _sessionHeartbeatInterval = null;

  function startSessionHeartbeat() {
    if (_sessionHeartbeatInterval) return; // already running
    _sessionHeartbeatInterval = setInterval(async () => {
      const hadUser = !!db.getCurrentUser();
      if (!hadUser) return; // not logged in, nothing to check

      const stillValid = await db.verifySession();

      // If we had a user before but verifySession returned null,
      // the account was deleted / session invalidated by admin.
      if (hadUser && !stillValid) {
        // Exit any active views
        exitClientDashboard();
        document.body.classList.remove("checkout-mode", "category-explorer-mode");
        sessionStorage.removeItem("ascorix_active_view");
        sessionStorage.removeItem("ascorix_explorer_category");
        sessionStorage.removeItem("ascorix_checkout_plan");

        showToastNotification("Your session has been terminated. Please sign in again.");
        stopSessionHeartbeat();
      }
    }, 30000); // every 30 seconds
  }

  function stopSessionHeartbeat() {
    if (_sessionHeartbeatInterval) {
      clearInterval(_sessionHeartbeatInterval);
      _sessionHeartbeatInterval = null;
    }
  }

  // Start/stop heartbeat based on auth state
  window.addEventListener("ascorix_auth_state_changed", () => {
    if (db.getCurrentUser()) {
      startSessionHeartbeat();
    } else {
      stopSessionHeartbeat();
    }
  });

  function syncAuthUI() {
    const user = db.getCurrentUser();
    const authBtn = document.getElementById("auth-portal-btn");
    const profileMenu = document.getElementById("user-profile-menu");
    const profileName = document.getElementById("user-profile-name");

    if (user) {
      if (authBtn) authBtn.style.display = "none";
      if (profileMenu) profileMenu.style.display = "flex";
      if (profileName) profileName.textContent = user.name;
      
      const dashboardBtn = document.getElementById("client-dashboard-btn");
      if (dashboardBtn) {
        dashboardBtn.textContent = "Dashboard";
        dashboardBtn.onclick = () => showClientDashboard();
      }
    } else {
      if (authBtn) authBtn.style.display = "block";
      if (profileMenu) profileMenu.style.display = "none";
      
      // Clean up body states
      document.body.classList.remove("client-dashboard-mode");
    }
  }

  // Trigger initial UI sync
  syncAuthUI();

  // Validate active token on database load
  await db.verifySession();

  // Start heartbeat if user is logged in after initial session check
  if (db.getCurrentUser()) {
    startSessionHeartbeat();
  }

  // Restore active view state if authenticated
  const activeView = sessionStorage.getItem("ascorix_active_view");
  const currentUser = db.getCurrentUser();
  if (currentUser) {
    if (activeView === "dashboard") {
      await showClientDashboard();
    } else if (activeView === "explorer") {
      const savedCategory = sessionStorage.getItem("ascorix_explorer_category");
      if (savedCategory) {
        await openCategoryExplorer(savedCategory);
      }
    } else if (activeView === "checkout") {
      const savedPlanStr = sessionStorage.getItem("ascorix_checkout_plan");
      if (savedPlanStr) {
        try {
          const plan = JSON.parse(savedPlanStr);
          openCheckoutView(plan.title, plan.cost, plan.desc);
        } catch (e) {
          console.error("Failed to parse saved checkout plan:", e);
        }
      }
    }
  } else {
    sessionStorage.removeItem("ascorix_active_view");
    sessionStorage.removeItem("ascorix_explorer_category");
    sessionStorage.removeItem("ascorix_checkout_plan");
    document.body.classList.remove("client-dashboard-mode", "checkout-mode", "category-explorer-mode");
  }

  // ==========================================
  // PRICING SECTION - PLAN SELECTION
  // ==========================================

  const selectPlanBtns = document.querySelectorAll(".select-package-btn");
  selectPlanBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const selectIndex = btn.getAttribute("data-package-index");
      const serviceSelect = document.getElementById("calc-service-select");
      
      if (serviceSelect && serviceSelect.options.length > selectIndex) {
        serviceSelect.selectedIndex = selectIndex;
        // Trigger select change handler manually
        serviceSelect.dispatchEvent(new Event("change"));
        updateCalculation();
        
        // Scroll to calculator
        document.getElementById("estimate").scrollIntoView({ behavior: "smooth" });
        showToastNotification("Selected package loaded into scope estimator!");
      }
    });
  });

  // Brand logo home click
  const logo = document.getElementById("nav-logo");
  if (logo) {
    logo.addEventListener("click", () => {
      exitClientDashboard();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  // ==========================================
  // CLIENT INQUIRY FORM SUBMISSION
  // ==========================================

  const inquiryForm = document.getElementById("inquiry-form");
  if (inquiryForm) {
    inquiryForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const name = document.getElementById("client-name").value;
      const email = document.getElementById("client-email").value;
      const serviceSelect = document.getElementById("calc-service-select");
      const service = serviceSelect.options[serviceSelect.selectedIndex].text.split(" (")[0];
      const phone = document.getElementById("client-phone").value;
      const businessName = document.getElementById("client-biz-name").value;
      const businessType = document.getElementById("client-biz-type").value;
      const contactMethod = document.getElementById("client-contact-method").value;
      const message = document.getElementById("client-msg").value;

      const inquiryData = { 
        name, 
        email, 
        service, 
        message, 
        phone, 
        businessName, 
        businessType, 
        contactMethod 
      };

      try {
        // Commit inquiry
        await db.addInquiry(inquiryData);

        // Reset form
        inquiryForm.reset();
        
        // Update calculator display to default
        const display = document.getElementById("calc-result-display");
        if (display) display.textContent = "₹0";

        // Premium success notification overlay
        showToastNotification(`System Synchronized! Inquiry from ${name} logged.`);

        // Reload dashboard inquiries in case they are logged in
        if (db.getCurrentUser()) {
          await renderClientInquiries();
        }
      } catch (err) {
        showToastNotification(`Failed to submit request: ${err.message}`);
      }
    });
  }
  // SECURE CHECKOUT PAGE LOGIC & BINDINGS
  // ==========================================

  const closeCheckoutBtn = document.getElementById("close-checkout-btn");
  if (closeCheckoutBtn) {
    closeCheckoutBtn.addEventListener("click", () => {
      sessionStorage.removeItem("ascorix_active_view");
      document.body.classList.remove("checkout-mode");
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  const applyCouponBtn = document.getElementById("apply-coupon-btn");
  if (applyCouponBtn) {
    applyCouponBtn.addEventListener("click", async () => {
      const couponInput = document.getElementById("checkout-coupon-input");
      const feedbackMsg = document.getElementById("coupon-feedback-msg");
      if (!couponInput || !feedbackMsg) return;

      const code = couponInput.value.trim();
      if (!code) {
        feedbackMsg.textContent = "Please enter a coupon code.";
        feedbackMsg.style.color = "var(--accent-danger)";
        return;
      }

      feedbackMsg.textContent = "Verifying code...";
      feedbackMsg.style.color = "var(--color-text-secondary)";

      try {
        const result = await db.validateOfferCode(code);
        const ac = window.activeCheckout;
        if (ac) {
          const discountAmt = Math.round(ac.subtotal * (result.discount / 100));
          ac.discount = discountAmt;
          ac.coupon = result.code;
          
          // Import dynamic update function
          const { updateCheckoutPricingDisplay } = await import('./services.js');
          updateCheckoutPricingDisplay();

          feedbackMsg.textContent = `Promo applied! ${result.discount}% off net scoped value.`;
          feedbackMsg.style.color = "var(--accent-success)";
        }
      } catch (err) {
        feedbackMsg.textContent = err.message || "Invalid or inactive promo code.";
        feedbackMsg.style.color = "var(--accent-danger)";
      }
    });
  }

  const checkoutPaymentForm = document.getElementById("checkout-payment-form");
  if (checkoutPaymentForm) {
    checkoutPaymentForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const ac = window.activeCheckout;
      if (!ac) return;

      const cardholder = document.getElementById("cardholder-name").value;
      
      const netValue = ac.subtotal - ac.discount;
      const advanceDue = Math.round(netValue * 0.5);

      // Create an automatic Client Inquiry/Project record matching this checkout!
      const user = db.getCurrentUser();
      const clientEmail = user ? user.email : "guest@checkout.ascorix.com";
      const clientName = user ? user.name : cardholder;

      const inquiryData = {
        name: clientName,
        email: clientEmail,
        service: ac.title,
        message: `[Instant Checkout Paid] Milestone advance of ₹${advanceDue.toLocaleString('en-IN')} paid by ${cardholder}. Promo applied: ${ac.coupon || 'None'}.`
      };

      try {
        // Log to DB
        await db.addInquiry(inquiryData);

        // Success Toast Notification
        showToastNotification(`Kickoff Successful! Authorized ₹${advanceDue.toLocaleString('en-IN')} milestone payment.`);

        // Reset and redirect
        checkoutPaymentForm.reset();
        sessionStorage.removeItem("ascorix_active_view");
        document.body.classList.remove("checkout-mode");
        
        if (user) {
          // Open dashboard to track their project
          setTimeout(async () => {
            const dashboardBtn = document.getElementById("client-dashboard-btn");
            if (dashboardBtn) {
              dashboardBtn.click();
            } else {
              // Fallback routing trigger
              document.body.classList.add("client-dashboard-mode");
              document.getElementById("user-profile-name").textContent = user.name;
              window.scrollTo({ top: 0, behavior: "smooth" });
              await renderClientInquiries();
            }
          }, 500);
        } else {
          // Scroll to estimate / hero
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      } catch (err) {
        showToastNotification(`Failed to record checkout: ${err.message}`);
      }
    });
  }
});

// Toast notification helper
function showToastNotification(message) {
  const toast = document.createElement("div");
  toast.style.position = "fixed";
  toast.style.bottom = "1.5rem";
  toast.style.right = "1.5rem";
  toast.style.left = "1.5rem"; // prevents overflow on mobile
  toast.style.maxWidth = "420px";
  toast.style.marginLeft = "auto"; // keeps it right-aligned on desktop
  toast.style.background = "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)";
  toast.style.color = "#fff";
  toast.style.padding = "1rem 1.5rem";
  toast.style.borderRadius = "8px";
  toast.style.boxShadow = "0 8px 30px rgba(16, 185, 129, 0.4)";
  toast.style.fontWeight = "600";
  toast.style.fontSize = "0.9rem";
  toast.style.lineHeight = "1.4";
  toast.style.zIndex = "3000";
  toast.style.opacity = "0";
  toast.style.transform = "translateY(20px)";
  toast.style.transition = "all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)";
  toast.style.wordBreak = "break-word";
  toast.textContent = message;

  document.body.appendChild(toast);

  // Trigger animation
  setTimeout(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";
  }, 100);

  // Fade out
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(20px)";
    setTimeout(() => {
      toast.remove();
    }, 400);
  }, 4000);
}

// ==========================================
// CANVA PARTICLES TELEMETRY ORBIT MECHANICS
// ==========================================

function setupParticleCanvas() {
  const canvas = document.getElementById("bg-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  let width = (canvas.width = window.innerWidth);
  let height = (canvas.height = window.innerHeight);

  const particles = [];
  const particleCount = Math.min(60, Math.floor((width * height) / 18000));
  const connectionDistance = 110;
  
  // Mouse position tracker
  const mouse = { x: null, y: null, radius: 150 };
  window.addEventListener("mousemove", (e) => {
    mouse.x = e.x;
    mouse.y = e.y;
  });
  window.addEventListener("mouseout", () => {
    mouse.x = null;
    mouse.y = null;
  });

  class Particle {
    constructor() {
      this.x = Math.random() * width;
      this.y = Math.random() * height;
      this.vx = (Math.random() - 0.5) * 0.4;
      this.vy = (Math.random() - 0.5) * 0.4;
      this.radius = Math.random() * 2 + 1;
      this.color = Math.random() > 0.5 ? "rgba(6, 182, 212, 0.4)" : "rgba(139, 92, 246, 0.4)";
    }

    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.fill();
    }

    update() {
      // Bounce boundary check
      if (this.x < 0 || this.x > width) this.vx *= -1;
      if (this.y < 0 || this.y > height) this.vy *= -1;

      this.x += this.vx;
      this.y += this.vy;

      // Mouse repulsion/interaction
      if (mouse.x !== null && mouse.y !== null) {
        const dx = this.x - mouse.x;
        const dy = this.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < mouse.radius) {
          const force = (mouse.radius - dist) / mouse.radius;
          const angle = Math.atan2(dy, dx);
          this.x += Math.cos(angle) * force * 1.5;
          this.y += Math.sin(angle) * force * 1.5;
        }
      }
    }
  }

  // Populate particles
  for (let i = 0; i < particleCount; i++) {
    particles.push(new Particle());
  }

  function animate() {
    // Pause when tab is hidden
    if (document.hidden) return;

    ctx.clearRect(0, 0, width, height);

    // Draw connecting mesh lines
    for (let i = 0; i < particles.length; i++) {
      particles[i].update();
      particles[i].draw();

      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < connectionDistance) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          const alpha = (1 - dist / connectionDistance) * 0.12;
          ctx.strokeStyle = `rgba(139, 92, 246, ${alpha})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }

    requestAnimationFrame(animate);
  }

  animate();

  // Pause animation when tab is hidden to save CPU
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      animate();
    }
  });

  // Resize handler
  window.addEventListener("resize", () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });
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
