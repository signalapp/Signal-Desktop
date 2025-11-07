/**
 * Signal Messages Table
 * Stores encrypted Signal protocol messages temporarily for relay
 */

exports.up = (pgm) => {
  // Signal Messages Table
  pgm.createTable('signal_messages', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    conversation_id: {
      type: 'uuid',
      notNull: true,
    },
    sender_uuid: {
      type: 'uuid',
      notNull: false,
    },
    encrypted_envelope: {
      type: 'bytea',
      notNull: true,
    },
    server_timestamp: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    expires_at: {
      type: 'timestamptz',
      notNull: false,
    },
  });

  // Create indexes for signal_messages
  pgm.createIndex('signal_messages', ['conversation_id', 'server_timestamp'], {
    name: 'idx_signal_messages_conversation',
    method: 'btree',
  });

  pgm.createIndex('signal_messages', 'sender_uuid', {
    name: 'idx_signal_messages_sender',
  });

  pgm.createIndex('signal_messages', 'expires_at', {
    name: 'idx_signal_messages_expires',
  });
};

exports.down = (pgm) => {
  pgm.dropTable('signal_messages', { ifExists: true, cascade: true });
};
