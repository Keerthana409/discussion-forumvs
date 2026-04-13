const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Environment selection
const dbUrl = process.env.MONGODB_URI_PROD || process.env.MONGODB_URI || process.env.MONGODB_URI_DEV;

// MongoDB Connection
mongoose.connect(dbUrl)
  .then(() => {
    const dbType = process.env.MONGODB_URI ? 'Production' : 'Development';
    console.log(`✅ Connected to MongoDB (${dbType} environment)`);
  })
  .catch(err => {
    console.error('❌ MongoDB Connection Error:', err.message);
  });

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/posts', require('./routes/posts'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/usage', require('./routes/usage'));
app.use('/api/notifications', require('./routes/notifications'));

// Root test route (IMPORTANT for Render health check)
app.get('/', (req, res) => {
  res.status(200).send('🚀 Backend API is running successfully');
});

// Handle unknown routes (optional but good)
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Start server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});