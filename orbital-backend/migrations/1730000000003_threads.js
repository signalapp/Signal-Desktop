/**
 * Threads Table
 * Creates discussion threads within groups
 */

exports.up = (pgm) => {
  // Threads Table
  pgm.createTable('threads', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    group_id: {
      type: 'uuid',
      notNull: true,
      references: 'groups(id)',
      onDelete: 'CASCADE',
    },
    root_message_id: {
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
    encrypted_title: {
      type: 'text',
      notNull: true,
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

  // Create indexes for threads
  pgm.createIndex('threads', ['group_id', 'created_at'], {
    name: 'idx_threads_group',
    method: 'btree',
  });

  pgm.createIndex('threads', 'root_message_id', {
    name: 'idx_threads_message',
  });

  pgm.createIndex('threads', 'author_id', {
    name: 'idx_threads_author',
  });
};

exports.down = (pgm) => {
  pgm.dropTable('threads', { ifExists: true, cascade: true });
};
