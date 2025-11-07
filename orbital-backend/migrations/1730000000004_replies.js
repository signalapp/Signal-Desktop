/**
 * Replies Table
 * Stores threaded replies to discussion threads
 */

exports.up = (pgm) => {
  // Replies Table
  pgm.createTable('replies', {
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
    message_id: {
      type: 'uuid',
      notNull: false,
      references: 'signal_messages(id)',
      onDelete: 'CASCADE',
    },
    author_id: {
      type: 'uuid',
      notNull: true,
      references: 'users(id)',
      onDelete: 'SET NULL',
    },
    encrypted_body: {
      type: 'text',
      notNull: true,
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  // Create indexes for replies
  pgm.createIndex('replies', ['thread_id', 'created_at'], {
    name: 'idx_replies_thread',
    method: 'btree',
  });

  pgm.createIndex('replies', 'message_id', {
    name: 'idx_replies_message',
  });

  pgm.createIndex('replies', 'author_id', {
    name: 'idx_replies_author',
  });
};

exports.down = (pgm) => {
  pgm.dropTable('replies', { ifExists: true, cascade: true });
};
