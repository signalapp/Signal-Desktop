const express = require('express');
const { authenticate } = require('../middleware/auth');
const { asyncHandler, validationError, forbiddenError, notFoundError, conflictError } = require('../middleware/errorHandler');
const db = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * Group Management API Endpoints
 *
 * Handles group creation, joining via invite codes, and member management.
 */

/**
 * Generate random 8-character alphanumeric invite code
 */
function generateInviteCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * POST /api/groups
 * Create new group with invite code
 */
router.post('/', authenticate, asyncHandler(async (req, res) => {
  const { encrypted_name, encrypted_group_key } = req.body;

  if (!encrypted_name || !encrypted_group_key) {
    throw validationError('Missing required fields: encrypted_name, encrypted_group_key');
  }

  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    // Generate unique invite code
    let inviteCode;
    let attempts = 0;
    while (attempts < 10) {
      inviteCode = generateInviteCode();
      const existing = await client.query(
        'SELECT 1 FROM groups WHERE invite_code = $1',
        [inviteCode]
      );
      if (existing.rowCount === 0) break;
      attempts++;
    }

    if (attempts === 10) {
      throw new Error('Failed to generate unique invite code');
    }

    // Create group
    const groupResult = await client.query(
      `INSERT INTO groups (encrypted_name, created_by, invite_code)
       VALUES ($1, $2, $3)
       RETURNING id, created_at`,
      [encrypted_name, req.user.userId, inviteCode]
    );

    const group = groupResult.rows[0];

    // Add creator as first member
    await client.query(
      `INSERT INTO members (group_id, user_id, encrypted_group_key)
       VALUES ($1, $2, $3)`,
      [group.id, req.user.userId, encrypted_group_key]
    );

    // Initialize group quota
    await client.query(
      `INSERT INTO group_quotas (group_id, total_bytes, media_count)
       VALUES ($1, 0, 0)`,
      [group.id]
    );

    await client.query('COMMIT');

    logger.info('Group created', {
      groupId: group.id,
      creatorId: req.user.userId,
      inviteCode
    });

    res.status(201).json({
      group_id: group.id,
      invite_code: inviteCode,
      created_at: group.created_at
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

/**
 * POST /api/groups/join
 * Join existing group via invite code
 */
router.post('/join', authenticate, asyncHandler(async (req, res) => {
  const { invite_code, encrypted_group_key } = req.body;

  if (!invite_code || !encrypted_group_key) {
    throw validationError('Missing required fields: invite_code, encrypted_group_key');
  }

  // Find group by invite code
  const groupResult = await db.query(
    'SELECT id, encrypted_name FROM groups WHERE invite_code = $1',
    [invite_code]
  );

  if (groupResult.rowCount === 0) {
    throw notFoundError('Invalid invite code');
  }

  const group = groupResult.rows[0];

  // Check if already member
  const memberCheck = await db.query(
    'SELECT 1 FROM members WHERE group_id = $1 AND user_id = $2',
    [group.id, req.user.userId]
  );

  if (memberCheck.rowCount > 0) {
    throw conflictError('Already a member of this group');
  }

  // Add user as member
  await db.query(
    `INSERT INTO members (group_id, user_id, encrypted_group_key)
     VALUES ($1, $2, $3)`,
    [group.id, req.user.userId, encrypted_group_key]
  );

  // Get member count
  const countResult = await db.query(
    'SELECT COUNT(*) as count FROM members WHERE group_id = $1',
    [group.id]
  );

  logger.info('User joined group', {
    groupId: group.id,
    userId: req.user.userId,
    inviteCode: invite_code
  });

  res.status(200).json({
    group_id: group.id,
    encrypted_name: group.encrypted_name,
    member_count: parseInt(countResult.rows[0].count, 10),
    joined_at: new Date().toISOString()
  });
}));

/**
 * GET /api/groups
 * List user's groups
 */
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const result = await db.query(
    `SELECT g.id, g.encrypted_name, g.invite_code, m.joined_at,
            m.encrypted_group_key,
            COUNT(m2.user_id) as member_count
     FROM groups g
     INNER JOIN members m ON m.group_id = g.id
     LEFT JOIN members m2 ON m2.group_id = g.id
     WHERE m.user_id = $1
     GROUP BY g.id, m.joined_at, m.encrypted_group_key
     ORDER BY m.joined_at DESC`,
    [req.user.userId]
  );

  const groups = result.rows.map(row => ({
    group_id: row.id,
    encrypted_name: row.encrypted_name,
    encrypted_group_key: row.encrypted_group_key,
    member_count: parseInt(row.member_count, 10),
    invite_code: row.invite_code,
    joined_at: row.joined_at
  }));

  res.status(200).json({ groups });
}));

/**
 * GET /api/groups/:groupId/members
 * List group members
 */
router.get('/:groupId/members', authenticate, asyncHandler(async (req, res) => {
  const { groupId } = req.params;

  // Verify user is member
  const memberCheck = await db.query(
    'SELECT 1 FROM members WHERE group_id = $1 AND user_id = $2',
    [groupId, req.user.userId]
  );

  if (memberCheck.rowCount === 0) {
    throw forbiddenError('Not a member of this group');
  }

  // Fetch members
  const result = await db.query(
    `SELECT u.id, u.username, u.public_key, m.joined_at
     FROM members m
     INNER JOIN users u ON u.id = m.user_id
     WHERE m.group_id = $1
     ORDER BY m.joined_at ASC`,
    [groupId]
  );

  const members = result.rows.map(row => ({
    user_id: row.id,
    username: row.username,
    public_key: row.public_key,
    joined_at: row.joined_at
  }));

  res.status(200).json({ members });
}));

/**
 * GET /api/groups/:groupId/quota
 * Get group storage quota status
 */
router.get('/:groupId/quota', authenticate, asyncHandler(async (req, res) => {
  const { groupId } = req.params;

  // Verify user is member
  const memberCheck = await db.query(
    'SELECT 1 FROM members WHERE group_id = $1 AND user_id = $2',
    [groupId, req.user.userId]
  );

  if (memberCheck.rowCount === 0) {
    throw forbiddenError('Not a member of this group');
  }

  // Fetch quota
  const result = await db.query(
    'SELECT total_bytes, media_count, max_bytes, max_media_count FROM group_quotas WHERE group_id = $1',
    [groupId]
  );

  if (result.rowCount === 0) {
    // Initialize quota if missing
    await db.query(
      'INSERT INTO group_quotas (group_id) VALUES ($1)',
      [groupId]
    );
    return res.status(200).json({
      group_id: groupId,
      total_bytes: 0,
      max_bytes: 10737418240, // 10GB
      media_count: 0,
      max_media_count: 100,
      usage_percent: 0,
      is_warning: false,
      is_full: false
    });
  }

  const quota = result.rows[0];
  const usagePercent = Math.round((quota.total_bytes / quota.max_bytes) * 100);
  const warningThreshold = 80;

  res.status(200).json({
    group_id: groupId,
    total_bytes: parseInt(quota.total_bytes, 10),
    max_bytes: parseInt(quota.max_bytes, 10),
    media_count: parseInt(quota.media_count, 10),
    max_media_count: parseInt(quota.max_media_count, 10),
    usage_percent: usagePercent,
    warning_threshold: warningThreshold,
    is_warning: usagePercent >= warningThreshold,
    is_full: quota.total_bytes >= quota.max_bytes || quota.media_count >= quota.max_media_count
  });
}));

/**
 * DELETE /api/groups/:groupId/members/:userId
 * Remove member from group (creator only)
 */
router.delete('/:groupId/members/:userId', authenticate, asyncHandler(async (req, res) => {
  const { groupId, userId } = req.params;

  // Verify requester is group creator
  const groupCheck = await db.query(
    'SELECT created_by FROM groups WHERE id = $1',
    [groupId]
  );

  if (groupCheck.rowCount === 0) {
    throw notFoundError('Group not found');
  }

  if (groupCheck.rows[0].created_by !== req.user.userId) {
    throw forbiddenError('Only group creator can remove members');
  }

  // Don't allow removing creator
  if (userId === req.user.userId) {
    throw validationError('Cannot remove group creator');
  }

  // Remove member
  const result = await db.query(
    'DELETE FROM members WHERE group_id = $1 AND user_id = $2 RETURNING user_id',
    [groupId, userId]
  );

  if (result.rowCount === 0) {
    throw notFoundError('Member not found in group');
  }

  logger.info('Member removed from group', {
    groupId,
    removedUserId: userId,
    removedBy: req.user.userId
  });

  res.status(204).send();
}));

module.exports = router;
