const { pool } = require('../config/database');

const logAction = async (userId, action, entity = null, entityId = null, details = null, ip = null) => {
  try {
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, entity, entity_id, details, ip_address) VALUES ($1,$2,$3,$4,$5,$6)`,
      [userId, action, entity, entityId || null, details ? JSON.stringify(details) : null, ip || null]
    );
  } catch (err) {
    // Non-critical — don't crash the app if logging fails
    console.error('Audit log error:', err.message);
  }
};

module.exports = { logAction };
