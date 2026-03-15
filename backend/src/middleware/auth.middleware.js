const jwt    = require('jsonwebtoken');
const { pool } = require('../config/database');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer '))
      return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });

    const token = authHeader.slice(7); // faster than split
    if (!token || token.length < 20)
      return res.status(401).json({ success: false, message: 'Invalid token format.' });

    // Verify with issuer + audience checks
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
      issuer:     'ssmls-api',
      audience:   'ssmls-app',
    });

    if (!decoded.userId || !decoded.role)
      return res.status(401).json({ success: false, message: 'Malformed token.' });

    // Verify user still exists, is active, and role hasn't changed
    const [rows] = await pool.execute(
      `SELECT id, email, role, is_active FROM users WHERE id = ? AND is_active = 1`,
      [decoded.userId]
    );

    if (!rows.length)
      return res.status(401).json({ success: false, message: 'Account not found or deactivated.' });

    // Role tampering check — if token role differs from DB role, reject
    if (rows[0].role !== decoded.role)
      return res.status(401).json({ success: false, message: 'Token role mismatch. Please login again.' });

    req.user = rows[0];
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError')
      return res.status(401).json({ success: false, message: 'Session expired. Please login again.' });
    if (err.name === 'JsonWebTokenError')
      return res.status(401).json({ success: false, message: 'Invalid token.' });
    if (err.name === 'NotBeforeError')
      return res.status(401).json({ success: false, message: 'Token not yet valid.' });
    return res.status(401).json({ success: false, message: 'Authentication failed.' });
  }
};

const authorize = (...roles) => (req, res, next) => {
  if (!req.user)
    return res.status(401).json({ success: false, message: 'Not authenticated.' });
  if (!roles.includes(req.user.role))
    return res.status(403).json({ success: false, message: 'You do not have permission to perform this action.' });
  next();
};

module.exports = { authenticate, authorize };
