process.env.TZ = 'Asia/Jakarta';
require('dotenv').config();
const app = require('./src/app');
const { initDatabase } = require('./src/db');

const PORT = process.env.PORT || 4000;

async function startServer() {
  try {
    console.log('[SYSTEM] Initializing database...');
    await initDatabase();
    console.log('[SYSTEM] Database initialized successfully.');

    app.listen(PORT, () => {
      console.log(`===============================================`);
      console.log(`🚀 Kassa POS API is running on port ${PORT}`);
      console.log(`📍 Health Check: http://localhost:${PORT}/api/health`);
      console.log(`===============================================`);
    });
  } catch (err) {
    console.error('Fatal error starting server:', err);
    process.exit(1);
  }
}

startServer();
