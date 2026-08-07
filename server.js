require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_for_dev_mode';

// Middleware
app.use(cors());
app.use(express.json());

// Log requests in development
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

// ----------------------------------------------------
// Authentication Middleware
// ----------------------------------------------------
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

// ----------------------------------------------------
// Authentication Endpoints
// ----------------------------------------------------

// Helper to compute TA profile type based on start date
function getTaType(startDateStr) {
  const today = new Date();
  const startDate = new Date(startDateStr);
  const trialEndDate = new Date(startDate);
  trialEndDate.setMonth(trialEndDate.getMonth() + 6);
  return today < trialEndDate ? 'new' : 'established';
}

app.post('/api/auth/register', async (req, res) => {
  const { username, password, firstName, lastName, startDate } = req.body;

  if (!username || !password || !firstName || !lastName || !startDate) {
    return res.status(400).json({ error: 'All fields are required (username, password, firstName, lastName, startDate)' });
  }

  if (username.length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    // Check if user already exists (case-insensitive check)
    const existingUser = await db.get('SELECT id FROM users WHERE LOWER(username) = ?', [username.toLowerCase()]);
    if (existingUser) {
      return res.status(409).json({ error: 'Username is already taken' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Insert user
    const result = await db.run(
      'INSERT INTO users (username, password_hash, first_name, last_name, start_date) VALUES (?, ?, ?, ?, ?)',
      [username, passwordHash, firstName, lastName, startDate]
    );

    const taType = getTaType(startDate);

    // Create token
    const token = jwt.sign(
      { id: result.id, username, firstName, lastName, startDate, taType },
      JWT_SECRET,
      { expiresIn: '30d' } // Long expiration for convenience
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: { id: result.id, username, firstName, lastName, startDate, taType }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    // Find user (case-insensitive)
    const user = await db.get('SELECT * FROM users WHERE LOWER(username) = ?', [username.toLowerCase()]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const taType = getTaType(user.start_date);

    // Create token
    const token = jwt.sign(
      { id: user.id, username: user.username, firstName: user.first_name, lastName: user.last_name, startDate: user.start_date, taType },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, username: user.username, firstName: user.first_name, lastName: user.last_name, startDate: user.start_date, taType }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get Current User Profile (Token check)
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await db.get('SELECT id, username, first_name, last_name, start_date, created_at FROM users WHERE id = ?', [req.user.id]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const taType = getTaType(user.start_date);
    
    res.json({
      id: user.id,
      username: user.username,
      firstName: user.first_name,
      lastName: user.last_name,
      startDate: user.start_date,
      taType,
      created_at: user.created_at
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ----------------------------------------------------
// Leave Management Endpoints
// ----------------------------------------------------

// Get Leaves
app.get('/api/leaves', authenticateToken, async (req, res) => {
  try {
    const leaves = await db.all('SELECT * FROM leaves WHERE user_id = ? ORDER BY date DESC', [req.user.id]);
    res.json(leaves);
  } catch (error) {
    console.error('Get leaves error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add Leave
app.post('/api/leaves', authenticateToken, async (req, res) => {
  const { date, type, reason } = req.body;

  if (!date || !type) {
    return res.status(400).json({ error: 'Date and leave type are required' });
  }

  // Validate date format YYYY-MM-DD
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) {
    return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
  }

  // Validate leave type
  if (!['sick', 'vacation', 'casual', 'other'].includes(type)) {
    return res.status(400).json({ error: 'Invalid leave type. Must be sick, vacation, casual, or other' });
  }

  try {
    // Check if the user already has leave on this day
    const existingLeave = await db.get('SELECT id FROM leaves WHERE user_id = ? AND date = ?', [req.user.id, date]);
    if (existingLeave) {
      return res.status(400).json({ error: 'You have already recorded a leave on this date' });
    }

    // Insert leave record
    const result = await db.run(
      'INSERT INTO leaves (user_id, date, type, reason) VALUES (?, ?, ?, ?)',
      [req.user.id, date, type, reason || '']
    );

    res.status(201).json({
      id: result.id,
      user_id: req.user.id,
      date,
      type,
      reason: reason || ''
    });
  } catch (error) {
    console.error('Add leave error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete Leave
app.delete('/api/leaves/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    // Check ownership
    const leave = await db.get('SELECT id FROM leaves WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (!leave) {
      return res.status(404).json({ error: 'Leave record not found or unauthorized' });
    }

    // Delete
    await db.run('DELETE FROM leaves WHERE id = ?', [id]);
    res.json({ message: 'Leave record deleted successfully', id: parseInt(id) });
  } catch (error) {
    console.error('Delete leave error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Lazy DB initialization middleware for serverless environments (Vercel)
let dbInitialized = false;
app.use(async (req, res, next) => {
  if (!dbInitialized) {
    try {
      await db.initialize();
      dbInitialized = true;
    } catch (err) {
      console.error('Lazy DB initialization error:', err);
    }
  }
  next();
});

// Serve Frontend Static Files in Production (Local / Docker)
const clientBuildPath = path.join(__dirname, 'client', 'dist');
app.use(express.static(clientBuildPath));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(path.join(clientBuildPath, 'index.html'), (err) => {
    if (err) {
      res.status(200).send('API is running. Frontend build is missing (run client build to test production serving).');
    }
  });
});

// Start Server locally if run directly
if (require.main === module) {
  async function startServer() {
    await db.initialize();
    dbInitialized = true;
    app.listen(PORT, () => {
      console.log(`==================================================`);
      console.log(` TA LEAVE TRACKER SERVER RUNNING`);
      console.log(` Port: ${PORT}`);
      console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(` Database: ${process.env.TURSO_DATABASE_URL ? 'Turso Cloud' : 'Local SQLite'}`);
      console.log(`==================================================`);
    });
  }

  startServer().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

module.exports = app;

