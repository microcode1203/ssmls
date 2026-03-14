require('dotenv').config();
const app = require('./app');
const { testConnection } = require('./config/database');

const PORT = process.env.PORT || 5000;

async function startServer() {
  // Test DB connection
  const connected = await testConnection();
  if (!connected) {
    console.error('❌ Cannot connect to MySQL. Check your .env settings.');
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`\n🚀 SSMLS Backend running on port ${PORT}`);
    console.log(`📡 Environment: ${process.env.NODE_ENV}`);
    console.log(`🔗 API Base: http://localhost:${PORT}/api`);
    console.log(`💾 Database: ${process.env.DB_NAME}@${process.env.DB_HOST}\n`);
  });
}

startServer();
