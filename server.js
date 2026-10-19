require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');

if (!process.env.JWT_SECRET) {
  console.error('Missing JWT_SECRET. Copy .env.example to .env and set it.');
  process.exit(1);
}

const app = express();
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
const allowedOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(',')
  : true;
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.options('*', cors());
app.use(express.json({ limit: '50kb' }));
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));

app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/game', require('./routes/game'));
app.use('/api/questions', require('./routes/questions'));
app.use('/api/admin', require('./routes/admin'));

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api', (req, res) => res.status(404).json({ message: 'Not found' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.name === 'ValidationError') err.status = 400;
  if (err.name === 'CastError') {
    err.status = 400;
    err.message = 'Invalid id';
  }
  if (!err.status) console.error(err);
  res.status(err.status || 500).json({ message: err.status ? err.message : 'Something went wrong' });
});

let dbReady = false;
const ensureDB = async () => {
  if (!dbReady) {
    await connectDB();
    dbReady = true;
  }
};

// Serverless export for Vercel
module.exports = async (req, res) => {
  await ensureDB();
  app(req, res);
};

// Local dev
if (require.main === module) {
  const port = process.env.PORT || 5000;
  connectDB()
    .then(() => app.listen(port, () => console.log(`API running on http://localhost:${port}`)))
    .catch((e) => { console.error('Could not connect to MongoDB:', e.message); process.exit(1); });
}
