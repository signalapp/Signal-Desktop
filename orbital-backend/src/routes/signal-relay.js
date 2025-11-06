const express = require('express');
const { authenticate } = require('../middleware/auth');
const { asyncHandler, validationError, forbiddenError } = require('../middleware/errorHandler');
const db = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * Signal Protocol Relay Endpoints
 *
 * These endpoints handle encrypted Signal Protocol message envelopes.
 * The server acts as a relay and CANNOT decrypt message contents.
 *
 * Protocol: Signal Protocol (Double Ratchet, X3DH)
 * Format: Protobuf-encoded encrypted envelopes
 */

/**
 * POST /v1/messages
 *
 * Send encrypted Signal Protocol message envelope
 *
 * Body:
 * {
 *   "conversation_id": "uuid (group_id)",
 *   "encrypted_envelope": "base64_encoded_protobuf",
 *   "timestamp": 1234567890000
 * }
 */
router.post('/messages', authenticate, asyncHandler(async (req, res) => {
  const { conversation_id, encrypted_envelope, timestamp } = req.body;

  // Validate required fields
  if (!conversation_id || !encrypted_envelope) {
    throw validationError('Missing required fields: conversation_id, encrypted_envelope');
  }

  // Validate envelope is base64
  if (typeof encrypted_envelope !== 'string') {
    throw validationError('encrypted_envelope must be a base64 string');
  }

  // Verify user is member of conversation/group
  const memberCheck = await db.query(
    'SELECT 1 FROM members WHERE group_id = $1 AND user_id = $2',
    [conversation_id, req.user.userId]
  );

  if (memberCheck.rowCount === 0) {
    logger.warn('Attempted to send message to non-member group', {
      userId: req.user.userId,
      conversationId: conversation_id
    });
    throw forbiddenError('Not a member of this conversation');
  }

  // Convert base64 envelope to binary
  const envelopeBuffer = Buffer.from(encrypted_envelope, 'base64');

  // Store encrypted envelope in database
  const result = await db.query(
    `INSERT INTO signal_messages (conversation_id, sender_uuid, encrypted_envelope, server_timestamp)
     VALUES ($1, $2, $3, NOW())
     RETURNING id, server_timestamp`,
    [conversation_id, req.user.userId, envelopeBuffer]
  );

  const message = result.rows[0];

  logger.logSignal('Message envelope stored', {
    messageId: message.id,
    conversationId: conversation_id,
    senderId: req.user.userId,
    envelopeSize: envelopeBuffer.length
  });

  // Return message ID and server timestamp
  res.status(200).json({
    message_id: message.id,
    server_timestamp: new Date(message.server_timestamp).getTime()
  });

  // TODO: Broadcast to WebSocket clients in conversation
  // This will be implemented in websocket/signalWebSocket.js
}));

/**
 * GET /v1/messages
 *
 * Fetch encrypted message envelopes for authenticated user
 *
 * Query params:
 * - since: Timestamp (fetch messages after this time)
 * - limit: Number of messages (default 100, max 500)
 * - conversation_id: Optional - filter by conversation
 */
router.get('/messages', authenticate, asyncHandler(async (req, res) => {
  const { since, limit = 100, conversation_id } = req.query;

  // Validate limit
  const messageLimit = Math.min(parseInt(limit, 10) || 100, 500);

  // Build query based on filters
  let query = `
    SELECT m.id, m.conversation_id, m.encrypted_envelope, m.server_timestamp
    FROM signal_messages m
    INNER JOIN members mem ON mem.group_id = m.conversation_id
    WHERE mem.user_id = $1
  `;

  const params = [req.user.userId];
  let paramIndex = 2;

  // Filter by timestamp
  if (since) {
    const sinceDate = new Date(parseInt(since, 10));
    query += ` AND m.server_timestamp > $${paramIndex}`;
    params.push(sinceDate);
    paramIndex++;
  }

  // Filter by conversation
  if (conversation_id) {
    query += ` AND m.conversation_id = $${paramIndex}`;
    params.push(conversation_id);
    paramIndex++;
  }

  // Order by timestamp and apply limit
  query += ` ORDER BY m.server_timestamp ASC LIMIT $${paramIndex}`;
  params.push(messageLimit);

  const result = await db.query(query, params);

  // Convert binary envelopes to base64
  const messages = result.rows.map(row => ({
    message_id: row.id,
    conversation_id: row.conversation_id,
    encrypted_envelope: row.encrypted_envelope.toString('base64'),
    server_timestamp: new Date(row.server_timestamp).getTime()
  }));

  logger.logSignal('Messages fetched', {
    userId: req.user.userId,
    count: messages.length,
    conversationId: conversation_id,
    since: since || 'beginning'
  });

  // Check if there are more messages
  const hasMore = messages.length === messageLimit;

  res.status(200).json({
    messages,
    has_more: hasMore
  });
}));

/**
 * DELETE /v1/messages/:messageId
 *
 * Delete a message (only sender can delete)
 * Note: This deletes the envelope, but clients should handle deletion
 * via Signal Protocol sealed sender
 */
router.delete('/messages/:messageId', authenticate, asyncHandler(async (req, res) => {
  const { messageId } = req.params;

  // Verify message exists and user is sender
  const result = await db.query(
    'DELETE FROM signal_messages WHERE id = $1 AND sender_uuid = $2 RETURNING id',
    [messageId, req.user.userId]
  );

  if (result.rowCount === 0) {
    logger.warn('Attempted to delete non-existent or unauthorized message', {
      userId: req.user.userId,
      messageId
    });
    throw forbiddenError('Cannot delete this message');
  }

  logger.logSignal('Message deleted', {
    messageId,
    userId: req.user.userId
  });

  res.status(204).send();
}));

/**
 * GET /v1/conversations/:conversationId/messages/count
 *
 * Get message count for a conversation
 */
router.get('/conversations/:conversationId/messages/count', authenticate, asyncHandler(async (req, res) => {
  const { conversationId } = req.params;

  // Verify user is member
  const memberCheck = await db.query(
    'SELECT 1 FROM members WHERE group_id = $1 AND user_id = $2',
    [conversationId, req.user.userId]
  );

  if (memberCheck.rowCount === 0) {
    throw forbiddenError('Not a member of this conversation');
  }

  // Get count
  const result = await db.query(
    'SELECT COUNT(*) as count FROM signal_messages WHERE conversation_id = $1',
    [conversationId]
  );

  res.status(200).json({
    conversation_id: conversationId,
    message_count: parseInt(result.rows[0].count, 10)
  });
}));

module.exports = router;
