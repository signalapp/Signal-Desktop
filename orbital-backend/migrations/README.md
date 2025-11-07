# Orbital Database Migrations

This directory contains PostgreSQL database migrations managed by [node-pg-migrate](https://github.com/salsita/node-pg-migrate).

## Migration Files

Migrations are numbered sequentially and include:

1. **1730000000001_initial-setup.js** - UUID extension, users, groups, and members tables
2. **1730000000002_signal-messages.js** - Signal protocol message relay table
3. **1730000000003_threads.js** - Discussion threads table
4. **1730000000004_replies.js** - Threaded replies table
5. **1730000000005_media.js** - Media storage with 7-day retention
6. **1730000000006_group-quotas.js** - Group storage quotas (10GB default)

## Prerequisites

- PostgreSQL 15+ installed and running
- Database and user created (see root README.md)
- `DATABASE_URL` environment variable set in `.env` file

## Running Migrations

### Apply All Pending Migrations (Up)

```bash
npm run migrate
```

This will:
- Create all tables if they don't exist
- Add indexes for performance
- Set up foreign key constraints
- Track migration state in `pgmigrations` table

### Rollback Last Migration (Down)

```bash
npm run migrate:down
```

This will:
- Drop tables created in the last migration
- Remove indexes and constraints
- Update migration state

### Rollback All Migrations

```bash
# Run this multiple times to rollback all migrations
npm run migrate:down
npm run migrate:down
npm run migrate:down
# ... until all migrations are rolled back
```

## Migration Features

### Automated Features

- **UUID Primary Keys** - All tables use UUID v4 for primary keys
- **Timestamps** - Automatic `created_at`, `updated_at`, `uploaded_at` timestamps
- **Foreign Keys** - Referential integrity with CASCADE/SET NULL policies
- **Indexes** - Performance indexes on frequently queried columns
- **Constraints** - Data validation (username length, invite code format)

### Key Tables

#### Core Tables
- `users` - User accounts with E2EE public keys
- `groups` - Private groups with encrypted names
- `members` - Group membership with encrypted keys
- `signal_messages` - Temporary message relay (E2EE)

#### Threading Tables
- `threads` - Discussion threads with encrypted content
- `replies` - Threaded replies to discussions

#### Media Tables
- `media` - Media files with 7-day server retention
- `media_downloads` - Track which users downloaded which media
- `group_quotas` - 10GB storage quota per group

## Database Schema Notes

### Encryption Strategy

All sensitive data is encrypted:
- `users.public_key` - JSONB E2EE public key
- `groups.encrypted_name` - Group name (client-side encrypted)
- `members.encrypted_group_key` - Group keys per member
- `threads.encrypted_title` - Thread titles
- `threads.encrypted_body` - Thread content
- `replies.encrypted_body` - Reply content
- `media.encrypted_metadata` - Media file metadata

### Storage & Retention

- **Signal Messages**: Temporary relay, no long-term storage
- **Media Files**: 7-day retention on server, permanent on client devices
- **Group Quotas**: 10GB default per group, 100 media files max

### Performance Indexes

All tables have indexes on:
- Primary keys (automatic)
- Foreign keys (for JOIN performance)
- Timestamp columns (for sorting/filtering)
- Frequently queried columns (`conversation_id`, `group_id`, etc.)

## Troubleshooting

### Migration Already Applied

If you see "relation already exists", the tables were created manually. To use migrations:

```bash
# 1. Backup your data if needed
pg_dump -U orbital_user orbital > backup.sql

# 2. Drop existing schema
psql -U orbital_user -d orbital -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# 3. Run migrations
npm run migrate
```

### Connection Refused

If migrations can't connect:

1. Check PostgreSQL is running: `pg_isready`
2. Verify DATABASE_URL in `.env` file
3. Ensure database exists: `psql -U orbital_user -l`
4. Check user permissions: `psql -U orbital_user -d orbital`

### Migration State Issues

If migration state is corrupted:

```bash
# Check migration status
psql -U orbital_user -d orbital -c "SELECT * FROM pgmigrations ORDER BY id;"

# Reset migration state (DESTRUCTIVE - use with caution)
psql -U orbital_user -d orbital -c "DROP TABLE pgmigrations;"
```

## Development Workflow

### Creating New Migrations

```bash
# node-pg-migrate will auto-generate the timestamp
npx node-pg-migrate create my-new-migration
```

### Testing Migrations

```bash
# Test up
npm run migrate

# Test down
npm run migrate:down

# Test up again to ensure idempotency
npm run migrate
```

### Production Deployment

1. Backup database before deploying
2. Run migrations on staging first
3. Test rollback procedure on staging
4. Apply to production during maintenance window
5. Verify migration state: `SELECT * FROM pgmigrations;`

## Schema Versioning

Migrations provide:
- **Version Control** - Track schema changes in Git
- **Rollback Safety** - Undo migrations if needed
- **Team Coordination** - No manual schema.sql conflicts
- **Production Safety** - Auditable database changes

## Related Files

- `package.json` - Migration scripts (`npm run migrate`)
- `.node-pg-migraterc` - node-pg-migrate configuration
- `src/config/database.js` - PostgreSQL connection pool
- `schema.sql` - Reference schema (replaced by migrations)
