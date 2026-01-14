// ======= ADMIN DASHBOARD - COMPREHENSIVE SECURITY & USER MANAGEMENT =======

import { auth, db } from "./firebase-config.js";
import { 
  collection, doc, getDocs, updateDoc, deleteDoc, query, where,
  onSnapshot, serverTimestamp, addDoc
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// ======= SECURITY UTILITIES =======

// Input sanitization to prevent XSS attacks
function sanitizeInput(input) {
  const div = document.createElement('div');
  div.textContent = input;
  return div.innerHTML;
}

// Validate email format
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// ===== IP-BASED BRUTE FORCE PROTECTION =====
const ipLoginAttempts = {};
const blockedIPs = {};
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
const ATTEMPT_WINDOW = 5 * 60 * 1000; // 5 minutes

// Get user IP (simulated - in production use actual IP detection)
function getUserIP() {
  return sessionStorage.getItem('userIP') || 'unknown-' + Math.random().toString(36).substr(2, 9);
}

// Check if IP is blocked
function isIPBlocked(ip) {
  if (blockedIPs[ip]) {
    const blockTime = blockedIPs[ip];
    if (Date.now() - blockTime < LOCKOUT_DURATION) {
      return true;
    } else {
      delete blockedIPs[ip];
      delete ipLoginAttempts[ip];
      return false;
    }
  }
  return false;
}

// Record failed login attempt
function recordFailedLoginAttempt(ip) {
  const now = Date.now();
  
  if (!ipLoginAttempts[ip]) {
    ipLoginAttempts[ip] = [];
  }
  
  // Clean old attempts outside the window
  ipLoginAttempts[ip] = ipLoginAttempts[ip].filter(t => now - t < ATTEMPT_WINDOW);
  
  // Add new attempt
  ipLoginAttempts[ip].push(now);
  
  // Log security event
  logSecurityEvent('FAILED_LOGIN_ATTEMPT', ip, ipLoginAttempts[ip].length);
  
  // Check if should block this IP
  if (ipLoginAttempts[ip].length >= MAX_LOGIN_ATTEMPTS) {
    blockIP(ip);
    return { blocked: true, attempts: ipLoginAttempts[ip].length };
  }
  
  return { blocked: false, attempts: ipLoginAttempts[ip].length, remaining: MAX_LOGIN_ATTEMPTS - ipLoginAttempts[ip].length };
}

// Block an IP
function blockIP(ip) {
  blockedIPs[ip] = Date.now();
  logSecurityEvent('IP_BLOCKED', ip, `Too many login attempts. Blocked for ${LOCKOUT_DURATION / 60000} minutes`);
}

// Clear login attempts on successful login
function clearLoginAttempts(ip) {
  delete ipLoginAttempts[ip];
  logSecurityEvent('SUCCESSFUL_LOGIN', ip, 'Login successful, attempts cleared');
}

// Log security events
async function logSecurityEvent(eventType, ip, details = '') {
  try {
    await addDoc(collection(db, 'securityLogs'), {
      eventType: eventType,
      ipAddress: ip,
      details: sanitizeInput(details),
      timestamp: serverTimestamp(),
      userAgent: navigator.userAgent.substring(0, 255),
      screenResolution: `${window.screen.width}x${window.screen.height}`
    });
  } catch (err) {
    console.error('Error logging security event:', err);
  }
}

// Rate limiting for admin actions
const rateLimiter = {};
function checkRateLimit(action, limit = 10, window = 60000) {
  const key = `${action}_${Date.now()}`;
  const now = Date.now();
  
  if (!rateLimiter[action]) rateLimiter[action] = [];
  
  rateLimiter[action] = rateLimiter[action].filter(t => now - t < window);
  
  if (rateLimiter[action].length >= limit) {
    return false; // Rate limited
  }
  
  rateLimiter[action].push(now);
  return true;
}

// Password strength validator
function validatePasswordStrength(password) {
  const strength = {
    hasUpperCase: /[A-Z]/.test(password),
    hasLowerCase: /[a-z]/.test(password),
    hasNumbers: /\d/.test(password),
    hasSpecialChars: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
    isLongEnough: password.length >= 12
  };
  
  const score = Object.values(strength).filter(Boolean).length;
  return { strength, score, isStrong: score >= 4 };
}

// CSRF Token Management
function generateCSRFToken() {
  const token = Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b => b.toString(16).padStart(2, '0')).join('');
  sessionStorage.setItem('csrfToken', token);
  return token;
}

function verifyCSRFToken(token) {
  return token === sessionStorage.getItem('csrfToken');
}

// ======= ADMIN AUTHENTICATION =======

function checkAdminAuth() {
  const adminToken = localStorage.getItem('adminToken');
  const adminEmail = localStorage.getItem('adminEmail');
  const tokenTimestamp = localStorage.getItem('tokenTimestamp');
  
  // Token expiration: 24 hours
  if (tokenTimestamp && Date.now() - parseInt(tokenTimestamp) > 24 * 60 * 60 * 1000) {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminEmail');
    localStorage.removeItem('tokenTimestamp');
    window.location.href = 'index.html';
    return false;
  }
  
  if (!adminToken || !adminEmail || adminEmail !== 'demonalexander526@gmail.com') {
    window.location.href = 'index.html';
    return false;
  }
  
  // Generate CSRF token if not exists
  if (!sessionStorage.getItem('csrfToken')) {
    generateCSRFToken();
  }
  
  logSecurityEvent('DASHBOARD_ACCESS', getUserIP(), `Admin accessed dashboard`);
  return true;
}

if (!checkAdminAuth()) {
  throw new Error('Unauthorized access');
}

// ======= DOM ELEMENTS =======

const dashboardContent = document.getElementById('dashboardContent');
const usersSection = document.getElementById('usersSection');
const reportsSection = document.getElementById('reportsSection');
const settingsSection = document.getElementById('settingsSection');
const logoutBtn = document.getElementById('logoutBtn');
const searchUsersInput = document.getElementById('searchUsersInput');
const filterBlockedCheckbox = document.getElementById('filterBlockedCheckbox');

// ======= NAVIGATION =======

document.getElementById('usersNav').addEventListener('click', () => {
  showSection('users');
  loadAllUsers();
});

document.getElementById('reportsNav').addEventListener('click', () => {
  showSection('reports');
  loadReports();
});

document.getElementById('settingsNav').addEventListener('click', () => {
  showSection('settings');
});

function showSection(section) {
  document.querySelectorAll('[data-section]').forEach(el => {
    el.style.display = 'none';
  });
  document.querySelector(`[data-section="${section}"]`).style.display = 'block';
}

// ======= LOAD ALL USERS =======

async function loadAllUsers() {
  if (!checkRateLimit('loadUsers', 5, 5000)) {
    showNotification('⏱️ Please wait before refreshing users', 'error');
    return;
  }

  try {
    const usersRef = collection(db, 'users');
    const snapshot = await getDocs(usersRef);
    const usersList = document.getElementById('usersList');
    usersList.innerHTML = '';

    snapshot.forEach(doc => {
      const user = doc.data();
      const userId = doc.id;
      const isBlocked = user.isBlocked || false;
      const isAdmin = user.isAdmin || false;

      const userCard = document.createElement('div');
      userCard.className = `user-card ${isBlocked ? 'blocked' : ''}`;
      userCard.innerHTML = `
        <div class="user-header">
          <img src="${sanitizeInput(user.profilePic || 'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 100 100%27%3E%3Ccircle cx=%2750%27 cy=%2750%27 r=%2750%27 fill=%27%2300ff66%27/%3E%3C/svg%3E')}" alt="profile" class="user-profile-pic">
          <div class="user-info">
            <h3>${sanitizeInput(user.username || user.email)}</h3>
            <p class="user-email">${sanitizeInput(user.email)}</p>
            ${isAdmin ? '<span class="admin-badge">👑 Admin</span>' : ''}
            ${isBlocked ? '<span class="blocked-badge">🚫 Blocked</span>' : ''}
          </div>
        </div>
        <div class="user-actions">
          <button class="action-btn ${isBlocked ? 'unblock-btn' : 'block-btn'}" onclick="toggleBlockUser('${userId}', ${isBlocked})">
            ${isBlocked ? '✅ Unblock' : '🚫 Block'}
          </button>
          ${!isAdmin ? `<button class="action-btn promote-btn" onclick="promoteToAdmin('${userId}', '${sanitizeInput(user.email)}')">👑 Make Admin</button>` : `<button class="action-btn demote-btn" onclick="demoteFromAdmin('${userId}')">👤 Remove Admin</button>`}
          <button class="action-btn delete-btn" onclick="deleteUser('${userId}')">🗑️ Delete</button>
        </div>
      `;
      usersList.appendChild(userCard);
    });

    showNotification('✅ Users loaded', 'success');
  } catch (err) {
    console.error('Error loading users:', err);
    showNotification('❌ Error loading users', 'error');
  }
}

// ======= BLOCK/UNBLOCK USER =======

async function toggleBlockUser(userId, currentlyBlocked) {
  if (!checkRateLimit('blockUser', 20, 1000)) {
    showNotification('⏱️ Too many actions. Please wait.', 'error');
    return;
  }

  if (!confirm(`Are you sure you want to ${currentlyBlocked ? 'unblock' : 'block'} this user?`)) return;

  try {
    await updateDoc(doc(db, 'users', userId), {
      isBlocked: !currentlyBlocked,
      blockedAt: !currentlyBlocked ? serverTimestamp() : null,
      blockedBy: !currentlyBlocked ? 'demonalexander526@gmail.com' : null
    });

    // Log action
    await logAdminAction(userId, `${currentlyBlocked ? 'Unblocked' : 'Blocked'} user`);
    showNotification(`✅ User ${currentlyBlocked ? 'unblocked' : 'blocked'} successfully`, 'success');
    loadAllUsers();
  } catch (err) {
    console.error('Error blocking user:', err);
    showNotification('❌ Error updating user', 'error');
  }
}

// ======= PROMOTE USER TO ADMIN =======

async function promoteToAdmin(userId, userEmail) {
  if (!isValidEmail(userEmail)) {
    showNotification('❌ Invalid email format', 'error');
    return;
  }

  if (!confirm(`Promote ${sanitizeInput(userEmail)} to admin? This user will have full access.`)) return;

  try {
    await updateDoc(doc(db, 'users', userId), {
      isAdmin: true,
      promotedAt: serverTimestamp(),
      promotedBy: 'demonalexander526@gmail.com'
    });

    await logAdminAction(userId, `Promoted to admin`);
    showNotification(`✅ ${sanitizeInput(userEmail)} is now an admin`, 'success');
    loadAllUsers();
  } catch (err) {
    console.error('Error promoting user:', err);
    showNotification('❌ Error promoting user', 'error');
  }
}

// ======= DEMOTE ADMIN =======

async function demoteFromAdmin(userId) {
  if (!confirm('Remove admin privileges from this user?')) return;

  try {
    await updateDoc(doc(db, 'users', userId), {
      isAdmin: false,
      demotedAt: serverTimestamp()
    });

    await logAdminAction(userId, `Demoted from admin`);
    showNotification('✅ Admin privileges removed', 'success');
    loadAllUsers();
  } catch (err) {
    console.error('Error demoting user:', err);
    showNotification('❌ Error demoting user', 'error');
  }
}

// ======= DELETE USER =======

async function deleteUser(userId) {
  if (!confirm('⚠️ This will permanently delete the user and all their data. Continue?')) return;

  try {
    // Delete user document
    await deleteDoc(doc(db, 'users', userId));

    // Delete all messages from this user
    const messagesRef = collection(db, 'messages');
    const q = query(messagesRef, where('from', '==', userId));
    const snapshot = await getDocs(q);
    
    snapshot.forEach(async (doc) => {
      await deleteDoc(doc.ref);
    });

    await logAdminAction(userId, `User account deleted`);
    showNotification('✅ User and all data deleted', 'success');
    loadAllUsers();
  } catch (err) {
    console.error('Error deleting user:', err);
    showNotification('❌ Error deleting user', 'error');
  }
}

// ======= LOAD REPORTS =======

async function loadReports() {
  if (!checkRateLimit('loadReports', 5, 5000)) {
    showNotification('⏱️ Please wait before refreshing', 'error');
    return;
  }

  try {
    const reportsRef = collection(db, 'reports');
    const snapshot = await getDocs(reportsRef);
    const reportsList = document.getElementById('reportsList');
    reportsList.innerHTML = '';

    if (snapshot.empty) {
      reportsList.innerHTML = '<p class="no-data">No reports yet</p>';
      return;
    }

    snapshot.forEach(doc => {
      const report = doc.data();
      const reportId = doc.id;

      const reportCard = document.createElement('div');
      reportCard.className = `report-card ${report.status || 'pending'}`;
      reportCard.innerHTML = `
        <div class="report-header">
          <h3>Report from ${sanitizeInput(report.reporterEmail || 'Unknown')}</h3>
          <span class="report-status">${(report.status || 'pending').toUpperCase()}</span>
        </div>
        <div class="report-details">
          <p><strong>Reported User:</strong> ${sanitizeInput(report.reportedUserEmail)}</p>
          <p><strong>Reason:</strong> ${sanitizeInput(report.reason)}</p>
          <p><strong>Details:</strong> ${sanitizeInput(report.details)}</p>
          <p><strong>Date:</strong> ${report.timestamp ? new Date(report.timestamp.toDate()).toLocaleString() : 'Unknown'}</p>
        </div>
        <div class="report-actions">
          <button class="action-btn block-btn" onclick="handleReport('${reportId}', 'approved')">✅ Block User</button>
          <button class="action-btn warning-btn" onclick="handleReport('${reportId}', 'warning')">⚠️ Send Warning</button>
          <button class="action-btn dismiss-btn" onclick="handleReport('${reportId}', 'dismissed')">❌ Dismiss</button>
        </div>
      `;
      reportsList.appendChild(reportCard);
    });
  } catch (err) {
    console.error('Error loading reports:', err);
    showNotification('❌ Error loading reports', 'error');
  }
}

// ======= HANDLE REPORT =======

async function handleReport(reportId, action) {
  try {
    await updateDoc(doc(db, 'reports', reportId), {
      status: action,
      resolvedAt: serverTimestamp(),
      resolvedBy: 'demonalexander526@gmail.com'
    });

    await logAdminAction(reportId, `Report ${action}`);
    showNotification(`✅ Report ${action}`, 'success');
    loadReports();
  } catch (err) {
    console.error('Error handling report:', err);
    showNotification('❌ Error handling report', 'error');
  }
}

// ======= CHANGE ADMIN PASSWORD =======

document.getElementById('changePasswordForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const oldPassword = document.getElementById('oldPassword').value;
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;

  // Validate new password
  if (newPassword !== confirmPassword) {
    showNotification('❌ Passwords do not match', 'error');
    return;
  }

  // Strong password requirements
  const passwordValidation = validatePasswordStrength(newPassword);
  if (!passwordValidation.isStrong) {
    showNotification('❌ Password must be 12+ chars with uppercase, lowercase, numbers & symbols', 'error');
    return;
  }

  // Prevent reuse of old password
  if (oldPassword === newPassword) {
    showNotification('❌ New password cannot be the same as old password', 'error');
    return;
  }

  // In production, verify old password and update securely
  const correctOldPassword = 'LND544GE@$EJA4APP%';
  if (oldPassword !== correctOldPassword) {
    showNotification('❌ Current password is incorrect', 'error');
    logSecurityEvent('FAILED_PASSWORD_CHANGE', getUserIP(), 'Incorrect old password entered');
    return;
  }

  // Simulate password change
  localStorage.setItem('adminPasswordChanged', 'true');
  localStorage.setItem('lastPasswordChangeTime', Date.now());
  showNotification('✅ Password changed successfully', 'success');
  logSecurityEvent('PASSWORD_CHANGED', getUserIP(), 'Admin password successfully changed');
  document.getElementById('changePasswordForm').reset();
});

// ======= LOG ADMIN ACTIONS =======

async function logAdminAction(targetId, action) {
  try {
    await addDoc(collection(db, 'adminLogs'), {
      adminEmail: 'demonalexander526@gmail.com',
      action: sanitizeInput(action),
      targetId: targetId,
      timestamp: serverTimestamp(),
      ipAddress: 'protected' // In production, capture actual IP
    });
  } catch (err) {
    console.error('Error logging action:', err);
  }
}

// ======= SEARCH USERS =======

if (searchUsersInput) {
  searchUsersInput.addEventListener('input', async (e) => {
    const searchTerm = sanitizeInput(e.target.value.toLowerCase());
    const userCards = document.querySelectorAll('.user-card');

    userCards.forEach(card => {
      const username = card.querySelector('h3').textContent.toLowerCase();
      const email = card.querySelector('.user-email').textContent.toLowerCase();
      
      if (username.includes(searchTerm) || email.includes(searchTerm)) {
        card.style.display = 'block';
      } else {
        card.style.display = 'none';
      }
    });
  });
}

// ======= FILTER BLOCKED USERS =======

if (filterBlockedCheckbox) {
  filterBlockedCheckbox.addEventListener('change', (e) => {
    const showBlocked = e.target.checked;
    const userCards = document.querySelectorAll('.user-card');

    userCards.forEach(card => {
      if (showBlocked) {
        if (card.classList.contains('blocked')) {
          card.style.display = 'block';
        } else {
          card.style.display = 'none';
        }
      } else {
        card.style.display = 'block';
      }
    });
  });
}

// ======= ADMIN ACCOUNT MANAGEMENT =======

// Generate secure random password
function generateSecurePassword() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

// Hash password for storage (demo - use bcrypt in production)
function hashPassword(password) {
  return btoa(password).split('').reverse().join('');
}

// Create new admin account
async function createNewAdmin(email, password, name) {
  if (!checkRateLimit('createAdmin', 5, 60000)) {
    alert('⚠️ Too many admin creation attempts. Please wait.');
    return false;
  }

  if (!isValidEmail(email)) {
    alert('❌ Invalid email format');
    return false;
  }

  if (!password || password.length < 8) {
    alert('❌ Password must be at least 8 characters');
    return false;
  }

  if (!name || name.length < 2) {
    alert('❌ Please enter admin name');
    return false;
  }

  try {
    // Add admin to Firebase
    const adminsRef = collection(db, 'admins');
    
    // Check if admin already exists
    const q = query(adminsRef, where('email', '==', email));
    const existingAdmins = await getDocs(q);
    
    if (existingAdmins.size > 0) {
      alert('❌ This email is already an admin');
      return false;
    }

    // Create new admin document
    await addDoc(adminsRef, {
      email: sanitizeInput(email),
      name: sanitizeInput(name),
      passwordHash: hashPassword(password),
      createdAt: new Date(),
      createdBy: localStorage.getItem('adminEmail'),
      isActive: true,
      lastLogin: null,
      loginAttempts: 0,
      createdPassword: password // For initial display only
    });

    // Log action
    logAdminAction('CREATE_ADMIN', email, `Created new admin: ${name}`);

    return true;
  } catch (error) {
    console.error('Error creating admin:', error);
    alert('❌ Failed to create admin: ' + error.message);
    return false;
  }
}

// Load all admins from Firebase
async function loadAllAdmins() {
  try {
    const adminsRef = collection(db, 'admins');
    const snapshot = await getDocs(adminsRef);
    const adminsList = document.getElementById('adminsList');
    
    if (snapshot.empty) {
      adminsList.innerHTML = '<p class="empty-state">No other admins yet</p>';
      return;
    }

    let adminsHTML = '<div class="admins-grid">';
    snapshot.forEach(doc => {
      const admin = doc.data();
      adminsHTML += `
        <div class="admin-card">
          <div class="admin-header">
            <h4>👤 ${sanitizeInput(admin.name)}</h4>
            <span class="admin-email">${sanitizeInput(admin.email)}</span>
          </div>
          <div class="admin-details">
            <p><strong>Created:</strong> ${new Date(admin.createdAt.seconds * 1000).toLocaleDateString()}</p>
            <p><strong>Created By:</strong> ${sanitizeInput(admin.createdBy)}</p>
            <p><strong>Status:</strong> ${admin.isActive ? '✅ Active' : '❌ Inactive'}</p>
            ${admin.lastLogin ? `<p><strong>Last Login:</strong> ${new Date(admin.lastLogin.seconds * 1000).toLocaleString()}</p>` : '<p><strong>Last Login:</strong> Never</p>'}
          </div>
          <div class="admin-actions">
            <button onclick="toggleAdminStatus('${doc.id}', ${admin.isActive})" class="action-btn">
              ${admin.isActive ? '🔒 Deactivate' : '🔓 Activate'}
            </button>
            <button onclick="removeAdmin('${doc.id}', '${sanitizeInput(admin.name)}')" class="action-btn danger">🗑️ Remove</button>
          </div>
        </div>
      `;
    });
    adminsHTML += '</div>';
    adminsList.innerHTML = adminsHTML;
  } catch (error) {
    console.error('Error loading admins:', error);
    document.getElementById('adminsList').innerHTML = '<p class="error">Failed to load admins</p>';
  }
}

// Toggle admin status (activate/deactivate)
async function toggleAdminStatus(adminId, currentStatus) {
  try {
    const adminRef = doc(db, 'admins', adminId);
    await updateDoc(adminRef, {
      isActive: !currentStatus
    });
    
    logAdminAction('TOGGLE_ADMIN', adminId, `Admin status changed to ${!currentStatus ? 'Active' : 'Inactive'}`);
    loadAllAdmins();
    showNotification(`✅ Admin status updated!`);
  } catch (error) {
    showNotification(`❌ Failed to update admin status`, 'error');
  }
}

// Remove admin account
async function removeAdmin(adminId, adminName) {
  if (!confirm(`Are you sure you want to remove admin "${adminName}"?`)) {
    return;
  }

  try {
    await deleteDoc(doc(db, 'admins', adminId));
    logAdminAction('REMOVE_ADMIN', adminId, `Removed admin: ${adminName}`);
    loadAllAdmins();
    showNotification(`✅ Admin "${adminName}" has been removed!`);
  } catch (error) {
    showNotification(`❌ Failed to remove admin`, 'error');
  }
}

// ======= NOTIFICATIONS =======

function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = sanitizeInput(message);
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease forwards';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// ======= LOGOUT =======

if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to logout?')) {
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminEmail');
      window.location.href = 'index.html';
    }
  });
}

// Load initial data
window.addEventListener('load', () => {
  showSection('users');
  loadAllUsers();
});