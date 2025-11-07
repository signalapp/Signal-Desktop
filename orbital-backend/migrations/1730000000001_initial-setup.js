/**
 * Initial database setup
 * Creates UUID extension, users, groups, and members tables
 */

exports.up = (pgm) => {
  // Enable UUID extension
  pgm.sql('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

  // Users Table
  pgm.createTable('users', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    username: {
      type: 'varchar(50)',
      notNull: true,
      unique: true,
    },
    password_hash: {
      type: 'varchar(255)',
      notNull: true,
    },
    public_key: {
      type: 'jsonb',
      notNull: true,
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  // Add username length constraint
  pgm.addConstraint('users', 'username_length', {
    check: 'char_length(username) >= 3 AND char_length(username) <= 50',
  });

  // Create index on username
  pgm.createIndex('users', 'username', { name: 'idx_users_username' });

  // Groups Table
  pgm.createTable('groups', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    encrypted_name: {
      type: 'text',
      notNull: true,
    },
    created_by: {
      type: 'uuid',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE',
    },
    invite_code: {
      type: 'varchar(8)',
      notNull: true,
      unique: true,
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  // Add invite code format constraint
  pgm.addConstraint('groups', 'invite_code_format', {
    check: "invite_code ~ '^[A-Za-z0-9]{8}$'",
  });

  // Create indexes on groups
  pgm.createIndex('groups', 'invite_code', { name: 'idx_groups_invite_code' });
  pgm.createIndex('groups', 'created_by', { name: 'idx_groups_created_by' });

  // Members Table
  pgm.createTable('members', {
    group_id: {
      type: 'uuid',
      notNull: true,
      references: 'groups(id)',
      onDelete: 'CASCADE',
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE',
    },
    encrypted_group_key: {
      type: 'text',
      notNull: true,
    },
    joined_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  // Add composite primary key
  pgm.addConstraint('members', 'members_pkey', {
    primaryKey: ['group_id', 'user_id'],
  });

  // Create indexes on members
  pgm.createIndex('members', 'user_id', { name: 'idx_members_user' });
  pgm.createIndex('members', 'group_id', { name: 'idx_members_group' });
};

exports.down = (pgm) => {
  // Drop tables in reverse order (respecting foreign keys)
  pgm.dropTable('members', { ifExists: true, cascade: true });
  pgm.dropTable('groups', { ifExists: true, cascade: true });
  pgm.dropTable('users', { ifExists: true, cascade: true });

  // Drop UUID extension
  pgm.sql('DROP EXTENSION IF EXISTS "uuid-ossp"');
};
