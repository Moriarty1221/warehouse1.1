require('dotenv').config();
require('express-async-errors');
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const warehouseRoutes = require('./routes/warehouses');
const productRoutes = require('./routes/products');
const categoryRoutes = require('./routes/categories');
const supplierRoutes = require('./routes/suppliers');
const stockRoutes = require('./routes/stock');
const receiptRoutes = require('./routes/receipts');
const issueRoutes = require('./routes/issues');
const userRoutes = require('./routes/users');
const reportRoutes = require('./routes/reports');
const systemRoutes = require('./routes/system');
const posRoutes = require('./routes/pos');
const transferRoutes = require('./routes/transfers');
const shiftRoutes = require('./routes/shifts');
const returnRoutes = require('./routes/returns');
const inventoryRoutes = require('./routes/inventory');
const { authenticate } = require('./middleware/auth');
const { checkDiskUsage } = require('./middleware/diskMonitor');

const app = express();

app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(checkDiskUsage);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);

app.use('/api/warehouses',  authenticate, warehouseRoutes);
app.use('/api/products',    authenticate, productRoutes);
app.use('/api/categories',  authenticate, categoryRoutes);
app.use('/api/suppliers',   authenticate, supplierRoutes);
app.use('/api/stock',       authenticate, stockRoutes);
app.use('/api/receipts',    authenticate, receiptRoutes);
app.use('/api/issues',      authenticate, issueRoutes);
app.use('/api/users',       authenticate, userRoutes);
app.use('/api/reports',     authenticate, reportRoutes);
app.use('/api/system',      authenticate, systemRoutes);
app.use('/api/pos',         authenticate, posRoutes);
app.use('/api/transfers',   authenticate, transferRoutes);
app.use('/api/shifts',      authenticate, shiftRoutes);
app.use('/api/returns',     authenticate, returnRoutes);
app.use('/api/inventory',   authenticate, inventoryRoutes);

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../frontend/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
  });
}

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Warehouse API running on port ${PORT}`);
});
