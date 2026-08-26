// db.js - ASCORIX TECH SOLUTIONS Server API Connector & Auth Layer

// Retrieve auth headers automatically if token exists
function getHeaders(extraHeaders = {}) {
  const token = localStorage.getItem("ascorix_token");
  const headers = {
    "Content-Type": "application/json",
    ...extraHeaders
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

// Global API fetch wrapper with clean error logging
async function apiRequest(url, method = "GET", body = null) {
  try {
    const options = {
      method,
      headers: getHeaders()
    };
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(url, options);
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || `HTTP error! Status: ${response.status}`);
    }
    return result;
  } catch (err) {
    console.error(`API REQUEST ERROR [${method} ${url}]:`, err.message);
    throw err;
  }
}

export const db = {
  // ==========================================
  // AUTHENTICATION MANAGEMENT
  // ==========================================

  async register(name, email, password, phone, role = 'client') {
    const result = await apiRequest("/api/auth/register", "POST", { name, email, password, phone, role });
    if (result.token) {
      localStorage.setItem("ascorix_token", result.token);
      localStorage.setItem("ascorix_user", JSON.stringify(result.user));
      window.dispatchEvent(new CustomEvent("ascorix_auth_state_changed"));
    }
    return result;
  },

  async verifyOTP(email, otp) {
    return apiRequest("/api/auth/verify-otp", "POST", { email, otp });
  },

  async resendOTP(email) {
    return apiRequest("/api/auth/resend-otp", "POST", { email });
  },

  async login(email, password) {
    const result = await apiRequest("/api/auth/login", "POST", { email, password });
    if (result.token) {
      localStorage.setItem("ascorix_token", result.token);
      localStorage.setItem("ascorix_user", JSON.stringify(result.user));
      window.dispatchEvent(new CustomEvent("ascorix_auth_state_changed"));
    }
    return result;
  },

  async adminLogin(email, password) {
    const result = await apiRequest("/api/auth/admin/login", "POST", { email, password });
    if (result.token) {
      localStorage.setItem("ascorix_token", result.token);
      localStorage.setItem("ascorix_user", JSON.stringify(result.user));
      window.dispatchEvent(new CustomEvent("ascorix_auth_state_changed"));
    }
    return result;
  },

  logout() {
    localStorage.removeItem("ascorix_token");
    localStorage.removeItem("ascorix_user");
    window.dispatchEvent(new CustomEvent("ascorix_auth_state_changed"));
  },

  getCurrentUser() {
    try {
      const userStr = localStorage.getItem("ascorix_user");
      return userStr ? JSON.parse(userStr) : null;
    } catch (e) {
      return null;
    }
  },

  getToken() {
    return localStorage.getItem("ascorix_token");
  },

  // Check backend to verify session validity
  async verifySession() {
    const token = this.getToken();
    if (!token) return null;
    try {
      const result = await apiRequest("/api/auth/me", "GET");
      localStorage.setItem("ascorix_user", JSON.stringify(result.user));
      return result.user;
    } catch (err) {
      // Session expired/invalid, logout
      this.logout();
      return null;
    }
  },

  // ==========================================
  // SERVICES CRUD (API BACKEND)
  // ==========================================

  async getServices() {
    return apiRequest("/api/services");
  },

  async addService(service) {
    const result = await apiRequest("/api/services", "POST", service);
    window.dispatchEvent(new CustomEvent("ascorix_services_updated"));
    return result;
  },

  async updateService(id, service) {
    const result = await apiRequest(`/api/services/${id}`, "PUT", service);
    window.dispatchEvent(new CustomEvent("ascorix_services_updated"));
    return result;
  },

  async deleteService(id) {
    const result = await apiRequest(`/api/services/${id}`, "DELETE");
    window.dispatchEvent(new CustomEvent("ascorix_services_updated"));
    return result;
  },

  // ==========================================
  // PORTFOLIO CRUD (API BACKEND)
  // ==========================================

  async getPortfolio() {
    return apiRequest("/api/portfolio");
  },

  async addPortfolioItem(item) {
    const result = await apiRequest("/api/portfolio", "POST", item);
    window.dispatchEvent(new CustomEvent("ascorix_portfolio_updated"));
    return result;
  },

  async deletePortfolioItem(id) {
    const result = await apiRequest(`/api/portfolio/${id}`, "DELETE");
    window.dispatchEvent(new CustomEvent("ascorix_portfolio_updated"));
    return result;
  },

  // ==========================================
  // INQUIRIES CRUD (API BACKEND)
  // ==========================================

  async getInquiries() {
    return apiRequest("/api/inquiries");
  },

  async addInquiry(inquiry) {
    const result = await apiRequest("/api/inquiries", "POST", inquiry);
    window.dispatchEvent(new CustomEvent("ascorix_inquiries_updated"));
    return result;
  },

  async updateInquiryStatus(id, status) {
    const result = await apiRequest(`/api/inquiries/${id}/status`, "PATCH", { status });
    window.dispatchEvent(new CustomEvent("ascorix_inquiries_updated"));
    return result;
  },

  async deleteInquiry(id) {
    const result = await apiRequest(`/api/inquiries/${id}`, "DELETE");
    window.dispatchEvent(new CustomEvent("ascorix_inquiries_updated"));
    return result;
  },

  // ==========================================
  // SETTINGS MANAGEMENT (PUBLIC & ADMIN)
  // ==========================================

  async getSettings() {
    return apiRequest("/api/settings");
  },

  async getAdminSettings() {
    return apiRequest("/api/admin/settings");
  },

  async updateAdminSettings(settings) {
    const result = await apiRequest("/api/admin/settings", "PUT", settings);
    window.dispatchEvent(new CustomEvent("ascorix_settings_updated"));
    return result;
  },

  // ==========================================
  // USER MANAGEMENT (ADMIN)
  // ==========================================

  async getAdminUsers() {
    return apiRequest("/api/admin/users");
  },

  async updateUserRole(id, role) {
    const result = await apiRequest(`/api/admin/users/${id}/role`, "PATCH", { role });
    window.dispatchEvent(new CustomEvent("ascorix_users_updated"));
    return result;
  },

  async createAdminUser(name, email, password, permissions) {
    const result = await apiRequest("/api/admin/users/create", "POST", { name, email, password, permissions });
    window.dispatchEvent(new CustomEvent("ascorix_users_updated"));
    return result;
  },

  async updateAdminUser(id, userData) {
    const result = await apiRequest(`/api/admin/users/${id}`, "PUT", userData);
    window.dispatchEvent(new CustomEvent("ascorix_users_updated"));
    return result;
  },

  async deleteAdminUser(id) {
    const result = await apiRequest(`/api/admin/users/${id}`, "DELETE");
    window.dispatchEvent(new CustomEvent("ascorix_users_updated"));
    return result;
  },

  // ==========================================
  // OFFER CODES & DISCOUNTS
  // ==========================================

  async getOfferCodes() {
    return apiRequest("/api/admin/offercodes");
  },

  async addOfferCode(code, discount) {
    const result = await apiRequest("/api/admin/offercodes", "POST", { code, discount });
    window.dispatchEvent(new CustomEvent("ascorix_offercodes_updated"));
    return result;
  },

  async deleteOfferCode(id) {
    const result = await apiRequest(`/api/admin/offercodes/${id}`, "DELETE");
    window.dispatchEvent(new CustomEvent("ascorix_offercodes_updated"));
    return result;
  },

  async validateOfferCode(code) {
    return apiRequest("/api/auth/offercodes/validate", "POST", { code });
  }
};
