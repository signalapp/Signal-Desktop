const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { authenticate } = require('../middleware/auth');
const { asyncHandler, validationError, forbiddenError, notFoundError } = require('../middleware/errorHandler');
const db = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * Media Upload/Download API Endpoints
 *
 * Handles encrypted media relay with 7-day expiration.
 * All media is encrypted client-side before upload.
 */

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = process.env.MEDIA_STORAGE_PATH || './uploads';
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    // Generate unique filename (UUID + .enc extension)
    const { v4: uuidv4 } = require('uuid');
    const filename = `${uuidv4()}.enc`;
    cb(null, filename);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB max file size
    files: 1
  },
  fileFilter: (req, file, cb) => {
    // Accept only encrypted files (all files accepted since already encrypted)
    cb(null, true);
  }
});

/**
 * POST /api/media/upload
 * Upload encrypted media file
 */
router.post('/upload', authenticate, upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) {
    throw validationError('No file uploaded');
  }

  const { thread_id, encrypted_metadata, encryption_iv } = req.body;

  if (!thread_id || !encrypted_metadata || !encryption_iv) {
    // Clean up uploaded file
    await fs.unlink(req.file.path);
    throw validationError('Missing required fields: thread_id, encrypted_metadata, encryption_iv');
  }

  // Verify thread exists and user is member
  const threadCheck = await db.query(
    `SELECT t.group_id FROM threads t WHERE t.id = $1`,
    [thread_id]
  );

  if (threadCheck.rowCount === 0) {
    await fs.unlink(req.file.path);
    throw notFoundError('Thread not found');
  }

  const groupId = threadCheck.rows[0].group_id;

  // Verify membership
  const memberCheck = await db.query(
    'SELECT 1 FROM members WHERE group_id = $1 AND user_id = $2',
    [groupId, req.user.userId]
  );

  if (memberCheck.rowCount === 0) {
    await fs.unlink(req.file.path);
    throw forbiddenError('Not a member of this group');
  }

  // Check group quota
  const quotaCheck = await db.query(
    'SELECT total_bytes, media_count, max_bytes, max_media_count FROM group_quotas WHERE group_id = $1',
    [groupId]
  );

  if (quotaCheck.rowCount > 0) {
    const quota = quotaCheck.rows[0];
    const newTotal = parseInt(quota.total_bytes, 10) + req.file.size;
    const newCount = parseInt(quota.media_count, 10) + 1;

    if (newTotal > parseInt(quota.max_bytes, 10) || newCount > parseInt(quota.max_media_count, 10)) {
      await fs.unlink(req.file.path);
      throw new Error('Group storage quota exceeded');
    }
  }

  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    // Calculate expiration (7 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Store media metadata
    const result = await client.query(
      `INSERT INTO media (thread_id, author_id, encrypted_metadata, storage_url, encryption_iv, size_bytes, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, uploaded_at, expires_at`,
      [thread_id, req.user.userId, encrypted_metadata, req.file.path, encryption_iv, req.file.size, expiresAt]
    );

    const media = result.rows[0];

    // Update group quota
    await client.query(
      `UPDATE group_quotas
       SET total_bytes = total_bytes + $1, media_count = media_count + 1, updated_at = NOW()
       WHERE group_id = $2`,
      [req.file.size, groupId]
    );

    await client.query('COMMIT');

    logger.info('Media uploaded', {
      mediaId: media.id,
      threadId: thread_id,
      groupId,
      authorId: req.user.userId,
      sizeBytes: req.file.size
    });

    res.status(201).json({
      media_id: media.id,
      size_bytes: req.file.size,
      uploaded_at: media.uploaded_at,
      expires_at: media.expires_at
    });
  } catch (error) {
    await client.query('ROLLBACK');
    // Clean up file on error
    await fs.unlink(req.file.path).catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}));

/**
 * GET /api/media/:mediaId/download
 * Download encrypted media file
 */
router.get('/:mediaId/download', authenticate, asyncHandler(async (req, res) => {
  const { mediaId } = req.params;

  // Fetch media metadata
  const result = await db.query(
    `SELECT m.id, m.thread_id, m.storage_url, m.encryption_iv, m.size_bytes, m.expires_at,
            t.group_id
     FROM media m
     INNER JOIN threads t ON t.id = m.thread_id
     WHERE m.id = $1`,
    [mediaId]
  );

  if (result.rowCount === 0) {
    throw notFoundError('Media not found');
  }

  const media = result.rows[0];

  // Check if expired
  if (new Date(media.expires_at) < new Date()) {
    throw notFoundError('Media has expired (past 7-day retention)');
  }

  // Verify user is member of group
  const memberCheck = await db.query(
    'SELECT 1 FROM members WHERE group_id = $1 AND user_id = $2',
    [media.group_id, req.user.userId]
  );

  if (memberCheck.rowCount === 0) {
    throw forbiddenError('Not a member of this group');
  }

  // Check if file exists
  try {
    await fs.access(media.storage_url);
  } catch (error) {
    logger.error('Media file not found on disk', {
      mediaId,
      storagePath: media.storage_url
    });
    throw notFoundError('Media file not found');
  }

  // Track download
  await db.query(
    `INSERT INTO media_downloads (media_id, user_id)
     VALUES ($1, $2)
     ON CONFLICT (media_id, user_id) DO NOTHING`,
    [mediaId, req.user.userId]
  );

  logger.info('Media downloaded', {
    mediaId,
    userId: req.user.userId
  });

  // Set headers
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="media.enc"`);
  res.setHeader('Content-Length', media.size_bytes);
  res.setHeader('X-Encryption-IV', media.encryption_iv);
  res.setHeader('X-Expires-At', media.expires_at);

  // Stream file to response
  const fileStream = require('fs').createReadStream(media.storage_url);
  fileStream.pipe(res);
}));

/**
 * GET /api/media/:mediaId/info
 * Get media metadata without downloading
 */
router.get('/:mediaId/info', authenticate, asyncHandler(async (req, res) => {
  const { mediaId } = req.params;

  const result = await db.query(
    `SELECT m.id, m.thread_id, m.encrypted_metadata, m.encryption_iv, m.size_bytes,
            m.uploaded_at, m.expires_at, t.group_id
     FROM media m
     INNER JOIN threads t ON t.id = m.thread_id
     WHERE m.id = $1`,
    [mediaId]
  );

  if (result.rowCount === 0) {
    throw notFoundError('Media not found');
  }

  const media = result.rows[0];

  // Verify user is member
  const memberCheck = await db.query(
    'SELECT 1 FROM members WHERE group_id = $1 AND user_id = $2',
    [media.group_id, req.user.userId]
  );

  if (memberCheck.rowCount === 0) {
    throw forbiddenError('Not a member of this group');
  }

  res.status(200).json({
    media_id: media.id,
    thread_id: media.thread_id,
    encrypted_metadata: media.encrypted_metadata,
    size_bytes: parseInt(media.size_bytes, 10),
    encryption_iv: media.encryption_iv,
    uploaded_at: media.uploaded_at,
    expires_at: media.expires_at,
    download_url: `/api/media/${media.id}/download`
  });
}));

/**
 * GET /api/threads/:threadId/media
 * List all media in thread
 */
router.get('/threads/:threadId/media', authenticate, asyncHandler(async (req, res) => {
  const { threadId } = req.params;

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

  // Fetch media
  const result = await db.query(
    `SELECT id, encrypted_metadata, size_bytes, uploaded_at, expires_at
     FROM media
     WHERE thread_id = $1 AND expires_at > NOW()
     ORDER BY uploaded_at DESC`,
    [threadId]
  );

  const mediaList = result.rows.map(row => ({
    media_id: row.id,
    encrypted_metadata: row.encrypted_metadata,
    size_bytes: parseInt(row.size_bytes, 10),
    uploaded_at: row.uploaded_at,
    expires_at: row.expires_at
  }));

  res.status(200).json({ media: mediaList });
}));

module.exports = router;
