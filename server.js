const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const cors = require('cors');
const { sequelize } = require('./models/sequelize');
const videoRoutes = require('./routes/videoRoutes');
const authRoutes = require('./routes/authRoutes');
const renderQueue = require('./jobs/renderQueue');
const redisClient = require('./utils/redisClient');
const { errorHandler } = require('./middleware/errorMiddleware');
const apiLimiter = require('./middleware/rateLimiter');
const logger = require('./middleware/logger');

dotenv.config();

const app = express();

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(logger);
app.use(apiLimiter);
app.use(cors());

// Routes
app.use('/api/videos', videoRoutes);
app.use('/api/auth', authRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Global error handler
app.use(errorHandler);

(async () => {
  try {
    // Connect to PostgreSQL
    await sequelize.authenticate();
    console.log('Database connected');

    // Sync models
    await sequelize.sync();
    console.log('Models synchronized');

    // Redis connection handling
    redisClient.on('connect', () => console.log('Redis connected'));
    redisClient.on('error', (err) => console.error('Redis error:', err));
    redisClient.on('end', () => console.log('Redis connection closed.'));

    await redisClient.connect();

    // Start server
    app.listen(process.env.PORT, () => {
      console.log(`Server is running on port ${process.env.PORT}`);
    });
  } catch (error) {
    console.error('Unable to start server:', error);
    process.exit(1);
  }
})();

