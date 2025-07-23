const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const dotenv = require('dotenv');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cors = require('cors');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB Atlas'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});
console.log('✅ Cloudinary configured');

// Cloudinary storage setup
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'ecommerce_products',
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp']
  }
});
const upload = multer({ storage });

// Schemas
const productSchema = new mongoose.Schema({
  title: String,
  description: String,
  price: Number,
  image: String,
  public_id: String,
  soldOut: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});
const orderSchema = new mongoose.Schema({
  products: [{ id: String, title: String, price: Number, quantity: Number }],
  phone: String,
  city: String,
  location: String,
  state: { type: String, default: 'Pending' },
  createdAt: { type: Date, default: Date.now }
});
const contactSchema = new mongoose.Schema({
  name: String,
  email: String,
  phone: String,
  message: String,
  createdAt: { type: Date, default: Date.now }
});

// Models
const Product = mongoose.model('Product', productSchema);
const Order = mongoose.model('Order', orderSchema);
const Contact = mongoose.model('Contact', contactSchema);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname), {
  setHeaders: (res, path) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  }
}));

// Routes for HTML pages
app.get('/', (req, res) => {
  res.redirect('/customer.html');
});

app.get('/owner.html', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(__dirname, 'owner.html'));
});

app.get('/customer.html', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(__dirname, 'customer.html'));
});

// ========== PRODUCT ROUTES ==========
app.post('/api/products', upload.single('image'), async (req, res) => {
  try {
    const { title, description, price, soldOut } = req.body;
    if (!title || !description || !price || !req.file) {
      return res.status(400).json({ message: 'All fields and image are required' });
    }

    const product = new Product({
      title,
      description,
      price: parseFloat(price),
      image: req.file.path,
      public_id: req.file.filename,
      soldOut: soldOut === 'true'
    });

    await product.save();
    res.status(201).json({ message: 'Product added successfully', product });
  } catch (error) {
    console.error('Error adding product:', error);
    res.status(500).json({ message: 'Server error', error });
  }
});

app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ message: 'Server error', error });
  }
});

app.put('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { soldOut } = req.body;
    await Product.findByIdAndUpdate(id, { soldOut });
    res.json({ message: 'Product status updated successfully' });
  } catch (error) {
    console.error('Error updating product status:', error);
    res.status(500).json({ message: 'Server error', error });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { public_id } = req.body;
    if (public_id) {
      await cloudinary.uploader.destroy(`ecommerce_products/${public_id}`);
    }
    await Product.findByIdAndDelete(id);
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ message: 'Server error', error });
  }
});

// ========== ORDER ROUTES ==========
app.post('/api/orders', async (req, res) => {
  try {
    const { products, phone, city, location } = req.body;
    if (!products || !phone || !city || !location) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const productIds = products.map(p => p.id).filter(id => id);
    if (productIds.length > 0) {
      const soldOutProducts = await Product.find({
        _id: { $in: productIds },
        soldOut: true
      });
      if (soldOutProducts.length > 0) {
        return res.status(400).json({
          message: 'Cannot place order: some products are sold out',
          soldOutProducts: soldOutProducts.map(p => p.title)
        });
      }
    }

    const order = new Order({ products, phone, city, location });
    await order.save();
    res.status(201).json({ message: 'Order placed successfully' });
  } catch (error) {
    console.error('Error placing order:', error);
    res.status(500).json({ message: 'Server error', error });
  }
});

app.get('/api/orders', async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ message: 'Server error', error });
  }
});

app.put('/api/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { state } = req.body;
    await Order.findByIdAndUpdate(id, { state });
    res.json({ message: 'Order state updated successfully' });
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(500).json({ message: 'Server error', error });
  }
});

app.delete('/api/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await Order.findByIdAndDelete(id);
    res.json({ message: 'Order deleted successfully' });
  } catch (error) {
    console.error('Error deleting order:', error);
    res.status(500).json({ message: 'Server error', error });
  }
});

app.delete('/api/orders', async (req, res) => {
  try {
    await Order.deleteMany({});
    res.json({ message: 'All orders cleared successfully' });
  } catch (error) {
    console.error('Error clearing orders:', error);
    res.status(500).json({ message: 'Server error', error });
  }
});

// ========== CONTACT ROUTES ==========
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, phone, message } = req.body;
    if (!name || !email || !phone || !message) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const contact = new Contact({ name, email, phone, message });
    await contact.save();
    res.status(201).json({ message: 'Contact message sent successfully' });
  } catch (error) {
    console.error('Error saving contact message:', error);
    res.status(500).json({ message: 'Server error', error });
  }
});

app.get('/api/superadmin/contacts', async (req, res) => {
  try {
    const contacts = await Contact.find().sort({ createdAt: -1 });
    res.json(contacts);
  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({ message: 'Server error', error });
  }
});

// ========== ANALYTICS ==========
app.get('/api/superadmin/analytics', async (req, res) => {
  try {
    const [totalProducts, totalOrders, pendingOrders, deliveredOrders, totalContacts] = await Promise.all([
      Product.countDocuments(),
      Order.countDocuments(),
      Order.countDocuments({ state: 'Pending' }),
      Order.countDocuments({ state: 'Delivered' }),
      Contact.countDocuments()
    ]);

    const revenue = await Order.aggregate([
      { $match: { state: 'Delivered' } },
      { $unwind: '$products' },
      { $group: { _id: null, total: { $sum: '$products.price' } } }
    ]);

    const monthlyRevenue = await Order.aggregate([
      { $match: { state: 'Delivered' } },
      { $unwind: '$products' },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          total: { $sum: '$products.price' }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 12 }
    ]);

    const recentOrders = await Order.find().sort({ createdAt: -1 }).limit(10);
    const recentProducts = await Product.find().sort({ createdAt: -1 }).limit(10);
    const recentContacts = await Contact.find().sort({ createdAt: -1 }).limit(10);

    res.json({
      stats: {
        totalProducts,
        totalOrders,
        pendingOrders,
        deliveredOrders,
        totalContacts,
        totalRevenue: revenue[0]?.total || 0
      },
      monthlyRevenue,
      recentOrders,
      recentProducts,
      recentContacts
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ message: 'Server error', error });
  }
});

// ========== SUPERADMIN ROUTES ==========
app.get('/api/superadmin/orders', async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ message: 'Server error', error });
  }
});

app.get('/api/superadmin/products', async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ message: 'Server error', error });
  }
});

app.get('/api/superadmin/contacts', async (req, res) => {
  try {
    const contacts = await Contact.find().sort({ createdAt: -1 });
    res.json(contacts);
  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({ message: 'Server error', error });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
