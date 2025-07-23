// DOM Elements
const addProductBtn = document.getElementById('addProductBtn');
const addProductModal = document.getElementById('addProductModal');
const modalClose = document.querySelector('.modal-close');
const adminContact = document.getElementById('admin-contact');

// Charts
let salesChart, orderStatusChart;

// ETB Currency Format
function formatETB(amount) {
  return `ETB ${Number(amount).toLocaleString('en-ET', { minimumFractionDigits: 2 })}`;
}

// Initialize the dashboard
document.addEventListener('DOMContentLoaded', () => {
  // Set admin contact info
  adminContact.textContent = "Kirubel Mesfin | kirusu1.bm@gmail.com | +251911604204";
  
  // Load all data
  loadDashboardData();
  
  // Modal event listeners
  addProductBtn.addEventListener('click', () => {
    addProductModal.classList.add('active');
  });
  
  modalClose.addEventListener('click', () => {
    addProductModal.classList.remove('active');
  });
  
  // Close modal when clicking outside
  window.addEventListener('click', (e) => {
    if (e.target === addProductModal) {
      addProductModal.classList.remove('active');
    }
  });
});

// Load all dashboard data
async function loadDashboardData() {
  await loadProducts();
  await loadOrders();
  updateStats();
  initCharts();
}

// Update stats cards
function updateStats() {
  // Calculate total revenue
  const orders = JSON.parse(localStorage.getItem('orders')) || [];
  const totalRevenue = orders.reduce((sum, order) => {
    return sum + order.products.reduce((orderSum, product) => orderSum + product.price, 0);
  }, 0);

  document.getElementById('total-revenue').textContent = formatETB(totalRevenue);
  document.getElementById('total-orders').textContent = orders.length;
  
  // Calculate pending orders
  const pendingOrders = orders.filter(order => order.state === 'Pending').length;
  document.getElementById('pending-orders').textContent = pendingOrders;
  
  // Get total products
  const products = JSON.parse(localStorage.getItem('products')) || [];
  document.getElementById('total-products').textContent = products.length;
}

// Initialize charts
function initCharts() {
  const orders = JSON.parse(localStorage.getItem('orders')) || [];
  
  // Sales Chart (Line Chart)
  const salesCtx = document.getElementById('salesChart').getContext('2d');
  
  // Group orders by date for the last 7 days
  const last7Days = [...Array(7)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toISOString().split('T')[0];
  }).reverse();
  
  const salesData = last7Days.map(date => {
    const dayOrders = orders.filter(order => {
      const orderDate = new Date(order._id).toISOString().split('T')[0];
      return orderDate === date;
    });
    return dayOrders.reduce((sum, order) => {
      return sum + order.products.reduce((orderSum, product) => orderSum + product.price, 0);
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
        pointBackgroundColor: "#ffe156",
        pointRadius: 6
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'top',
        },
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
  
  // Order Status Chart (Doughnut Chart)
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
      plugins: {
        legend: {
          position: 'bottom',
        }
      }
    }
  });
}

// Load products
async function loadProducts() {
  try {
    const response = await fetch('/api/products');
    const products = await response.json();
    
    // Store products in localStorage for quick access
    localStorage.setItem('products', JSON.stringify(products));
    
    const productsTable = document.getElementById('products-table');
    productsTable.innerHTML = '';
    
    if (Array.isArray(products)) {
      products.forEach(product => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><img src="${product.image}" alt="${product.title}" width="54"></td>
          <td>${product.title}</td>
          <td>${product.description.substring(0, 50)}${product.description.length > 50 ? '...' : ''}</td>
          <td>${formatETB(product.price)}</td>
          <td>
            <input type="checkbox" class="sold-out-checkbox" 
                   ${product.soldOut ? 'checked' : ''} 
                   onchange="toggleSoldOut('${product._id}', this.checked)">
            <span class="sold-out-label">${product.soldOut ? 'Sold Out' : 'Available'}</span>
          </td>
          <td>
            <button class="action-btn delete" onclick="deleteProduct('${product._id}', '${product.public_id}')">
              <i class="fas fa-trash"></i>
            </button>
          </td>
        `;
        productsTable.appendChild(tr);
      });
    } else {
      productsTable.innerHTML = `<tr><td colspan="6" style="color: red; text-align: center;">Error loading products: ${products.message || 'Unknown error'}</td></tr>`;
    }
  } catch (error) {
    console.error('Error loading products:', error);
    document.getElementById('products-table').innerHTML = `
      <tr><td colspan="6" style="color: red; text-align: center;">Error loading products: ${error.message}</td></tr>
    `;
  }
}

// Toggle sold-out status
async function toggleSoldOut(id, soldOut) {
  try {
    const response = await fetch(`/api/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ soldOut })
    });
    
    if (response.ok) {
      await loadProducts();
      updateStats();
    } else {
      const result = await response.json();
      alert(result.message || 'Failed to update sold-out status');
    }
  } catch (error) {
    console.error('Error updating sold-out status:', error);
    alert('Error updating sold-out status: ' + error.message);
  }
}

// Add product
async function addProduct() {
  const title = document.getElementById('productTitle').value;
  const description = document.getElementById('productDescription').value;
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
      alert(result.message || 'Failed to add product');
    }
  } catch (error) {
    console.error('Error adding product:', error);
    alert('Error adding product: ' + error.message);
  }
}

// Delete product
async function deleteProduct(id, public_id) {
  if (!confirm('Are you sure you want to delete this product?')) return;
  
  try {
    const response = await fetch(`/api/products/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ public_id })
    });
    
    if (response.ok) {
      await loadProducts();
      updateStats();
    } else {
      const result = await response.json();
      alert(result.message || 'Failed to delete product');
    }
  } catch (error) {
    console.error('Error deleting product:', error);
    alert('Error deleting product: ' + error.message);
  }
}

// Load orders
async function loadOrders() {
  try {
    const response = await fetch('/api/orders');
    const orders = await response.json();
    
    // Store orders in localStorage for quick access
    localStorage.setItem('orders', JSON.stringify(orders));
    
    const ordersTable = document.getElementById('orders-table');
    ordersTable.innerHTML = '';
    
    if (Array.isArray(orders)) {
      orders.forEach(order => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${order._id.substring(0, 8)}...</td>
          <td>
            <ul style="list-style: none; padding: 0; margin: 0;">
              ${order.products.map(p => `<li>${p.title} (${formatETB(p.price)})</li>`).join('')}
            </ul>
          </td>
          <td>
            <div>Phone: ${order.phone}</div>
            <div>City: ${order.city}</div>
          </td>
          <td>${order.location}</td>
          <td>
            <select class="form-control" onchange="updateOrderState('${order._id}', this.value)" style="padding: 0.25rem;">
              <option value="Pending" ${order.state === 'Pending' ? 'selected' : ''}>Pending</option>
              <option value="Processing" ${order.state === 'Processing' ? 'selected' : ''}>Processing</option>
              <option value="Delivered" ${order.state === 'Delivered' ? 'selected' : ''}>Delivered</option>
              <option value="Cancelled" ${order.state === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
            </select>
          </td>
          <td>
            <button class="action-btn delete" onclick="deleteOrder('${order._id}')">
              <i class="fas fa-trash"></i>
            </button>
          </td>
        `;
        ordersTable.appendChild(tr);
      });
    } else {
      ordersTable.innerHTML = `<tr><td colspan="6" style="color: red; text-align: center;">Error loading orders: ${orders.message || 'Unknown error'}</td></tr>`;
    }
  } catch (error) {
    console.error('Error loading orders:', error);
    document.getElementById('orders-table').innerHTML = `
      <tr><td colspan="6" style="color: red; text-align: center;">Error loading orders: ${error.message}</td></tr>
    `;
  }
}

// Update order state
async function updateOrderState(id, state) {
  try {
    const response = await fetch(`/api/orders/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state })
    });
    
    if (response.ok) {
      await loadOrders();
      updateStats();
      initCharts();
    } else {
      const result = await response.json();
      alert(result.message || 'Failed to update order status');
    }
  } catch (error) {
    console.error('Error updating order state:', error);
    alert('Error updating order state: ' + error.message);
  }
}

// Delete single order
async function deleteOrder(id) {
  if (!confirm('Are you sure you want to delete this order?')) return;
  
  try {
    const response = await fetch(`/api/orders/${id}`, {
      method: 'DELETE'
    });
    
    if (response.ok) {
      await loadOrders();
      updateStats();
      initCharts();
    } else {
      const result = await response.json();
      alert(result.message || 'Failed to delete order');
    }
  } catch (error) {
    console.error('Error deleting order:', error);
    alert('Error deleting order: ' + error.message);
  }
}

// Clear all orders
async function clearAllOrders() {
  if (!confirm('Are you sure you want to clear ALL orders? This cannot be undone!')) return;
  
  try {
    // First get all order IDs
    const response = await fetch('/api/orders');
    const orders = await response.json();
    
    if (!Array.isArray(orders)) {
      throw new Error('Failed to fetch orders');
    }
    
    // Delete all orders one by one
    for (const order of orders) {
      await fetch(`/api/orders/${order._id}`, {
        method: 'DELETE'
      });
    }
    
    await loadOrders();
    updateStats();
    initCharts();
    alert('All orders have been cleared successfully');
  } catch (error) {
    console.error('Error clearing orders:', error);
    alert('Error clearing orders: ' + error.message);
  }
}
