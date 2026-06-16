const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3666;
const API_KEY = process.env.UPLOAD_API_KEY || 'uber3ats_d3fault_k3y';

app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// API: get all orders
app.get('/api/orders', (req, res) => {
  const jsonPath = path.join(__dirname, 'data', 'orders.json');
  try {
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Orders data not available yet.' });
  }
});

// API: upload orders data (called by local cron)
app.post('/api/upload', (req, res) => {
  const key = req.headers['x-api-key'];
  if (key !== API_KEY) return res.status(401).json({ error: 'Unauthorized' });

  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  fs.writeFileSync(path.join(dataDir, 'orders.json'), JSON.stringify(req.body, null, 2), 'utf-8');
  console.log(`✅ Orders data updated: ${req.body.length} orders`);
  res.json({ success: true, count: req.body.length });
});

// API: get summary stats
app.get('/api/stats', (req, res) => {
  const jsonPath = path.join(__dirname, 'data', 'orders.json');
  try {
    const orders = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    
    const total = orders.length;
    const totalAmount = orders.reduce((s, o) => s + (o.total || 0), 0);
    const totalDiscount = orders.reduce((s, o) => s + (o.discount || 0), 0);
    const restaurants = new Set(orders.map(o => o.restaurant)).size;
    
    const categories = {};
    for (const o of orders) {
      const cat = o.category || '其他';
      if (!categories[cat]) categories[cat] = { count: 0, total: 0 };
      categories[cat].count++;
      categories[cat].total += o.total || 0;
    }
    
    const dates = orders.filter(o => o.date).map(o => o.date).sort();
    const dateRange = dates.length > 0 
      ? { from: dates[0], to: dates[dates.length - 1] }
      : { from: null, to: null };
    
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthOrders = orders.filter(o => o.date && o.date.startsWith(thisMonth));
    const monthTotal = monthOrders.reduce((s, o) => s + (o.total || 0), 0);
    
    res.json({
      total, totalAmount, totalDiscount, restaurants,
      categories, dateRange,
      thisMonth: { month: thisMonth, count: monthOrders.length, total: monthTotal }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Uber Eats Orders running on port ${PORT}`);
  if (fs.existsSync(path.join(__dirname, 'data', 'orders.json'))) {
    const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'orders.json'), 'utf-8'));
    console.log(`   Loaded ${data.length} orders`);
  }
});