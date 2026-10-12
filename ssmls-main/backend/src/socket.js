// socket.js — Real-time notification server
// Place in: backend/src/socket.js

const { pool } = require('./config/database');

// Map of userId → Set of socket IDs (user can have multiple tabs)
const userSockets = new Map();

const initSocket = (io) => {

  io.on('connection', (socket) => {
    const userId = socket.handshake.auth?.userId;
    if (!userId) { socket.disconnect(); return; }

    // Register socket for this user
    if (!userSockets.has(userId)) userSockets.set(userId, new Set());
    userSockets.get(userId).add(socket.id);

    console.log(`🔌 User ${userId} connected (socket: ${socket.id})`);

    // Send unread count on connect
    sendUnreadCount(userId, socket);

    // Mark notifications as read
    socket.on('mark_read', async (notifId) => {
      try {
        if (notifId === 'all') {
          await pool.query(`UPDATE notifications SET is_read = TRUE WHERE user_id = $1`, [userId]);
        } else {
          await pool.query(`UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2`, [notifId, userId]);
        }
        sendUnreadCount(userId, socket);
      } catch (err) { console.error('mark_read error:', err.message); }
    });

    // Disconnect
    socket.on('disconnect', () => {
      const sockets = userSockets.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) userSockets.delete(userId);
      }
      console.log(`🔌 User ${userId} disconnected`);
    });
  });
};

// Send real-time notification to specific user
const sendNotification = (userId, notification) => {
  const sockets = userSockets.get(String(userId));
  if (!sockets || sockets.size === 0) return;
  // Will be called with io instance
  global._io?.to([...sockets]).emit('notification', notification);
};

// Send unread count to user
const sendUnreadCount = async (userId, socket) => {
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = FALSE`,
      [userId]
    );
    socket.emit('unread_count', parseInt(rows[0].count));
  } catch (err) { console.error('sendUnreadCount error:', err.message); }
};

// Broadcast notification to multiple users (e.g. all admins)
const broadcastNotification = (userIds, notification) => {
  userIds.forEach(id => sendNotification(id, notification));
};

module.exports = { initSocket, sendNotification, broadcastNotification };
