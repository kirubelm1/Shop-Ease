const addProductBtn = document.getElementById('addProductBtn');
const addProductModal = document.getElementById('addProductModal');
const productModalClose = document.querySelector('#addProductModal .modal-close');
const authModal = document.getElementById('authModal');
const authModalClose = document.getElementById('authModalClose');
const authForm = document.getElementById('authForm');
const authModalTitle = document.getElementById('authModalTitle');
const submitBtn = document.getElementById('submitBtn');
const toggleLink = document.getElementById('toggleLink');
const toggleForm = document.getElementById('toggleForm');
const errorMessage = document.getElementById('errorMessage');
const adminContact = document.getElementById('admin-contact');
const dashboard = document.getElementById('dashboard');
const usernameDisplay = document.getElementById('usernameDisplay');
let salesChart, orderStatusChart;
let isSignup = false;
const loginAttempts = new Map(); // Track login attempts per username
const LOCKOUT_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds
let isSiteLocked = false;
let requestTimestamps = [];

// Function to lock the site
function lockSite(reason) {
  if (isSiteLocked) return;
  isSiteLocked = true;
  const lockoutEndTime = Date.now() + LOCKOUT_DURATION;
  localStorage.setItem('lockoutState', JSON.stringify({ isLocked: true, reason, endTime: lockoutEndTime }));
  const lockMessage = document.createElement('div');
  lockMessage.id = 'lockMessage';
  lockMessage.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0, 0, 0, 0.9); color: #dc3545; display: flex;
    align-items: center; justify-content: center; z-index: 9999;
    font-size: 24px; text-align: center; padding: 20px;
  `;
  lockMessage.textContent = `Site temporarily locked due to ${reason}. Please try again in 5 minutes.`;
  document.body.appendChild(lockMessage);
  document.body.style.pointerEvents = 'none'; // Disable all interactions
  logSuspiciousActivity(reason);
  setTimeout(unlockSite, LOCKOUT_DURATION);
}

// Function to unlock the site
function unlockSite() {
  isSiteLocked = false;
  localStorage.removeItem('lockoutState');
  document.body.style.pointerEvents = 'auto';
  const lockMessage = document.getElementById('lockMessage');
  if (lockMessage) lockMessage.remove();
}

// Check lockout state on page load
function checkLockoutState() {
  const lockoutState = localStorage.getItem('lockoutState');
  if (lockoutState) {
    const { isLocked, reason, endTime } = JSON.parse(lockoutState);
    if (isLocked && Date.now() < endTime) {
      isSiteLocked = true;
      const lockMessage = document.createElement('div');
      lockMessage.id = 'lockMessage';
      lockMessage.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0, 0, 0, 0.9); color: #dc3545; display: flex;
        align-items: center; justify-content: center; z-index: 9999;
        font-size: 24px; text-align: center; padding: 20px;
      `;
      lockMessage.textContent = `Site temporarily locked due to ${reason}. Please try again in 5 minutes.`;
      document.body.appendChild(lockMessage);
      document.body.style.pointerEvents = 'none';
      setTimeout(unlockSite, endTime - Date.now());
      return true;
    } else {
      localStorage.removeItem('lockoutState'); // Clear expired lockout
    }
  }
  return false;
}

// Log suspicious activity to the server
async function logSuspiciousActivity(reason) {
  try {
    await fetch('/api/security/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason, timestamp: new Date().toISOString() })
    });
  } catch (error) {
    console.error('Error logging suspicious activity:', error);
  }
}

// Check for suspicious request frequency
function checkRequestFrequency() {
  const now = Date.now();
  requestTimestamps = requestTimestamps.filter(ts => now - ts < 10000); // 10-second window
  requestTimestamps.push(now);
  if (requestTimestamps.length > 50) { // More than 50 requests in 10 seconds
    lockSite('suspicious request frequency');
    return true;
  }
  return false;
}

// Sanitize input to prevent XSS
function sanitizeInput(input) {
  const div = document.createElement('div');
  div.textContent = input;
  return div.innerHTML;
}

function formatETB(amount) {
  return `ETB ${Number(amount).toLocaleString('en-ET', { minimumFractionDigits: 2 })}`;
}

function checkAuth() {
  if (isSiteLocked) return false;
  const token = localStorage.getItem('token');
  if (!token) {
    authModal.classList.add('active');
    dashboard.style.display = 'none';
    return false;
  }
  return token;
}

async function verifyToken(token) {
  if (isSiteLocked) return false;
  if (checkRequestFrequency()) return false;
  try {
    const response = await fetch('/api/auth/verify', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) {
      const error = await response.json();
      if (error.message.includes('Invalid or expired token')) {
        logSuspiciousActivity('invalid token attempt');
        lockSite('invalid token detected');
      }
      throw new Error('Token verification failed');
    }
    const result = await response.json();
    return result.username;
  } catch (error) {
    console.error('Error verifying token:', error);
    localStorage.removeItem('token');
    authModal.classList.add('active');
    dashboard.style.display = 'none';
    return false;
  }
}

async function checkSignupStatus() {
  if (isSiteLocked) return;
  try {
    const response = await fetch('/api/auth/check-signup');
    const result = await response.json();
    toggleForm.style.display = result.signupAllowed ? 'block' : 'none';
  } catch (error) {
    console.error('Error checking signup status:', error);
    toggleForm.style.display = 'none';
  }
}

function logout() {
  if (isSiteLocked) return;
  localStorage.removeItem('token');
  authModal.classList.add('active');
  dashboard.style.display = 'none';
  authForm.reset();
  errorMessage.style.display = 'none';
  isSignup = false;
  authModalTitle.textContent = 'Login';
  submitBtn.textContent = 'Login';
  toggleForm.firstChild.textContent = "Don't have an account? ";
  toggleLink.textContent = 'Sign Up';
  checkSignupStatus();
}

document.addEventListener('DOMContentLoaded', async () => {
  if (checkLockoutState()) return; // Check lockout state first
  adminContact.textContent = "Kirubel Mesfin | kirusu1.bm@gmail.com | +251911604204";
  checkSignupStatus();

  const token = checkAuth();
  if (token) {
    const username = await verifyToken(token);
    if (username) {
      usernameDisplay.textContent = sanitizeInput(username);
      dashboard.style.display = 'flex';
      authModal.classList.remove('active');
      loadDashboardData();
    }
  }

  addProductBtn.addEventListener('click', () => {
    if (isSiteLocked) return;
    addProductModal.classList.add('active');
  });

  productModalClose.addEventListener('click', () => {
    if (isSiteLocked) return;
    addProductModal.classList.remove('active');
  });

  authModalClose.addEventListener('click', () => {
    if (isSiteLocked) return;
    if (!checkAuth()) {
      authModal.classList.add('active');
    }
  });

  window.addEventListener('click', (e) => {
    if (isSiteLocked) return;
    if (e.target === addProductModal) {
      addProductModal.classList.remove('active');
    }
    if (e.target === authModal && !checkAuth()) {
      authModal.classList.add('active');
    }
  });

  toggleLink.addEventListener('click', (e) => {
    if (isSiteLocked) return;
    e.preventDefault();
    isSignup = !isSignup;
    authModalTitle.textContent = isSignup ? 'Sign Up' : 'Login';
    submitBtn.textContent = isSignup ? 'Sign Up' : 'Login';
    toggleForm.firstChild.textContent = isSignup ? 'Already have an account? ' : "Don't have an account? ";
    toggleLink.textContent = isSignup ? 'Login' : 'Sign Up';
    errorMessage.style.display = 'none';
  });

  authForm.addEventListener('submit', async (e) => {
    if (isSiteLocked) return;
    if (checkRequestFrequency()) return;
    e.preventDefault();
    errorMessage.style.display = 'none';
    const username = sanitizeInput(document.getElementById('username').value);
    const password = document.getElementById('password').value;

    const attempts = loginAttempts.get(username) || { count: 0, lastAttempt: 0 };
    const now = Date.now();
    if (attempts.count >= 2 && now - attempts.lastAttempt < LOCKOUT_DURATION) {
      lockSite(`multiple failed login attempts for ${username}`);
      errorMessage.textContent = 'Too many failed attempts. Site locked for 5 minutes.';
      errorMessage.style.display = 'block';
      return;
    }

    try {
      const endpoint = isSignup ? '/api/register' : '/api/login';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const result = await response.json();
      if (response.ok) {
        loginAttempts.delete(username); // Reset attempts on success
        localStorage.setItem('token', result.token);
        usernameDisplay.textContent = sanitizeInput(username);
        authModal.classList.remove('active');
        dashboard.style.display = 'flex';
        authForm.reset();
        checkSignupStatus();
        await loadDashboardData();
      } else {
        attempts.count = (attempts.count || 0) + 1;
        attempts.lastAttempt = now;
        loginAttempts.set(username, attempts);
        if (attempts.count >= 2) {
          lockSite(`multiple failed login attempts for ${username}`);
          errorMessage.textContent = 'Too many failed attempts. Site locked for 5 minutes.';
        } else {
          errorMessage.textContent = result.message || 'An error occurred';
        }
        errorMessage.style.display = 'block';
        logSuspiciousActivity(`Failed login attempt for ${username}`);
      }
    } catch (error) {
      console.error('Error during authentication:', error);
      attempts.count = (attempts.count || 0) + 1;
      attempts.lastAttempt = now;
      loginAttempts.set(username, attempts);
      if (attempts.count >= 2) {
        lockSite(`multiple failed login attempts for ${username}`);
        errorMessage.textContent = 'Too many failed attempts. Site locked for 5 minutes.';
      } else {
        errorMessage.textContent = 'Error: ' + error.message;
      }
      errorMessage.style.display = 'block';
      logSuspiciousActivity(`Authentication error for ${username}: ${error.message}`);
    }
  });
});

async function loadDashboardData() {
  if (isSiteLocked) return;
  await loadProducts();
  await loadOrders();
  updateStats();
  initCharts();
}

function updateStats() {
  if (isSiteLocked) return;
  const orders = JSON.parse(localStorage.getItem('orders')) || [];
  const totalRevenue = orders.reduce((sum, order) => {
    return sum + order.products.reduce((orderSum, product) => orderSum + product.price * (product.quantity || 1), 0);
  }, 0);
  document.getElementById('total-revenue').textContent = formatETB(totalRevenue);
  document.getElementById('total-orders').textContent = orders.length;
  const pendingOrders = orders.filter(order => order.state === 'Pending').length;
  document.getElementById('pending-orders').textContent = pendingOrders;
  const products = JSON.parse(localStorage.getItem('products')) || [];
  document.getElementById('total-products').textContent = products.length;
}

function initCharts() {
  if (isSiteLocked) return;
  const orders = JSON.parse(localStorage.getItem('orders')) || [];
  const salesCtx = document.getElementById('salesChart').getContext('2d');
  const last7Days = [...Array(7)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toISOString().split('T')[0];
  }).reverse();
  const salesData = last7Days.map(date => {
    const dayOrders = orders.filter(order => {
      const orderDate = new Date(order.createdAt).toISOString().split('T')[0];
      return orderDate === date;
    });
    return dayOrders.reduce((sum, order) => {
      return sum + order.products.reduce((orderSum, product) => orderSum + product.price * (product.quantity || 1), 0);
    }, 0);
  });
  if (salesChart) salesChart.destroy();
  salesChart = new Chart(salesCtx, {
    type: 'line',
    data: {
      labels: last7Days,
      datasets: [{
        label: 'Daily Sales (ETB)',
        data: salesData,
        borderColor: '#0f4c81',
        backgroundColor: 'rgba(15, 76, 129, 0.10)',
        borderWidth: 3,
        tension: 0.4,
        fill: true,
        pointBackgroundColor: '#ffe156',
        pointRadius: 6
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'top' },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `ETB ${context.parsed.y.toLocaleString('en-ET', { minimumFractionDigits: 2 })}`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return `ETB ${value.toLocaleString('en-ET', { minimumFractionDigits: 2 })}`;
            }
          }
        }
      }
    }
  });
  const orderStatusCtx = document.getElementById('orderStatusChart').getContext('2d');
  const statusCounts = orders.reduce((acc, order) => {
    acc[order.state] = (acc[order.state] || 0) + 1;
    return acc;
  }, {});
  const statusData = {
    labels: Object.keys(statusCounts),
    datasets: [{
      data: Object.values(statusCounts),
      backgroundColor: [
        'rgba(15, 76, 129, 0.75)',
        'rgba(16,185,129,0.80)',
        'rgba(245,158,66,0.80)',
        'rgba(239,68,68,0.80)'
      ],
      borderWidth: 2
    }]
  };
  if (orderStatusChart) orderStatusChart.destroy();
  orderStatusChart = new Chart(orderStatusCtx, {
    type: 'doughnut',
    data: statusData,
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom' } }
    }
  });
}

async function loadProducts() {
  if (isSiteLocked) return;
  if (checkRequestFrequency()) return;
  try {
    const token = checkAuth();
    if (!token) return;
    const response = await fetch('/api/products', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch products');
    }
    const products = await response.json();
    localStorage.setItem('products', JSON.stringify(products));
    const productsTable = document.getElementById('products-table');
    productsTable.innerHTML = '';
    if (Array.isArray(products)) {
      products.forEach(product => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><img src="${sanitizeInput(product.image)}" alt="${sanitizeInput(product.title)}" width="54"></td>
          <td>${sanitizeInput(product.title)}</td>
          <td>${sanitizeInput(product.description.substring(0, 50))}${product.description.length > 50 ? '...' : ''}</td>
          <td>${formatETB(product.price)}</td>
          <td>
            <input type="checkbox" class="sold-out-checkbox" 
                   ${product.soldOut ? 'checked' : ''} 
                   onchange="toggleSoldOut('${sanitizeInput(product._id)}', this.checked)">
            <span class="sold-out-label">${product.soldOut ? 'Sold Out' : 'Available'}</span>
          </td>
          <td>
            <button class="action-btn delete" onclick="deleteProduct('${sanitizeInput(product._id)}', '${sanitizeInput(product.public_id)}')">
              <i class="fas fa-trash"></i>
            </button>
          </td>
        `;
        productsTable.appendChild(tr);
      });
    } else {
      productsTable.innerHTML = `<tr><td colspan="6" style="color: red; text-align: center;">Error loading products: ${sanitizeInput(products.message || 'Unknown error')}</td></tr>`;
    }
  } catch (error) {
    console.error('Error loading products:', error);
    document.getElementById('products-table').innerHTML = `
      <tr><td colspan="6" style="color: red; text-align: center;">Error loading products: ${sanitizeInput(error.message)}</td></tr>
    `;
    if (error.message.includes('401') || error.message.includes('403')) {
      logSuspiciousActivity('Unauthorized access attempt to products');
      lockSite('unauthorized access detected');
    }
  }
}

async function toggleSoldOut(id, soldOut) {
  if (isSiteLocked) return;
  if (checkRequestFrequency()) return;
  try {
    const token = checkAuth();
    if (!token) return;
    const response = await fetch(`/api/products/${id}`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ soldOut })
    });
    if (response.ok) {
      await loadProducts();
      updateStats();
    } else {
      const result = await response.json();
      alert(sanitizeInput(result.message || 'Failed to update sold-out status'));
    }
  } catch (error) {
    console.error('Error updating sold-out status:', error);
    alert(sanitizeInput('Error updating sold-out status: ' + error.message));
    if (error.message.includes('401') || error.message.includes('403')) {
      logSuspiciousActivity('Unauthorized attempt to update product status');
      lockSite('unauthorized access detected');
    }
  }
}

async function addProduct() {
  if (isSiteLocked) return;
  if (checkRequestFrequency()) return;
  const token = checkAuth();
  if (!token) return;
  const title = sanitizeInput(document.getElementById('productTitle').value);
  const description = sanitizeInput(document.getElementById('productDescription').value);
  const price = document.getElementById('productPrice').value;
  const imageFile = document.getElementById('productImage').files[0];
  const soldOut = document.getElementById('productSoldOut').checked;
  if (!title || !description || !price || !imageFile) {
    alert('Please fill all fields and select an image');
    return;
  }
  try {
    const formData = new FormData();
    formData.append('title', title);
    formData.append('description', description);
    formData.append('price', price);
    formData.append('image', imageFile);
    formData.append('soldOut', soldOut);
    const response = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
    const result = await response.json();
    if (response.ok) {
      alert('Product added successfully');
      document.getElementById('productForm').reset();
      addProductModal.classList.remove('active');
      await loadProducts();
      updateStats();
    } else {
      alert(sanitizeInput(result.message || 'Failed to add product'));
    }
  } catch (error) {
    console.error('Error adding product:', error);
    alert(sanitizeInput('Error adding product: ' + error.message));
    if (error.message.includes('401') || error.message.includes('403')) {
      logSuspiciousActivity('Unauthorized attempt to add product');
      lockSite('unauthorized access detected');
    }
  }
}

async function deleteProduct(id, public_id) {
  if (isSiteLocked) return;
  if (checkRequestFrequency()) return;
  if (!confirm('Are you sure you want to delete this product?')) return;
  try {
    const token = checkAuth();
    if (!token) return;
    const response = await fetch(`/api/products/${id}`, {
      method: 'DELETE',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ public_id })
    });
    if (response.ok) {
      await loadProducts();
      updateStats();
    } else {
      const result = await response.json();
      alert(sanitizeInput(result.message || 'Failed to delete product'));
    }
  } catch (error) {
    console.error('Error deleting product:', error);
    alert(sanitizeInput('Error deleting product: ' + error.message));
    if (error.message.includes('401') || error.message.includes('403')) {
      logSuspiciousActivity('Unauthorized attempt to delete product');
      lockSite('unauthorized access detected');
    }
  }
}

async function loadOrders() {
  if (isSiteLocked) return;
  if (checkRequestFrequency()) return;
  try {
    const token = checkAuth();
    if (!token) return;
    const response = await fetch('/api/orders', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch orders');
    }
    const orders = await response.json();
    localStorage.setItem('orders', JSON.stringify(orders));
    const ordersTable = document.getElementById('orders-table');
    ordersTable.innerHTML = '';
    if (Array.isArray(orders)) {
      orders.forEach(order => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${sanitizeInput(order._id.substring(0, 8))}...</td>
          <td>
            <ul style="list-style: none; padding: 0; margin: 0;">
              ${order.products.map(p => `<li>${sanitizeInput(p.title)} (${formatETB(p.price)} x ${p.quantity || 1})</li>`).join('')}
            </ul>
          </td>
          <td>
            <div>Phone: ${sanitizeInput(order.phone)}</div>
            <div>City: ${sanitizeInput(order.city)}</div>
          </td>
          <td>${sanitizeInput(order.location)}</td>
          <td>
            <select class="form-control" onchange="updateOrderState('${sanitizeInput(order._id)}', this.value)" style="padding: 0.25rem;">
              <option value="Pending" ${order.state === 'Pending' ? 'selected' : ''}>Pending</option>
              <option value="Processing" ${order.state === 'Processing' ? 'selected' : ''}>Processing</option>
              <option value="Delivered" ${order.state === 'Delivered' ? 'selected' : ''}>Delivered</option>
              <option value="Cancelled" ${order.state === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
            </select>
          </td>
          <td>
            <button class="action-btn delete" onclick="deleteOrder('${sanitizeInput(order._id)}')">
              <i class="fas fa-trash"></i>
            </button>
          </td>
        `;
        ordersTable.appendChild(tr);
      });
    } else {
      ordersTable.innerHTML = `<tr><td colspan="6" style="color: red; text-align: center;">Error loading orders: ${sanitizeInput(orders.message || 'Unknown error')}</td></tr>`;
    }
  } catch (error) {
    console.error('Error loading orders:', error);
    document.getElementById('orders-table').innerHTML = `
      <tr><td colspan="6" style="color: red; text-align: center;">Error loading orders: ${sanitizeInput(error.message)}</td></tr>
    `;
    if (error.message.includes('401') || error.message.includes('403')) {
      logSuspiciousActivity('Unauthorized access attempt to orders');
      lockSite('unauthorized access detected');
    }
  }
}

async function updateOrderState(id, state) {
  if (isSiteLocked) return;
  if (checkRequestFrequency()) return;
  try {
    const token = checkAuth();
    if (!token) return;
    const response = await fetch(`/api/orders/${id}`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ state })
    });
    if (response.ok) {
      await loadOrders();
      updateStats();
      initCharts();
    } else {
      const result = await response.json();
      alert(sanitizeInput(result.message || 'Failed to update order status'));
    }
  } catch (error) {
    console.error('Error updating order state:', error);
    alert(sanitizeInput('Error updating order state: ' + error.message));
    if (error.message.includes('401') || error.message.includes('403')) {
      logSuspiciousActivity('Unauthorized attempt to update order state');
      lockSite('unauthorized access detected');
    }
  }
}

async function deleteOrder(id) {
  if (isSiteLocked) return;
  if (checkRequestFrequency()) return;
  if (!confirm('Are you sure you want to delete this order?')) return;
  try {
    const token = checkAuth();
    if (!token) return;
    const response = await fetch(`/api/orders/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (response.ok) {
      await loadOrders();
      updateStats();
      initCharts();
    } else {
      const result = await response.json();
      alert(sanitizeInput(result.message || 'Failed to delete order'));
    }
  } catch (error) {
    console.error('Error deleting order:', error);
    alert(sanitizeInput('Error deleting order: ' + error.message));
    if (error.message.includes('401') || error.message.includes('403')) {
      logSuspiciousActivity('Unauthorized attempt to delete order');
      lockSite('unauthorized access detected');
    }
  }
}

async function clearAllOrders() {
  if (isSiteLocked) return;
  if (checkRequestFrequency()) return;
  if (!confirm('Are you sure you want to clear ALL orders? This cannot be undone!')) return;
  try {
    const token = checkAuth();
    if (!token) return;
    const response = await fetch('/api/orders', {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (response.ok) {
      await loadOrders();
      updateStats();
      initCharts();
      alert('All orders have been cleared successfully');
    } else {
      const result = await response.json();
      alert(sanitizeInput(result.message || 'Failed to clear orders'));
    }
  } catch (error) {
    console.error('Error clearing orders:', error);
    alert(sanitizeInput('Error clearing orders: ' + error.message));
    if (error.message.includes('401') || error.message.includes('403')) {
      logSuspiciousActivity('Unauthorized attempt to clear orders');
      lockSite('unauthorized access detected');
    }
  }
}
