const express = require('express');
const { authenticate } = require('../middleware/auth');
const { asyncHandler, validationError, forbiddenError, notFoundError } = require('../middleware/errorHandler');
const db = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * Threading API Endpoints
 *
 * Manages discussion threads and replies within groups.
 * All content is encrypted client-side with group Sender Key (Signal Protocol).
 */

/**
 * POST /api/threads
 * Create new discussion thread
 */
router.post('/', authenticate, asyncHandler(async (req, res) => {
  const { group_id, encrypted_title, encrypted_body, root_message_id } = req.body;

  // Validate required fields
  if (!group_id || !encrypted_title || !encrypted_body) {
    throw validationError('Missing required fields: group_id, encrypted_title, encrypted_body');
  }

  // Verify user is member of group
  const memberCheck = await db.query(
    'SELECT 1 FROM members WHERE group_id = $1 AND user_id = $2',
    [group_id, req.user.userId]
  );

  if (memberCheck.rowCount === 0) {
    throw forbiddenError('Not a member of this group');
  }

  // Create thread (optionally linked to Signal message)
  const result = await db.query(
    `INSERT INTO threads (group_id, root_message_id, author_id, encrypted_title, encrypted_body)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, created_at`,
    [group_id, root_message_id || null, req.user.userId, encrypted_title, encrypted_body]
  );

  const thread = result.rows[0];

  logger.info('Thread created', {
    threadId: thread.id,
    groupId: group_id,
    authorId: req.user.userId
  });

  res.status(201).json({
    thread_id: thread.id,
    group_id: group_id,
    created_at: thread.created_at
  });

  // TODO: Broadcast to WebSocket clients in group
}));

/**
 * GET /api/groups/:groupId/threads
 * List threads in group (paginated)
 */
router.get('/groups/:groupId/threads', authenticate, asyncHandler(async (req, res) => {
  const { groupId } = req.params;
  const { limit = 50, offset = 0, sort = 'created_desc' } = req.query;

  // Verify user is member of group
  const memberCheck = await db.query(
    'SELECT 1 FROM members WHERE group_id = $1 AND user_id = $2',
    [groupId, req.user.userId]
  );

  if (memberCheck.rowCount === 0) {
    throw forbiddenError('Not a member of this group');
  }

  // Parse pagination
  const pageLimit = Math.min(parseInt(limit, 10) || 50, 100);
  const pageOffset = parseInt(offset, 10) || 0;

  // Determine sort order
  const sortOrder = sort === 'created_asc' ? 'ASC' : 'DESC';

  // Fetch threads with reply counts
  const result = await db.query(
    `SELECT
       t.id, t.group_id, t.author_id, t.encrypted_title, t.encrypted_body,
       t.created_at,
       u.username as author_username,
       COUNT(r.id) as reply_count
     FROM threads t
     LEFT JOIN users u ON u.id = t.author_id
     LEFT JOIN replies r ON r.thread_id = t.id
     WHERE t.group_id = $1
     GROUP BY t.id, u.username
     ORDER BY t.created_at ${sortOrder}
     LIMIT $2 OFFSET $3`,
    [groupId, pageLimit, pageOffset]
  );

  // Get total count
  const countResult = await db.query(
    'SELECT COUNT(*) as total FROM threads WHERE group_id = $1',
    [groupId]
  );

  const threads = result.rows.map(row => ({
    thread_id: row.id,
    group_id: row.group_id,
    author_id: row.author_id,
    author_username: row.author_username,
    encrypted_title: row.encrypted_title,
    encrypted_body: row.encrypted_body,
    reply_count: parseInt(row.reply_count, 10),
    created_at: row.created_at
  }));

  const totalCount = parseInt(countResult.rows[0].total, 10);
  const hasMore = pageOffset + pageLimit < totalCount;

  res.status(200).json({
    threads,
    total_count: totalCount,
    has_more: hasMore
  });
}));

/**
 * GET /api/threads/:threadId
 * Get single thread with details
 */
router.get('/:threadId', authenticate, asyncHandler(async (req, res) => {
  const { threadId } = req.params;

  // Fetch thread
  const result = await db.query(
    `SELECT t.id, t.group_id, t.author_id, t.encrypted_title, t.encrypted_body,
            t.created_at, u.username as author_username
     FROM threads t
     LEFT JOIN users u ON u.id = t.author_id
     WHERE t.id = $1`,
    [threadId]
  );

  if (result.rowCount === 0) {
    throw notFoundError('Thread not found');
  }

  const thread = result.rows[0];

  // Verify user is member of group
  const memberCheck = await db.query(
    'SELECT 1 FROM members WHERE group_id = $1 AND user_id = $2',
    [thread.group_id, req.user.userId]
  );

  if (memberCheck.rowCount === 0) {
    throw forbiddenError('Not a member of this group');
  }

  // Get reply count
  const countResult = await db.query(
    'SELECT COUNT(*) as count FROM replies WHERE thread_id = $1',
    [threadId]
  );

  res.status(200).json({
    thread_id: thread.id,
    group_id: thread.group_id,
    author_id: thread.author_id,
    author_username: thread.author_username,
    encrypted_title: thread.encrypted_title,
    encrypted_body: thread.encrypted_body,
    reply_count: parseInt(countResult.rows[0].count, 10),
    created_at: thread.created_at
  });
}));

/**
 * GET /api/threads/:threadId/replies
 * Get replies to thread
 */
router.get('/:threadId/replies', authenticate, asyncHandler(async (req, res) => {
  const { threadId } = req.params;
  const { limit = 50, offset = 0 } = req.query;

  // Verify thread exists and user has access
  const threadCheck = await db.query(
    `SELECT t.group_id FROM threads t WHERE t.id = $1`,
    [threadId]
  );

  if (threadCheck.rowCount === 0) {
    throw notFoundError('Thread not found');
  }

  const groupId = threadCheck.rows[0].group_id;

  // Verify membership
  const memberCheck = await db.query(
    'SELECT 1 FROM members WHERE group_id = $1 AND user_id = $2',
    [groupId, req.user.userId]
  );

  if (memberCheck.rowCount === 0) {
    throw forbiddenError('Not a member of this group');
  }

  // Parse pagination
  const pageLimit = Math.min(parseInt(limit, 10) || 50, 100);
  const pageOffset = parseInt(offset, 10) || 0;

  // Fetch replies
  const result = await db.query(
    `SELECT r.id, r.thread_id, r.author_id, r.encrypted_body, r.created_at,
            u.username as author_username
     FROM replies r
     LEFT JOIN users u ON u.id = r.author_id
     WHERE r.thread_id = $1
     ORDER BY r.created_at ASC
     LIMIT $2 OFFSET $3`,
    [threadId, pageLimit, pageOffset]
  );

  // Get total count
  const countResult = await db.query(
    'SELECT COUNT(*) as total FROM replies WHERE thread_id = $1',
    [threadId]
  );

  const replies = result.rows.map(row => ({
    reply_id: row.id,
    thread_id: row.thread_id,
    author_id: row.author_id,
    author_username: row.author_username,
    encrypted_body: row.encrypted_body,
    created_at: row.created_at
  }));

  const totalCount = parseInt(countResult.rows[0].total, 10);
  const hasMore = pageOffset + pageLimit < totalCount;

  res.status(200).json({
    replies,
    total_count: totalCount,
    has_more: hasMore
  });
}));

/**
 * POST /api/threads/:threadId/replies
 * Post reply to thread
 */
router.post('/:threadId/replies', authenticate, asyncHandler(async (req, res) => {
  const { threadId } = req.params;
  const { encrypted_body, message_id } = req.body;

  if (!encrypted_body) {
    throw validationError('Missing required field: encrypted_body');
  }

  // Verify thread exists and user has access
  const threadCheck = await db.query(
    'SELECT group_id FROM threads WHERE id = $1',
    [threadId]
  );

  if (threadCheck.rowCount === 0) {
    throw notFoundError('Thread not found');
  }

  const groupId = threadCheck.rows[0].group_id;

  // Verify membership
  const memberCheck = await db.query(
    'SELECT 1 FROM members WHERE group_id = $1 AND user_id = $2',
    [groupId, req.user.userId]
  );

  if (memberCheck.rowCount === 0) {
    throw forbiddenError('Not a member of this group');
  }

  // Create reply
  const result = await db.query(
    `INSERT INTO replies (thread_id, message_id, author_id, encrypted_body)
     VALUES ($1, $2, $3, $4)
     RETURNING id, created_at`,
    [threadId, message_id || null, req.user.userId, encrypted_body]
  );

  const reply = result.rows[0];

  logger.info('Reply created', {
    replyId: reply.id,
    threadId,
    authorId: req.user.userId
  });

  res.status(201).json({
    reply_id: reply.id,
    thread_id: threadId,
    created_at: reply.created_at
  });

  // TODO: Broadcast to WebSocket clients in group
}));

module.exports = router;
