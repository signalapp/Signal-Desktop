const WebSocket = require('ws');
const url = require('url');
const { verifyToken } = require('../middleware/auth');
const logger = require('../utils/logger');

/**
 * WebSocket Server for Real-Time Signal Protocol Message Delivery
 *
 * Handles persistent connections for instant message delivery
 * Compatible with Signal Protocol WebSocket format
 */

// Store active connections: userId -> Set of WebSocket clients
const activeConnections = new Map();

/**
 * Initialize WebSocket server
 * @param {Object} server - HTTP server instance
 * @returns {WebSocket.Server} WebSocket server instance
 */
function initWebSocketServer(server) {
  const wss = new WebSocket.Server({
    server,
    path: '/v1/websocket',
    // Verify client before upgrade
    verifyClient: async (info, callback) => {
      try {
        // Extract token from query parameter or upgrade header
        const query = url.parse(info.req.url, true).query;
        const token = query.token || extractTokenFromHeader(info.req);

        if (!token) {
          logger.warn('WebSocket connection rejected: No token provided', {
            ip: info.req.socket.remoteAddress
          });
          return callback(false, 401, 'Unauthorized');
        }

        // Verify JWT token
        const decoded = verifyToken(token);

        // Attach user info to request for later use
        info.req.user = {
          userId: decoded.userId,
          username: decoded.username
        };

        callback(true);
      } catch (error) {
        logger.warn('WebSocket connection rejected: Invalid token', {
          error: error.message,
          ip: info.req.socket.remoteAddress
        });
        callback(false, 401, 'Unauthorized');
      }
    }
  });

  // Handle new WebSocket connections
  wss.on('connection', (ws, req) => {
    const user = req.user;

    logger.logWebSocket('Client connected', {
      userId: user.userId,
      username: user.username,
      ip: req.socket.remoteAddress
    });

    // Add connection to active connections map
    if (!activeConnections.has(user.userId)) {
      activeConnections.set(user.userId, new Set());
    }
    activeConnections.get(user.userId).add(ws);

    // Attach user info to WebSocket
    ws.userId = user.userId;
    ws.username = user.username;
    ws.isAlive = true;

    // Send connection acknowledgment
    ws.send(JSON.stringify({
      type: 'connection_ack',
      timestamp: Date.now()
    }));

    // Handle incoming messages from client
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        handleClientMessage(ws, message);
      } catch (error) {
        logger.error('WebSocket message parse error', {
          error: error.message,
          userId: ws.userId
        });
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Invalid message format'
        }));
      }
    });

    // Handle pong responses (keepalive)
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // Handle connection close
    ws.on('close', (code, reason) => {
      logger.logWebSocket('Client disconnected', {
        userId: ws.userId,
        code,
        reason: reason.toString()
      });

      // Remove from active connections
      const userConnections = activeConnections.get(ws.userId);
      if (userConnections) {
        userConnections.delete(ws);
        if (userConnections.size === 0) {
          activeConnections.delete(ws.userId);
        }
      }
    });

    // Handle errors
    ws.on('error', (error) => {
      logger.error('WebSocket error', {
        error: error.message,
        userId: ws.userId
      });
    });
  });

  // Heartbeat interval to detect dead connections
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        logger.logWebSocket('Terminating dead connection', {
          userId: ws.userId
        });
        return ws.terminate();
      }

      ws.isAlive = false;
      ws.ping();
    });
  }, 30000); // Check every 30 seconds

  // Clean up on server close
  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  logger.info('WebSocket server initialized', {
    path: '/v1/websocket'
  });

  return wss;
}

/**
 * Handle messages from client
 */
function handleClientMessage(ws, message) {
  const { type, data } = message;

  logger.logWebSocket('Client message received', {
    type,
    userId: ws.userId
  });

  switch (type) {
    case 'ping':
      ws.send(JSON.stringify({
        type: 'pong',
        timestamp: Date.now()
      }));
      break;

    case 'subscribe':
      // Client subscribes to conversation updates
      // (In full implementation, track subscriptions)
      ws.send(JSON.stringify({
        type: 'subscribed',
        conversation_id: data.conversation_id
      }));
      break;

    case 'typing':
      // Broadcast typing indicator to conversation members
      // (Stub for now)
      logger.debug('Typing indicator received', {
        userId: ws.userId,
        conversationId: data.conversation_id
      });
      break;

    default:
      logger.warn('Unknown WebSocket message type', {
        type,
        userId: ws.userId
      });
  }
}

/**
 * Extract token from Authorization header
 */
function extractTokenFromHeader(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}

/**
 * Broadcast new message to all members of a conversation
 * @param {string} conversationId - Group/conversation ID
 * @param {Array<string>} memberIds - Array of user IDs
 * @param {Object} messageData - Message data to broadcast
 */
function broadcastToConversation(conversationId, memberIds, messageData) {
  let deliveredCount = 0;

  memberIds.forEach((userId) => {
    const userConnections = activeConnections.get(userId);
    if (userConnections && userConnections.size > 0) {
      const payload = JSON.stringify({
        type: 'new_message',
        conversation_id: conversationId,
        data: messageData,
        timestamp: Date.now()
      });

      userConnections.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(payload);
          deliveredCount++;
        }
      });
    }
  });

  logger.logWebSocket('Message broadcast', {
    conversationId,
    targetMembers: memberIds.length,
    delivered: deliveredCount
  });

  return deliveredCount;
}

/**
 * Send event to specific user (all their connections)
 * @param {string} userId - User ID
 * @param {Object} eventData - Event data to send
 */
function sendToUser(userId, eventData) {
  const userConnections = activeConnections.get(userId);
  if (!userConnections || userConnections.size === 0) {
    return 0;
  }

  const payload = JSON.stringify(eventData);
  let sentCount = 0;

  userConnections.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
      sentCount++;
    }
  });

  return sentCount;
}

/**
 * Get active connection count
 */
function getActiveConnectionCount() {
  let total = 0;
  activeConnections.forEach((connections) => {
    total += connections.size;
  });
  return total;
}

/**
 * Get unique user count
 */
function getActiveUserCount() {
  return activeConnections.size;
}

/**
 * Check if user is online
 */
function isUserOnline(userId) {
  return activeConnections.has(userId);
}

module.exports = {
  initWebSocketServer,
  broadcastToConversation,
  sendToUser,
  getActiveConnectionCount,
  getActiveUserCount,
  isUserOnline
};
