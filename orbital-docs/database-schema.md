# Orbital Database Schema

This document defines the PostgreSQL database schema for Orbital MVP.

---

## Database: PostgreSQL 15+

**Why PostgreSQL from Day 1:**
- Production-ready from the start (no SQLite→PostgreSQL migration)
- Native JSON support (JSONB) for public keys
- UUID support for primary keys
- Robust indexing and performance
- Excellent tooling and community support

---

## Schema Definition

### Enable Required Extensions

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

---

## Core Tables

### Users Table

Stores user accounts with encrypted public keys for E2EE.

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,      -- bcrypt hash
    public_key JSONB NOT NULL,                -- RSA public key (JWK format)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Constraints
ALTER TABLE users ADD CONSTRAINT username_length
    CHECK (char_length(username) >= 3 AND char_length(username) <= 50);

-- Index for username lookups
CREATE INDEX idx_users_username ON users(username);
```

**Notes:**
- `password_hash`: bcrypt with cost factor 12
- `public_key`: Stored as JSONB in JWK (JSON Web Key) format
- `username`: 3-50 characters, alphanumeric + underscores recommended

---

### Groups Table

Stores encrypted group metadata. Group names are encrypted client-side.

```sql
CREATE TABLE groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    encrypted_name TEXT NOT NULL,             -- AES-GCM encrypted group name
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invite_code VARCHAR(8) UNIQUE NOT NULL,   -- 8 character random string
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Constraints
ALTER TABLE groups ADD CONSTRAINT invite_code_format
    CHECK (invite_code ~ '^[A-Za-z0-9]{8}$');

-- Indexes
CREATE INDEX idx_groups_invite_code ON groups(invite_code);
CREATE INDEX idx_groups_created_by ON groups(created_by);
```

**Notes:**
- `encrypted_name`: Client-side encrypted with group key
- `invite_code`: 8-character alphanumeric code for joining
- Groups are deleted when creator is deleted (CASCADE)

---

### Members Table

Tracks group membership and stores encrypted group keys for each member.

```sql
CREATE TABLE members (
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    encrypted_group_key TEXT NOT NULL,        -- Group key encrypted with user's public key
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (group_id, user_id)
);

-- Indexes
CREATE INDEX idx_members_user ON members(user_id);
CREATE INDEX idx_members_group ON members(group_id);
```

**Notes:**
- `encrypted_group_key`: Group's AES-GCM key encrypted with member's RSA public key
- Composite primary key ensures one membership per user per group
- Cascading deletes when user or group is deleted

---

### Threads Table

Stores discussion threads with encrypted content.

```sql
CREATE TABLE threads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    encrypted_title TEXT NOT NULL,            -- AES-GCM encrypted
    encrypted_body TEXT NOT NULL,             -- AES-GCM encrypted
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_threads_group ON threads(group_id);
CREATE INDEX idx_threads_created ON threads(created_at DESC);
CREATE INDEX idx_threads_author ON threads(author_id);
```

**Notes:**
- Both title and body are encrypted with group key
- Author set to NULL if user deleted (preserves thread history)
- Threads deleted when group is deleted (CASCADE)

---

### Replies Table

Stores replies to threads with encrypted content.

```sql
CREATE TABLE replies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    thread_id UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    encrypted_body TEXT NOT NULL,             -- AES-GCM encrypted
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_replies_thread ON replies(thread_id);
CREATE INDEX idx_replies_created ON replies(created_at DESC);
CREATE INDEX idx_replies_author ON replies(author_id);
```

**Notes:**
- Body encrypted with group key
- Replies deleted when thread is deleted (CASCADE)
- Author set to NULL if user deleted

---

### Media Table

Stores encrypted media metadata for temporary relay storage (7-day retention).

```sql
CREATE TABLE media (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    thread_id UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    encrypted_metadata TEXT NOT NULL,         -- filename, size, mime type (encrypted)
    storage_url TEXT NOT NULL,                -- S3 key or local file path
    encryption_iv VARCHAR(32) NOT NULL,       -- IV for AES-GCM (base64)
    size_bytes BIGINT NOT NULL,
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL           -- Auto-delete after 7 days
);

-- Indexes
CREATE INDEX idx_media_thread ON media(thread_id);
CREATE INDEX idx_media_author ON media(author_id);
CREATE INDEX idx_media_expires ON media(expires_at);  -- For cleanup job
```

**Notes:**
- `encrypted_metadata`: Contains filename, size, MIME type (encrypted)
- `storage_url`: File path on disk or S3 object key
- `encryption_iv`: Base64-encoded initialization vector for AES-GCM
- `expires_at`: Set to `uploaded_at + 7 days` for automatic cleanup

---

### Media Downloads Table

Tracks which users have downloaded which media files.

```sql
CREATE TABLE media_downloads (
    media_id UUID NOT NULL REFERENCES media(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    downloaded_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (media_id, user_id)
);

-- Indexes
CREATE INDEX idx_media_downloads_user ON media_downloads(user_id);
CREATE INDEX idx_media_downloads_media ON media_downloads(media_id);
```

**Notes:**
- Tracks download status per user (useful for notifications)
- Optional field - can be used to skip auto-download if already present
- Cascading deletes with media and users

---

### Group Quotas Table

Tracks storage usage and enforces per-group limits.

```sql
CREATE TABLE group_quotas (
    group_id UUID PRIMARY KEY REFERENCES groups(id) ON DELETE CASCADE,
    total_bytes BIGINT DEFAULT 0,             -- Current storage usage
    media_count INTEGER DEFAULT 0,            -- Current media file count
    max_bytes BIGINT DEFAULT 10737418240,     -- 10GB default limit
    max_media_count INTEGER DEFAULT 100,      -- 100 files default limit
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quota lookups
CREATE INDEX idx_group_quotas_group ON group_quotas(group_id);
```

**Notes:**
- `total_bytes`: Updated on upload/deletion
- `media_count`: Incremented/decremented with media operations
- `max_bytes`: Default 10GB (10 * 1024 * 1024 * 1024 bytes)
- `max_media_count`: Default 100 files
- Quotas initialized when group is created

---

## Summary of Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `users` | User accounts | `id`, `username`, `password_hash`, `public_key` |
| `groups` | Discussion groups | `id`, `encrypted_name`, `invite_code` |
| `members` | Group memberships | `group_id`, `user_id`, `encrypted_group_key` |
| `threads` | Discussion threads | `id`, `group_id`, `encrypted_title`, `encrypted_body` |
| `replies` | Thread replies | `id`, `thread_id`, `encrypted_body` |
| `media` | Media files (temp) | `id`, `thread_id`, `storage_url`, `encryption_iv`, `expires_at` |
| `media_downloads` | Download tracking | `media_id`, `user_id`, `downloaded_at` |
| `group_quotas` | Storage limits | `group_id`, `total_bytes`, `media_count` |

---

## Indexes Summary

**Performance-critical indexes:**
- `idx_users_username` - Fast username lookups for login
- `idx_threads_group` + `idx_threads_created` - Fast thread listing
- `idx_replies_thread` - Fast reply fetching
- `idx_media_expires` - Efficient cleanup job
- `idx_members_user` - Fast user membership lookups

---

## Database Initialization

### Step 1: Create Database

```bash
# Connect to PostgreSQL
psql postgres

# Create database
CREATE DATABASE orbital;

# Create user (production)
CREATE USER orbital_user WITH ENCRYPTED PASSWORD 'your-secure-password';
GRANT ALL PRIVILEGES ON DATABASE orbital TO orbital_user;

# Connect to orbital database
\c orbital

# Grant schema permissions
GRANT ALL ON SCHEMA public TO orbital_user;

# Exit
\q
```

### Step 2: Run Schema

Save the complete schema to `schema.sql` and run:

```bash
psql orbital < schema.sql
```

Or for production:

```bash
psql -U orbital_user -d orbital -h localhost < schema.sql
```

---

## Database Migrations (Recommended for Production)

For production deployments, use a migration tool like `node-pg-migrate`:

```bash
# Install migration tool
npm install -g node-pg-migrate

# Create initial migration
pg-migrate create initial-schema

# Edit the migration file to include schema
# Run migration
pg-migrate up
```

**Benefits:**
- Version-controlled schema changes
- Rollback capability
- Safe production deployments
- Team collaboration on schema changes

---

## Backup Strategy

### Daily Automated Backups

```bash
#!/bin/bash
# backup.sh
BACKUP_DIR="/home/orbital/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup
pg_dump orbital > $BACKUP_DIR/orbital_$DATE.sql

# Compress
gzip $BACKUP_DIR/orbital_$DATE.sql

# Keep last 7 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
```

Add to crontab:
```bash
0 2 * * * /home/orbital/backup.sh >> /home/orbital/logs/backup.log 2>&1
```

---

## Performance Considerations

### Connection Pooling

Configure connection pool in application:

```javascript
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    min: 2,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000
});
```

### Query Optimization Tips

1. **Use EXPLAIN ANALYZE** to debug slow queries
2. **Batch inserts** when creating multiple records
3. **Use prepared statements** for frequently-run queries
4. **Monitor index usage** with `pg_stat_user_indexes`
5. **Vacuum regularly** (automatic in PostgreSQL 15+)

---

## Security Best Practices

### Always Use Parameterized Queries

```javascript
// ✅ GOOD - Parameterized query (SQL injection safe)
const result = await pool.query(
    'SELECT * FROM users WHERE username = $1',
    [username]
);

// ❌ BAD - String concatenation (SQL injection vulnerable)
const result = await pool.query(
    `SELECT * FROM users WHERE username = '${username}'`
);
```

### Principle of Least Privilege

- Application user (`orbital_user`) has full access to `orbital` database only
- No superuser privileges needed
- Production database should not be accessible from public internet
- Use SSL/TLS for database connections in production

---

## Monitoring Queries

### Check Active Connections

```sql
SELECT * FROM pg_stat_activity WHERE datname = 'orbital';
```

### Check Table Sizes

```sql
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Check Index Usage

```sql
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

---

## Related Documentation

- **[API Specification](api-specification.md)** - How these tables are accessed via REST API
- **[Encryption & Security](encryption-and-security.md)** - How encrypted fields are handled
- **[Deployment & Operations](deployment-operations.md)** - Production database setup
