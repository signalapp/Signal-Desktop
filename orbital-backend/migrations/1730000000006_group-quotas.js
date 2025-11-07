/**
 * Group Quotas Table
 * Tracks media storage quotas per group (10GB default)
 */

exports.up = (pgm) => {
  // Group Quotas Table
  pgm.createTable('group_quotas', {
    group_id: {
      type: 'uuid',
      primaryKey: true,
      references: 'groups(id)',
      onDelete: 'CASCADE',
    },
    total_bytes: {
      type: 'bigint',
      notNull: true,
      default: 0,
      comment: 'Total bytes of media stored for this group',
    },
    media_count: {
      type: 'integer',
      notNull: true,
      default: 0,
      comment: 'Total number of media files for this group',
    },
    max_bytes: {
      type: 'bigint',
      notNull: true,
      default: 10737418240, // 10GB in bytes
      comment: 'Maximum storage quota in bytes (10GB default)',
    },
    max_media_count: {
      type: 'integer',
      notNull: true,
      default: 100,
      comment: 'Maximum number of media files allowed',
    },
    updated_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  // Create index for group_quotas
  pgm.createIndex('group_quotas', 'group_id', {
    name: 'idx_group_quotas_group',
  });
};

exports.down = (pgm) => {
  pgm.dropTable('group_quotas', { ifExists: true, cascade: true });
};
