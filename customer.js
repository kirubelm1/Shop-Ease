let cart = [];
let products = [];

// DOM Elements
const productsContainer = document.getElementById('products');
const cartModal = document.getElementById('cartModal');
const cartItemsContainer = document.getElementById('cartItems');
const cartCountElement = document.getElementById('cartCount');
const cartTotalSection = document.getElementById('cartTotal');
const checkoutFormSection = document.getElementById('checkoutForm');
const overlay = document.getElementById('overlay');
const cartIcon = document.getElementById('cartIcon');
const closeCartBtn = document.getElementById('closeCart');
const checkoutBtn = document.getElementById('checkoutBtn');
const searchInput = document.getElementById('searchInput');
const productDetailsModal = document.getElementById('productDetailsModal');
const closeProductDetailsBtn = document.getElementById('closeProductDetails');
const productDetailsContent = document.getElementById('productDetailsContent');

// Event Listeners
cartIcon.addEventListener('click', openCartModal);
closeCartBtn.addEventListener('click', closeCartModal);
overlay.addEventListener('click', closeModals);
checkoutBtn.addEventListener('click', showCheckoutForm);
searchInput.addEventListener('input', filterProducts);
closeProductDetailsBtn.addEventListener('click', closeProductDetailsModal);

// Load products when page loads
document.addEventListener('DOMContentLoaded', loadProducts);

// Preload images to prevent white flashes
function preloadImages(products) {
  products.forEach(product => {
    const img = new Image();
    img.src = product.image;
  });
}

// Load products from API
async function loadProducts() {
  try {
    const response = await fetch('/api/products');
    products = await response.json();
    preloadImages(products); // Preload images
    displayProducts(products);
  } catch (error) {
    console.error('Error loading products:', error);
    productsContainer.innerHTML = '<p class="error-message">Failed to load products. Please try again later.</p>';
  }
}

// Display products in the grid
function displayProducts(productsToDisplay) {
  productsContainer.innerHTML = '';
  
  if (productsToDisplay.length === 0) {
    productsContainer.innerHTML = '<p class="no-results">No products found matching your search.</p>';
    return;
  }
  
  productsToDisplay.forEach(product => {
    const productCard = document.createElement('div');
    productCard.className = 'product-card';
    productCard.addEventListener('click', () => showProductDetails(product));
    productCard.innerHTML = `
      <div class="product-image">
        <img src="${product.image}" alt="${product.title}" loading="lazy">
        ${product.badge ? `<span class="product-badge">${product.badge}</span>` : ''}
      </div>
      <div class="product-info">
        <h3 class="product-title">${product.title}</h3>
        <div class="product-price">ETB ${product.price.toFixed(2)}</div>
        ${product.soldOut ? '<div class="sold-out">Sold Out</div>' : ''}
        <div class="product-rating">
          ${generateStarRating(product.rating || 4)}
        </div>
        <button class="add-to-cart" 
                ${product.soldOut ? 'disabled' : ''} 
                onclick="event.stopPropagation(); addToCart('${product._id || product.title}', '${product.title}', ${product.price}, '${product.image}', ${product.soldOut})">
          <i class="fas fa-shopping-cart"></i> Add to Cart
        </button>
      </div>
    `;
    productsContainer.appendChild(productCard);
  });
}

// Generate star rating HTML
function generateStarRating(rating) {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  let stars = '';
  
  for (let i = 0; i < fullStars; i++) {
    stars += '<i class="fas fa-star"></i>';
  }
  
  if (hasHalfStar) {
    stars += '<i class="fas fa-star-half-alt"></i>';
  }
  
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
  for (let i = 0; i < emptyStars; i++) {
    stars += '<i class="far fa-star"></i>';
  }
  
  return stars;
}

// Filter products based on search input
function filterProducts() {
  const searchTerm = searchInput.value.toLowerCase();
  const filteredProducts = products.filter(product => 
    product.title.toLowerCase().includes(searchTerm) ||
    (product.description && product.description.toLowerCase().includes(searchTerm))
  );
  displayProducts(filteredProducts);
}

// Show product details modal
function showProductDetails(product) {
  productDetailsContent.innerHTML = `
    <div class="product-details-image">
      <img src="${product.image}" alt="${product.title}">
    </div>
    <h3 class="product-details-title">${product.title}</h3>
    <div class="product-details-price">ETB ${product.price.toFixed(2)}</div>
    ${product.soldOut ? '<div class="sold-out">Sold Out</div>' : ''}
    <div class="product-details-description">${product.description || 'No description available'}</div>
    <button class="add-to-cart" 
            ${product.soldOut ? 'disabled' : ''} 
            onclick="addToCart('${product._id || product.title}', '${product.title}', ${product.price}, '${product.image}', ${product.soldOut})">
      <i class="fas fa-shopping-cart"></i> Add to Cart
    </button>
  `;
  productDetailsModal.classList.add('open');
  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

// Close product details modal
function closeProductDetailsModal() {
  productDetailsModal.classList.remove('open');
  overlay.classList.remove('active');
  document.body.style.overflow = '';
}

// Close all modals when clicking overlay
function closeModals(e) {
  if (e.target === overlay) {
    closeCartModal();
    closeProductDetailsModal();
  }
}

// Add item to cart
function addToCart(id, title, price, image, soldOut) {
  if (soldOut) {
    alert('This product is sold out and cannot be added to the cart.');
    return;
  }
  
  const existingItem = cart.find(item => item.id === id);
  
  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cart.push({
      id,
      title,
      price,
      image,
      quantity: 1
    });
  }
  
  updateCart();
  showCartNotification(title);
}

// Show notification when item is added to cart
function showCartNotification(productName) {
  const notification = document.createElement('div');
  notification.className = 'cart-notification';
  notification.innerHTML = `
    <i class="fas fa-check-circle"></i>
    <span>${productName} added to cart</span>
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.classList.add('show');
  }, 10);
  
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 300);
  }, 3000);
}

// Remove item from cart
function removeFromCart(index) {
  cart.splice(index, 1);
  updateCart();
}

// Update quantity of item in cart
function updateCartItemQuantity(index, newQuantity) {
  if (newQuantity < 1) return;
  
  cart[index].quantity = newQuantity;
  updateCart();
}

// Update cart UI
function updateCart() {
  // Update cart count
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  cartCountElement.textContent = totalItems;
  
  // Update cart items list
  if (cart.length === 0) {
    cartItemsContainer.innerHTML = `
      <div class="empty-cart-message" style="text-align: center; padding: 40px 0;">
        <i class="fas fa-shopping-bag" style="font-size: 40px; color: #ddd; margin-bottom: 15px;"></i>
        <h4>Your bag is empty</h4>
        <p>Start shopping to add items to your bag</p>
      </div>
    `;
    cartTotalSection.style.display = 'none';
    checkoutFormSection.style.display = 'none';
  } else {
    cartItemsContainer.innerHTML = '';
    cart.forEach((item, index) => {
      const cartItem = document.createElement('div');
      cartItem.className = 'cart-item';
      cartItem.innerHTML = `
        <div class="cart-item-img">
          <img src="${item.image}" alt="${item.title}">
        </div>
        <div class="cart-item-details">
          <div class="cart-item-title">${item.title}</div>
          <div class="cart-item-price">ETB ${(item.price * item.quantity).toFixed(2)}</div>
          <div class="quantity-controls" style="display: flex; align-items: center; margin-top: 8px;">
            <button onclick="updateCartItemQuantity(${index}, ${item.quantity - 1})" style="background: none; border: 1px solid #ddd; width: 25px; height: 25px; border-radius: 5px 0 0 5px; cursor: pointer;">-</button>
            <span style="padding: 0 10px; border-top: 1px solid #ddd; border-bottom: 1px solid #ddd; height: 25px; display: flex; align-items: center; font-size: 13px;">${item.quantity}</span>
            <button onclick="updateCartItemQuantity(${index}, ${item.quantity + 1})" style="background: none; border: 1px solid #ddd; width: 25px; height: 25px; border-radius: 0 5px 5px 0; cursor: pointer;">+</button>
          </div>
        </div>
        <div class="remove-item" onclick="removeFromCart(${index})">
          <i class="fas fa-times"></i>
        </div>
      `;
      cartItemsContainer.appendChild(cartItem);
    });
    
    // Update totals
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    document.getElementById('subtotal').textContent = `ETB ${subtotal.toFixed(2)}`;
    document.getElementById('total').textContent = `ETB ${subtotal.toFixed(2)}`;
    
    cartTotalSection.style.display = 'block';
    checkoutFormSection.style.display = 'none';
  }
}

// Open cart modal
function openCartModal() {
  cartModal.classList.add('open');
  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

// Close cart modal
function closeCartModal() {
  cartModal.classList.remove('open');
  overlay.classList.remove('active');
  document.body.style.overflow = '';
}

// Show checkout form
function showCheckoutForm() {
  cartTotalSection.style.display = 'none';
  checkoutFormSection.style.display = 'block';
}

// Place order
async function placeOrder() {
  const phone = document.getElementById('phone').value;
  const city = document.getElementById('city').value;
  const location = document.getElementById('location').value;
  
  if (!phone || !city || !location) {
    alert('Please fill in all shipping information fields');
    return;
  }
  
  try {
    const order = { 
      products: cart.map(item => ({
        id: item.id, // Include product ID for sold-out check
        title: item.title,
        price: item.price,
        quantity: item.quantity
      })), 
      phone, 
      city, 
      location 
    };
    
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order)
    });
    
    const result = await response.json();
    
    if (response.ok) {
      // Show success message
      const successMessage = document.createElement('div');
      successMessage.className = 'cart-notification success';
      successMessage.innerHTML = `
        <i class="fas fa-check-circle"></i>
        <span>Order placed successfully!</span>
      `;
      
      document.body.appendChild(successMessage);
      
      setTimeout(() => {
        successMessage.classList.add('show');
      }, 10);
      
      setTimeout(() => {
        successMessage.classList.remove('show');
        setTimeout(() => {
          document.body.removeChild(successMessage);
        }, 300);
      }, 3000);
      
      // Reset cart and close modal
      cart = [];
      updateCart();
      closeCartModal();
      
      // Clear form fields
      document.getElementById('phone').value = '';
      document.getElementById('city').value = '';
      document.getElementById('location').value = '';
    } else {
      if (result.soldOutProducts) {
        alert(`Cannot place order: The following products are sold out: ${result.soldOutProducts.join(', ')}`);
      } else {
        throw new Error(result.message || 'Failed to place order');
      }
    }
  } catch (error) {
    console.error('Error placing order:', error);
    alert('Failed to place order: ' + error.message);
  }
}
