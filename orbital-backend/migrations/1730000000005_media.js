/**
 * Media Tables
 * Stores media files with 7-day retention and download tracking
 */

exports.up = (pgm) => {
  // Media Table
  pgm.createTable('media', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    thread_id: {
      type: 'uuid',
      notNull: true,
      references: 'threads(id)',
      onDelete: 'CASCADE',
    },
    author_id: {
      type: 'uuid',
      notNull: true,
      references: 'users(id)',
      onDelete: 'SET NULL',
    },
    encrypted_metadata: {
      type: 'text',
      notNull: true,
    },
    storage_url: {
      type: 'text',
      notNull: true,
    },
    encryption_iv: {
      type: 'varchar(32)',
      notNull: true,
    },
    size_bytes: {
      type: 'bigint',
      notNull: true,
    },
    uploaded_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    expires_at: {
      type: 'timestamptz',
      notNull: true,
      comment: '7-day retention period for media relay',
    },
  });

  // Create indexes for media
  pgm.createIndex('media', 'thread_id', {
    name: 'idx_media_thread',
  });

  pgm.createIndex('media', 'author_id', {
    name: 'idx_media_author',
  });

  pgm.createIndex('media', 'expires_at', {
    name: 'idx_media_expires',
    comment: 'Index for efficient cleanup of expired media',
  });

  // Media Downloads Table
  pgm.createTable('media_downloads', {
    media_id: {
      type: 'uuid',
      notNull: true,
      references: 'media(id)',
      onDelete: 'CASCADE',
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE',
    },
    downloaded_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  // Add composite primary key for media_downloads
  pgm.addConstraint('media_downloads', 'media_downloads_pkey', {
    primaryKey: ['media_id', 'user_id'],
  });

  // Create indexes for media_downloads
  pgm.createIndex('media_downloads', 'user_id', {
    name: 'idx_media_downloads_user',
  });

  pgm.createIndex('media_downloads', 'media_id', {
    name: 'idx_media_downloads_media',
  });
};

exports.down = (pgm) => {
  pgm.dropTable('media_downloads', { ifExists: true, cascade: true });
  pgm.dropTable('media', { ifExists: true, cascade: true });
};
