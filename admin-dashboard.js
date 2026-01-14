// ===== ADMIN DASHBOARD - FULL FIREBASE INTEGRATION =====

import { auth, db } from "./firebase-config.js";
import { 
  collection, doc, getDocs, updateDoc, deleteDoc, query, where,
  onSnapshot, serverTimestamp, addDoc, getDoc
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import {
  createUserWithEmailAndPassword, signOut, deleteUser as deleteAuthUser
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

// ===== CHECK AUTHENTICATION =====
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
  
  if (!adminToken || !adminEmail) {
    window.location.href = 'index.html';
    return false;
  }
  
  return true;
}

if (!checkAdminAuth()) {
  throw new Error('Unauthorized access');
}

// ===== STATE VARIABLES =====
let currentAdminName = "Admin";
let selectedUserId = null;
let selectedReportId = null;
let allUsers = [];
let allReports = [];
let allBlockedUsers = [];
let allAdmins = [];


// ===== UTILITY FUNCTIONS =====

function sanitizeInput(input) {
  const div = document.createElement('div');
  div.textContent = input;
  return div.innerHTML;
}

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  notification.style.position = 'fixed';
  notification.style.top = '20px';
  notification.style.right = '20px';
  notification.style.padding = '15px 20px';
  notification.style.borderRadius = '6px';
  notification.style.zIndex = '3000';
  notification.style.fontWeight = 'bold';
  notification.style.animation = 'slideInRight 0.3s ease';
  
  if (type === 'success') {
    notification.style.background = 'rgba(76, 175, 80, 0.9)';
    notification.style.color = '#fff';
  } else if (type === 'error') {
    notification.style.background = 'rgba(244, 67, 54, 0.9)';
    notification.style.color = '#fff';
  } else {
    notification.style.background = 'rgba(0, 255, 102, 0.9)';
    notification.style.color = '#000';
  }
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'slideOutRight 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

function generateRandomPassword(length = 12) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

// ===== INITIALIZE DASHBOARD =====
window.addEventListener('load', () => {
  if (!checkAdminAuth()) return;
  
  currentAdminName = localStorage.getItem('adminEmail') || 'Admin';
  document.getElementById('adminName').textContent = `${currentAdminName} (Admin)`;
  
  loadOverviewStats();
  setupTabNavigation();
  setupEventListeners();
  loadUsers();
});

// ===== SETUP EVENT LISTENERS =====
function setupEventListeners() {
  // Logout
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminEmail');
        localStorage.removeItem('tokenTimestamp');
        window.location.href = 'index.html';
      }
    });
  }

  // User search
  const searchInput = document.getElementById('userSearch');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const searchTerm = e.target.value.toLowerCase();
      const rows = document.querySelectorAll('#usersTableBody tr');
      
      rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
      });
    });
  }

  // Report filter
  const reportFilter = document.getElementById('reportFilter');
  if (reportFilter) {
    reportFilter.addEventListener('change', (e) => {
      filterReports(e.target.value);
    });
  }

  // Admin management
  const generatePasswordBtn = document.getElementById('generatePasswordBtn');
  if (generatePasswordBtn) {
    generatePasswordBtn.addEventListener('click', () => {
      const password = generateRandomPassword();
      document.getElementById('newAdminPassword').value = password;
      document.getElementById('passwordText').textContent = password;
      document.getElementById('generatedPassword').style.display = 'block';
    });
  }

  const copyPasswordBtn = document.getElementById('copyPasswordBtn');
  if (copyPasswordBtn) {
    copyPasswordBtn.addEventListener('click', () => {
      const password = document.getElementById('newAdminPassword').value;
      navigator.clipboard.writeText(password).then(() => {
        showNotification('✅ Password copied to clipboard', 'success');
      }).catch(() => {
        showNotification('❌ Failed to copy password', 'error');
      });
    });
  }

  const createAdminBtn = document.getElementById('createAdminBtn');
  if (createAdminBtn) {
    createAdminBtn.addEventListener('click', createNewAdmin);
  }

  // Modal close buttons
  document.querySelectorAll('.close-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const modal = e.target.closest('.modal');
      if (modal) modal.style.display = 'none';
    });
  });

  // Modal background click
  window.addEventListener('click', (e) => {
    const userModal = document.getElementById('userActionModal');
    const reportModal = document.getElementById('reportModal');
    
    if (e.target === userModal) userModal.style.display = 'none';
    if (e.target === reportModal) reportModal.style.display = 'none';
  });

  // User action modal buttons
  const viewUserBtn = document.getElementById('viewUserBtn');
  const blockUserBtn = document.getElementById('blockUserBtn');
  const unblockUserBtn = document.getElementById('unblockUserBtn');
  const deleteUserBtn = document.getElementById('deleteUserBtn');
  
  if (viewUserBtn) viewUserBtn.addEventListener('click', viewUserProfile);
  if (blockUserBtn) blockUserBtn.addEventListener('click', blockSelectedUser);
  if (unblockUserBtn) unblockUserBtn.addEventListener('click', unblockSelectedUser);
  if (deleteUserBtn) deleteUserBtn.addEventListener('click', deleteSelectedUser);

  // Report modal buttons
  const markResolvedBtn = document.getElementById('markResolvedBtn');
  const blockReporterBtn = document.getElementById('blockReporterBtn');
  const blockReportedBtn = document.getElementById('blockReportedBtn');
  
  if (markResolvedBtn) markResolvedBtn.addEventListener('click', () => handleReport(selectedReportId, 'resolved'));
  if (blockReporterBtn) blockReporterBtn.addEventListener('click', blockReporter);
  if (blockReportedBtn) blockReportedBtn.addEventListener('click', blockReportedUser);

  // Settings buttons
  document.querySelectorAll('.setting-btn').forEach(btn => {
    btn.addEventListener('click', handleSettingsActions);
  });
}

// ===== TAB NAVIGATION =====
function setupTabNavigation() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.getAttribute('data-tab');
      
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      
      btn.classList.add('active');
      document.getElementById(tabName).classList.add('active');
      
      if (tabName === 'users') loadUsers();
      if (tabName === 'reports') loadReports();
      if (tabName === 'blocked') loadBlockedUsers();
      if (tabName === 'admins') loadAdmins();
    });
  });
}

// ===== LOAD OVERVIEW STATISTICS =====
async function loadOverviewStats() {
  try {
    // Load users count
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const totalUsers = usersSnapshot.size;
    
    // Load messages count
    const messagesSnapshot = await getDocs(collection(db, 'messages'));
    const totalMessages = messagesSnapshot.size;
    
    // Load reports count
    const reportsSnapshot = await getDocs(query(collection(db, 'reports'), where('status', '==', 'pending')));
    const pendingReports = reportsSnapshot.size;
    
    // Load blocked users
    const blockedSnapshot = await getDocs(query(collection(db, 'users'), where('isBlocked', '==', true)));
    const blockedCount = blockedSnapshot.size;
    
    document.getElementById('totalUsers').textContent = totalUsers;
    document.getElementById('totalMessages').textContent = totalMessages;
    document.getElementById('pendingReports').textContent = pendingReports;
    document.getElementById('blockedCount').textContent = blockedCount;
  } catch (error) {
    console.error('Error loading overview stats:', error);
  }
}

// ===== LOAD AND DISPLAY USERS =====
async function loadUsers() {
  const tbody = document.getElementById('usersTableBody');
  tbody.innerHTML = '<tr class="loading"><td colspan="6">Loading users...</td></tr>';
  
  try {
    const usersSnapshot = await getDocs(collection(db, 'users'));
    allUsers = [];
    tbody.innerHTML = '';
    
    usersSnapshot.forEach(doc => {
      const user = { id: doc.id, ...doc.data() };
      allUsers.push(user);
      
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>
          <div class="user-profile">
            <span style="font-size: 1.5rem;">👤</span>
            <strong>${sanitizeInput(user.username || user.displayName || 'Unknown')}</strong>
          </div>
        </td>
        <td>${sanitizeInput(user.username || user.displayName || 'N/A')}</td>
        <td>${sanitizeInput(user.email || 'N/A')}</td>
        <td><span class="status-badge ${user.isOnline ? 'online' : 'offline'}">${user.isOnline ? 'ONLINE' : 'OFFLINE'}</span></td>
        <td>${user.createdAt ? new Date(user.createdAt.toDate?.() || user.createdAt).toLocaleDateString() : 'N/A'}</td>
        <td>
          <button class="action-btn view-btn" onclick="showUserModal('${doc.id}')">👁️ View</button>
          <button class="action-btn ${user.isBlocked ? 'success-btn' : 'warn-btn'}" onclick="toggleBlockUser('${doc.id}')">
            ${user.isBlocked ? '✅ Unblock' : '🚫 Block'}
          </button>
        </td>
      `;
      tbody.appendChild(row);
    });
    
    if (allUsers.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">No users found</td></tr>';
    }
  } catch (error) {
    console.error('Error loading users:', error);
    tbody.innerHTML = `<tr><td colspan="6" style="color: red;">Error loading users: ${error.message}</td></tr>`;
  }
}

// ===== SHOW USER MODAL =====
async function showUserModal(userId) {
  selectedUserId = userId;
  const user = allUsers.find(u => u.id === userId);
  
  if (!user) {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        displayUserModal(userId, userData);
      }
    } catch (error) {
      showNotification('Error loading user profile', 'error');
    }
    return;
  }
  
  displayUserModal(userId, user);
}

function displayUserModal(userId, user) {
  const modal = document.getElementById('userActionModal');
  const info = document.getElementById('userActionInfo');
  
  info.innerHTML = `
    <h4>${sanitizeInput(user.username || user.displayName || 'Unknown User')}</h4>
    <p><strong>Email:</strong> ${sanitizeInput(user.email || 'N/A')}</p>
    <p><strong>User ID:</strong> ${userId}</p>
    <p><strong>Account Status:</strong> ${user.isBlocked ? '🚫 BLOCKED' : '✅ ACTIVE'}</p>
    <p><strong>Joined:</strong> ${user.createdAt ? new Date(user.createdAt.toDate?.() || user.createdAt).toLocaleDateString() : 'N/A'}</p>
  `;
  
  const blockBtn = document.getElementById('blockUserBtn');
  const unblockBtn = document.getElementById('unblockUserBtn');
  
  if (user.isBlocked) {
    blockBtn.style.display = 'none';
    unblockBtn.style.display = 'block';
  } else {
    blockBtn.style.display = 'block';
    unblockBtn.style.display = 'none';
  }
  
  modal.style.display = 'flex';
}

function viewUserProfile() {
  if (!selectedUserId) return;
  alert(`🔍 Profile view for user: ${selectedUserId}\n\nFull profile viewing feature would open detailed user information.`);
}

// ===== TOGGLE BLOCK USER =====
async function toggleBlockUser(userId) {
  const user = allUsers.find(u => u.id === userId);
  if (!user) return;
  
  try {
    await updateDoc(doc(db, 'users', userId), {
      isBlocked: !user.isBlocked
    });
    showNotification(`✅ User ${!user.isBlocked ? 'blocked' : 'unblocked'} successfully`, 'success');
    loadUsers();
    loadBlockedUsers();
    loadOverviewStats();
    document.getElementById('userActionModal').style.display = 'none';
  } catch (error) {
    showNotification(`❌ Error: ${error.message}`, 'error');
  }
}

function blockSelectedUser() {
  if (!selectedUserId) return;
  const user = allUsers.find(u => u.id === selectedUserId);
  if (user && !user.isBlocked) {
    toggleBlockUser(selectedUserId);
  }
}

function unblockSelectedUser() {
  if (!selectedUserId) return;
  const user = allUsers.find(u => u.id === selectedUserId);
  if (user && user.isBlocked) {
    toggleBlockUser(selectedUserId);
  }
}

// ===== DELETE USER =====
async function deleteSelectedUser() {
  if (!selectedUserId) return;
  
  if (confirm('Are you sure you want to delete this user? This cannot be undone.')) {
    try {
      // Delete user data from Firestore
      await deleteDoc(doc(db, 'users', selectedUserId));
      
      // Try to delete from Auth (may fail if not admin)
      try {
        const userAuth = await auth.currentUser;
        if (userAuth && userAuth.uid === selectedUserId) {
          await deleteAuthUser(userAuth);
        }
      } catch (authError) {
        console.log('Could not delete from Auth (expected if not current user)');
      }
      
      showNotification('✅ User deleted successfully', 'success');
      loadUsers();
      loadBlockedUsers();
      loadOverviewStats();
      document.getElementById('userActionModal').style.display = 'none';
    } catch (error) {
      showNotification(`❌ Error: ${error.message}`, 'error');
    }
  }
}

// ===== LOAD AND DISPLAY REPORTS =====
async function loadReports() {
  const container = document.getElementById('reportsContainer');
  container.innerHTML = '<div class="loading-message">Loading reports...</div>';
  
  try {
    const reportsSnapshot = await getDocs(collection(db, 'reports'));
    allReports = [];
    container.innerHTML = '';
    
    reportsSnapshot.forEach(doc => {
      const report = { id: doc.id, ...doc.data() };
      allReports.push(report);
    });
    
    // Apply current filter
    const filterValue = document.getElementById('reportFilter')?.value || 'all';
    filterReports(filterValue);
  } catch (error) {
    console.error('Error loading reports:', error);
    container.innerHTML = `<div class="loading-message" style="color: red;">Error: ${error.message}</div>`;
  }
}

function filterReports(status) {
  const container = document.getElementById('reportsContainer');
  container.innerHTML = '';
  
  let filteredReports = allReports;
  if (status !== 'all') {
    filteredReports = allReports.filter(r => r.status === status);
  }
  
  if (filteredReports.length === 0) {
    container.innerHTML = '<div class="loading-message">No reports found</div>';
    return;
  }
  
  filteredReports.forEach(report => {
    const card = document.createElement('div');
    card.className = `report-card ${report.status}`;
    card.innerHTML = `
      <div class="report-header">
        <h3>Report from ${sanitizeInput(report.reporterName || report.reporterId || 'Unknown')}</h3>
        <span class="report-status ${report.status}">${(report.status || 'pending').toUpperCase()}</span>
      </div>
      <div class="report-content">
        <p><strong>Reported User:</strong> ${sanitizeInput(report.reportedName || report.reportedId || 'Unknown')}</p>
        <p><strong>Reason:</strong> ${sanitizeInput(report.reason || 'N/A')}</p>
        <p><strong>Details:</strong> ${sanitizeInput(report.details || 'No details provided')}</p>
        <p><strong>Date:</strong> ${report.timestamp ? new Date(report.timestamp.toDate?.() || report.timestamp).toLocaleDateString() : 'N/A'}</p>
      </div>
      <div class="action-buttons">
        <button class="action-btn success-btn" onclick="showReportModal('${report.id}')">👁️ Details</button>
        <button class="action-btn warn-btn" onclick="handleReport('${report.id}', 'reviewed')">⚠️ Mark Reviewed</button>
        <button class="action-btn danger-btn" onclick="handleReport('${report.id}', 'dismissed')">❌ Dismiss</button>
      </div>
    `;
    container.appendChild(card);
  });
}

// ===== SHOW REPORT MODAL =====
function showReportModal(reportId) {
  selectedReportId = reportId;
  const report = allReports.find(r => r.id === reportId);
  
  if (!report) return;
  
  const modal = document.getElementById('reportModal');
  const details = document.getElementById('reportDetails');
  
  details.innerHTML = `
    <h4>Report Details</h4>
    <p><strong>Reporter:</strong> ${sanitizeInput(report.reporterName || report.reporterId || 'Unknown')}</p>
    <p><strong>Reported User:</strong> ${sanitizeInput(report.reportedName || report.reportedId || 'Unknown')}</p>
    <p><strong>Reason:</strong> ${sanitizeInput(report.reason || 'N/A')}</p>
    <p><strong>Details:</strong> ${sanitizeInput(report.details || 'No details provided')}</p>
    <p><strong>Status:</strong> ${(report.status || 'pending').toUpperCase()}</p>
    <p><strong>Date:</strong> ${report.timestamp ? new Date(report.timestamp.toDate?.() || report.timestamp).toLocaleString() : 'N/A'}</p>
  `;
  
  modal.style.display = 'flex';
}

// ===== HANDLE REPORT =====
async function handleReport(reportId, newStatus) {
  try {
    await updateDoc(doc(db, 'reports', reportId), {
      status: newStatus,
      updatedAt: serverTimestamp()
    });
    
    showNotification(`✅ Report marked as ${newStatus}`, 'success');
    loadReports();
    loadOverviewStats();
    document.getElementById('reportModal').style.display = 'none';
  } catch (error) {
    showNotification(`❌ Error: ${error.message}`, 'error');
  }
}

function blockReporter() {
  if (!selectedReportId) return;
  const report = allReports.find(r => r.id === selectedReportId);
  if (report) {
    // Block the reporter's user account
    if (confirm(`Block user: ${report.reporterName || report.reporterId}?`)) {
      // Find and block the user
      const userToBlock = allUsers.find(u => u.id === report.reporterId);
      if (userToBlock) {
        toggleBlockUser(report.reporterId);
      }
    }
  }
}

function blockReportedUser() {
  if (!selectedReportId) return;
  const report = allReports.find(r => r.id === selectedReportId);
  if (report) {
    if (confirm(`Block reported user: ${report.reportedName || report.reportedId}?`)) {
      const userToBlock = allUsers.find(u => u.id === report.reportedId);
      if (userToBlock) {
        toggleBlockUser(report.reportedId);
      }
    }
  }
}

// ===== LOAD BLOCKED USERS =====
async function loadBlockedUsers() {
  const container = document.getElementById('blockedUsersContainer');
  container.innerHTML = '<div class="loading-message">Loading blocked users...</div>';
  
  try {
    const blockedSnapshot = await getDocs(query(collection(db, 'users'), where('isBlocked', '==', true)));
    allBlockedUsers = [];
    container.innerHTML = '';
    
    blockedSnapshot.forEach(doc => {
      const user = { id: doc.id, ...doc.data() };
      allBlockedUsers.push(user);
      
      const card = document.createElement('div');
      card.className = 'blocked-card';
      card.innerHTML = `
        <div class="report-header">
          <h3>${sanitizeInput(user.username || user.displayName || 'Unknown')}</h3>
          <span class="report-status">BLOCKED</span>
        </div>
        <div class="report-content">
          <p><strong>Email:</strong> ${sanitizeInput(user.email || 'N/A')}</p>
          <p><strong>Joined:</strong> ${user.createdAt ? new Date(user.createdAt.toDate?.() || user.createdAt).toLocaleDateString() : 'N/A'}</p>
          <p><strong>Status:</strong> ${user.isOnline ? 'Online' : 'Offline'}</p>
        </div>
        <div class="action-buttons">
          <button class="action-btn success-btn" onclick="toggleBlockUser('${doc.id}')">✅ Unblock User</button>
          <button class="action-btn danger-btn" onclick="deleteSelectedUser_FromBlocked('${doc.id}')">🗑️ Delete Account</button>
        </div>
      `;
      container.appendChild(card);
    });
    
    if (allBlockedUsers.length === 0) {
      container.innerHTML = '<p class="empty-state">No blocked users</p>';
    }
  } catch (error) {
    console.error('Error loading blocked users:', error);
    container.innerHTML = `<div class="loading-message" style="color: red;">Error: ${error.message}</div>`;
  }
}

async function deleteSelectedUser_FromBlocked(userId) {
  selectedUserId = userId;
  deleteSelectedUser();
}

// ===== LOAD AND MANAGE ADMINS =====
async function loadAdmins() {
  const adminsList = document.getElementById('adminsList');
  adminsList.innerHTML = '<p>Loading admins...</p>';
  
  try {
    const adminsSnapshot = await getDocs(query(collection(db, 'admins'), where('isActive', '==', true)));
    allAdmins = [];
    adminsList.innerHTML = '';
    
    adminsSnapshot.forEach(doc => {
      const admin = { id: doc.id, ...doc.data() };
      allAdmins.push(admin);
      
      const card = document.createElement('div');
      card.className = 'admin-card';
      card.innerHTML = `
        <div class="admin-card-header">
          <h4>👑 ${sanitizeInput(admin.displayName || admin.email || 'Admin')}</h4>
          <span class="admin-email">${sanitizeInput(admin.email || 'N/A')}</span>
        </div>
        <div class="admin-details">
          <p><strong>Created:</strong> ${admin.createdAt ? new Date(admin.createdAt.toDate?.() || admin.createdAt).toLocaleDateString() : 'N/A'}</p>
          <p><strong>Created By:</strong> ${sanitizeInput(admin.createdBy || 'System')}</p>
          <p><strong>Status:</strong> ✅ Active</p>
          <p><strong>Last Login:</strong> ${admin.lastLogin ? new Date(admin.lastLogin.toDate?.() || admin.lastLogin).toLocaleString() : 'Never'}</p>
        </div>
        <div class="admin-actions">
          <button class="action-btn warn-btn" onclick="deactivateAdmin('${doc.id}')">🔒 Deactivate</button>
          <button class="action-btn danger-btn" onclick="deleteAdmin('${doc.id}')">🗑️ Remove</button>
        </div>
      `;
      adminsList.appendChild(card);
    });
    
    // Also load inactive admins
    const inactiveSnapshot = await getDocs(query(collection(db, 'admins'), where('isActive', '==', false)));
    inactiveSnapshot.forEach(doc => {
      const admin = { id: doc.id, ...doc.data() };
      
      const card = document.createElement('div');
      card.className = 'admin-card';
      card.innerHTML = `
        <div class="admin-card-header">
          <h4>👑 ${sanitizeInput(admin.displayName || admin.email || 'Admin')} (Inactive)</h4>
          <span class="admin-email">${sanitizeInput(admin.email || 'N/A')}</span>
        </div>
        <div class="admin-details">
          <p><strong>Created:</strong> ${admin.createdAt ? new Date(admin.createdAt.toDate?.() || admin.createdAt).toLocaleDateString() : 'N/A'}</p>
          <p><strong>Created By:</strong> ${sanitizeInput(admin.createdBy || 'System')}</p>
          <p><strong>Status:</strong> ❌ Inactive</p>
          <p><strong>Last Login:</strong> ${admin.lastLogin ? new Date(admin.lastLogin.toDate?.() || admin.lastLogin).toLocaleString() : 'Never'}</p>
        </div>
        <div class="admin-actions">
          <button class="action-btn success-btn" onclick="activateAdmin('${doc.id}')">🔓 Activate</button>
          <button class="action-btn danger-btn" onclick="deleteAdmin('${doc.id}')">🗑️ Remove</button>
        </div>
      `;
      adminsList.appendChild(card);
    });
    
    if (allAdmins.length === 0 && inactiveSnapshot.empty) {
      adminsList.innerHTML = '<p>No admins found</p>';
    }
  } catch (error) {
    console.error('Error loading admins:', error);
    adminsList.innerHTML = `<p style="color: red;">Error: ${error.message}</p>`;
  }
}

// ===== CREATE NEW ADMIN =====
async function createNewAdmin() {
  const email = document.getElementById('newAdminEmail').value.trim();
  const password = document.getElementById('newAdminPassword').value.trim();
  const name = document.getElementById('newAdminName').value.trim();
  
  // Validation
  if (!email) {
    showNotification('❌ Please enter an email', 'error');
    return;
  }
  
  if (!isValidEmail(email)) {
    showNotification('❌ Please enter a valid email', 'error');
    return;
  }
  
  if (!password) {
    showNotification('❌ Please enter or generate a password', 'error');
    return;
  }
  
  if (!name) {
    showNotification('❌ Please enter admin name', 'error');
    return;
  }
  
  try {
    // Create auth user
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const adminUser = userCredential.user;
    
    // Create admin document in Firestore
    await addDoc(collection(db, 'admins'), {
      uid: adminUser.uid,
      email: email,
      displayName: name,
      createdAt: serverTimestamp(),
      createdBy: currentAdminName,
      isActive: true,
      lastLogin: null,
      role: 'admin',
      permissions: ['manage_users', 'manage_reports', 'manage_admins', 'view_logs']
    });
    
    // Clear form
    document.getElementById('newAdminEmail').value = '';
    document.getElementById('newAdminPassword').value = '';
    document.getElementById('newAdminName').value = '';
    document.getElementById('generatedPassword').style.display = 'none';
    document.getElementById('passwordText').textContent = '';
    
    showNotification(`✅ Admin "${name}" created successfully with email: ${email}`, 'success');
    loadAdmins();
  } catch (error) {
    showNotification(`❌ Error: ${error.message}`, 'error');
  }
}

// ===== MANAGE ADMIN STATUS =====
async function deactivateAdmin(adminId) {
  if (confirm('Are you sure you want to deactivate this admin?')) {
    try {
      await updateDoc(doc(db, 'admins', adminId), {
        isActive: false
      });
      showNotification('✅ Admin deactivated successfully', 'success');
      loadAdmins();
    } catch (error) {
      showNotification(`❌ Error: ${error.message}`, 'error');
    }
  }
}

async function activateAdmin(adminId) {
  try {
    await updateDoc(doc(db, 'admins', adminId), {
      isActive: true
    });
    showNotification('✅ Admin activated successfully', 'success');
    loadAdmins();
  } catch (error) {
    showNotification(`❌ Error: ${error.message}`, 'error');
  }
}

async function deleteAdmin(adminId) {
  if (confirm('Are you sure you want to remove this admin?')) {
    try {
      await deleteDoc(doc(db, 'admins', adminId));
      showNotification('✅ Admin removed successfully', 'success');
      loadAdmins();
    } catch (error) {
      showNotification(`❌ Error: ${error.message}`, 'error');
    }
  }
}

// ===== SETTINGS ACTIONS =====
function handleSettingsActions(e) {
  const buttonText = e.target.textContent.trim();
  
  if (buttonText.includes('System Logs')) {
    showNotification('📋 System logs loading...', 'info');
    alert('System Logs:\n\n- Dashboard accessed: ' + new Date().toLocaleString() + '\n- All systems operational\n- Last backup: 24 hours ago\n- Active connections: 5');
  }
  else if (buttonText.includes('Backup')) {
    showNotification('💾 Generating backup...', 'info');
    setTimeout(() => {
      // Simulate backup download
      const backupData = {
        timestamp: new Date().toISOString(),
        totalUsers: document.getElementById('totalUsers').textContent,
        totalMessages: document.getElementById('totalMessages').textContent,
        exportedAt: new Date().toLocaleString()
      };
      
      const dataStr = JSON.stringify(backupData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `nexchat-backup-${Date.now()}.json`;
      link.click();
      
      showNotification('✅ Backup downloaded successfully', 'success');
    }, 1000);
  }
  else if (buttonText.includes('Clear Cache')) {
    if (confirm('Are you sure you want to clear the cache? This may affect performance temporarily.')) {
      localStorage.clear();
      sessionStorage.clear();
      showNotification('✅ Cache cleared successfully', 'success');
    }
  }
}

// Make functions globally accessible for onclick handlers
window.showUserModal = showUserModal;
window.toggleBlockUser = toggleBlockUser;
window.deleteSelectedUser = deleteSelectedUser;
window.deleteSelectedUser_FromBlocked = deleteSelectedUser_FromBlocked;
window.showReportModal = showReportModal;
window.handleReport = handleReport;
window.deactivateAdmin = deactivateAdmin;
window.activateAdmin = activateAdmin;
window.deleteAdmin = deleteAdmin;