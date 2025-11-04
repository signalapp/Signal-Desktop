# Orbital Deployment & Operations

This document covers local development setup, production deployment to DigitalOcean, monitoring, and operational best practices for Orbital MVP.

---

## Local Development Setup

### Prerequisites

- **Node.js 18+ LTS**
- **PostgreSQL 15+**
- **Git**
- **ngrok** (for remote testing)

### Step 1: Install PostgreSQL

#### macOS (Homebrew)
```bash
brew install postgresql@15
brew services start postgresql@15

# Create database
createdb orbital
```

#### Ubuntu/Debian
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database
sudo -u postgres createdb orbital
```

#### Create User and Grant Permissions
```sql
psql postgres
CREATE DATABASE orbital;
CREATE USER orbital_user WITH ENCRYPTED PASSWORD 'dev_password';
GRANT ALL PRIVILEGES ON DATABASE orbital TO orbital_user;
\c orbital
GRANT ALL ON SCHEMA public TO orbital_user;
\q
```

---

### Step 2: Setup Project

```bash
# Clone repository
git clone <your-repo-url>
cd orbital

# Install dependencies
npm install

# Create required directories
mkdir -p media logs

# Create .env file from template
cp .env.example .env
```

#### Edit .env File

```bash
# Development environment
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://orbital_user:dev_password@localhost:5432/orbital

# Security
JWT_SECRET=development-secret-change-in-production
JWT_EXPIRATION=30d

# Media
MEDIA_STORAGE_PATH=./media
MAX_VIDEO_SIZE=524288000
MAX_IMAGE_SIZE=52428800

# Quotas
MAX_GROUP_STORAGE=10737418240
MAX_GROUP_MEDIA_COUNT=100

# Logging
LOG_LEVEL=debug
LOG_FILE=./logs/orbital.log
```

---

### Step 3: Initialize Database

```bash
# Run database schema
psql -U orbital_user -d orbital < schema.sql

# Or use migration tool (recommended)
npm install -g node-pg-migrate
pg-migrate create initial-schema
pg-migrate up
```

---

### Step 4: Run Development Server

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start

# Run tests
npm test

# Run tests with coverage
npm test -- --coverage
```

#### package.json Scripts

```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "test": "jest --coverage",
    "test:watch": "jest --watch",
    "migrate": "node-pg-migrate up",
    "migrate:down": "node-pg-migrate down"
  }
}
```

---

### Step 5: Expose for Remote Testing (Optional)

```bash
# Install ngrok
npm install -g ngrok

# Expose local server
ngrok http 3000

# Share the generated URL with testers
# Example: https://abc123.ngrok.io
```

---

## Production Deployment (DigitalOcean)

### Infrastructure Requirements

**MVP Tier:**
- **Droplet:** $12/month (2GB RAM, 50GB SSD, 2TB transfer)
- **Spaces (optional):** $5/month (250GB storage + CDN)
- **Domain:** ~$12/year (optional)

**Total:** ~$12-17/month

---

### Step 1: Create and Configure Droplet

```bash
# Create $12 droplet via DigitalOcean dashboard
# Choose: Ubuntu 22.04 LTS, 2GB RAM, Regular SSD

# SSH into droplet
ssh root@your-server-ip

# Update system
apt update && apt upgrade -y

# Create non-root user
adduser orbital
usermod -aG sudo orbital
su - orbital

# Setup firewall
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

---

### Step 2: Install PostgreSQL

```bash
# Install PostgreSQL 15
sudo apt install -y postgresql postgresql-contrib

# Start PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql

CREATE DATABASE orbital;
CREATE USER orbital_user WITH ENCRYPTED PASSWORD 'super-secure-production-password';
GRANT ALL PRIVILEGES ON DATABASE orbital TO orbital_user;
\c orbital
GRANT ALL ON SCHEMA public TO orbital_user;
\q

# Configure PostgreSQL for local connections
sudo nano /etc/postgresql/15/main/postgresql.conf
# Set: listen_addresses = 'localhost'

sudo nano /etc/postgresql/15/main/pg_hba.conf
# Add: local   orbital   orbital_user   md5

# Restart PostgreSQL
sudo systemctl restart postgresql
```

---

### Step 3: Install Node.js

```bash
# Install Node.js 18 LTS
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version  # Should be v18.x.x
npm --version
```

---

### Step 4: Deploy Application

```bash
# Clone repository
cd /home/orbital
git clone <your-repo-url> app
cd app

# Install production dependencies
npm install --production

# Create required directories
mkdir -p media logs
chmod 755 media logs

# Setup environment variables
cp .env.example .env
nano .env
```

#### Production .env Configuration

```bash
# Production environment
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://your-domain.com

# Database
DATABASE_URL=postgresql://orbital_user:super-secure-password@localhost:5432/orbital
DB_POOL_MIN=2
DB_POOL_MAX=10

# Security (GENERATE NEW SECRET!)
JWT_SECRET=<generate-with: openssl rand -base64 32>
JWT_EXPIRATION=30d

# Media Storage
MEDIA_STORAGE_PATH=/home/orbital/app/media
MAX_VIDEO_SIZE=524288000
MAX_IMAGE_SIZE=52428800

# Storage Quotas
MAX_GROUP_STORAGE=10737418240
MAX_GROUP_MEDIA_COUNT=100

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=10

# Logging
LOG_LEVEL=info
LOG_FILE=/home/orbital/app/logs/orbital.log

# WebSocket
WS_HEARTBEAT_INTERVAL=30000
WS_MAX_RECONNECT_ATTEMPTS=10
```

```bash
# Run database migrations
psql -U orbital_user -d orbital < schema.sql
```

---

### Step 5: Setup PM2 Process Manager

```bash
# Install PM2 globally
sudo npm install -g pm2

# Create PM2 ecosystem file
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'orbital',
    script: './server.js',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production'
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    max_memory_restart: '1G',
    autorestart: true,
    watch: false
  }]
};
EOF

# Start application
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup systemd
# Run the command PM2 outputs

# Monitor application
pm2 monit
pm2 logs orbital
pm2 status
```

---

### Step 6: Configure Nginx

```bash
# Install Nginx
sudo apt install -y nginx

# Create Nginx configuration
sudo nano /etc/nginx/sites-available/orbital
```

#### Nginx Configuration

```nginx
# Rate limiting zones
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=100r/m;
limit_req_zone $binary_remote_addr zone=auth_limit:10m rate=10r/m;

# WebSocket upgrade configuration
map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}

# Upstream to Node.js app
upstream orbital_backend {
    least_conn;
    server 127.0.0.1:3000;
    keepalive 64;
}

server {
    listen 80;
    listen [::]:80;
    server_name your-domain.com www.your-domain.com;

    # Logging
    access_log /var/log/nginx/orbital-access.log;
    error_log /var/log/nginx/orbital-error.log;

    # Max body size for file uploads (500MB)
    client_max_body_size 500M;

    # Timeouts for large file uploads
    client_body_timeout 300s;
    client_header_timeout 300s;
    proxy_connect_timeout 300s;
    proxy_send_timeout 300s;
    proxy_read_timeout 300s;
    send_timeout 300s;

    # Buffer sizes for large uploads
    client_body_buffer_size 256K;
    client_header_buffer_size 32k;
    large_client_header_buffers 4 32k;

    # Root directory for static files
    root /home/orbital/app/public;
    index index.html;

    # Serve static files directly
    location /css/ {
        alias /home/orbital/app/public/css/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location /js/ {
        alias /home/orbital/app/public/js/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location /lib/ {
        alias /home/orbital/app/public/lib/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # API endpoints
    location /api/ {
        limit_req zone=api_limit burst=20 nodelay;

        proxy_pass http://orbital_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Auth endpoints with stricter rate limiting
    location ~ ^/api/(login|signup) {
        limit_req zone=auth_limit burst=5 nodelay;

        proxy_pass http://orbital_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket endpoint
    location /ws {
        proxy_pass http://orbital_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket timeouts (keep alive for up to 24 hours)
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    # Fallback to index.html for SPA
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/orbital /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

---

### Step 7: Setup SSL with Let's Encrypt

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Follow prompts to:
# 1. Enter email address
# 2. Agree to terms
# 3. Choose to redirect HTTP to HTTPS

# Certificate auto-renewal is configured automatically

# Test auto-renewal
sudo certbot renew --dry-run
```

---

### Step 8: Setup Automated Backups

```bash
# Create backup script
cat > /home/orbital/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/home/orbital/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup PostgreSQL database
pg_dump -U orbital_user orbital > $BACKUP_DIR/orbital_$DATE.sql

# Compress backup
gzip $BACKUP_DIR/orbital_$DATE.sql

# Keep only last 7 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
EOF

chmod +x /home/orbital/backup.sh

# Setup daily backup cron job (2 AM)
crontab -e
# Add: 0 2 * * * /home/orbital/backup.sh >> /home/orbital/logs/backup.log 2>&1
```

---

## Monitoring and Logging

### PM2 Monitoring

```bash
# Real-time monitoring
pm2 monit

# View logs
pm2 logs orbital --lines 100

# View errors only
pm2 logs orbital --err

# Application status
pm2 status

# Restart application
pm2 restart orbital

# Reload with zero downtime
pm2 reload orbital
```

---

### Application Logs (Winston)

```bash
# View application logs
tail -f /home/orbital/app/logs/orbital.log

# View errors only
tail -f /home/orbital/app/logs/error.log

# Search logs
grep "ERROR" /home/orbital/app/logs/orbital.log
```

---

### Nginx Logs

```bash
# View access logs
sudo tail -f /var/log/nginx/orbital-access.log

# View error logs
sudo tail -f /var/log/nginx/orbital-error.log

# Analyze traffic patterns
sudo awk '{print $1}' /var/log/nginx/orbital-access.log | sort | uniq -c | sort -rn | head -10
```

---

### PostgreSQL Logs

```bash
# View PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-15-main.log

# Check database connections
sudo -u postgres psql -c "SELECT * FROM pg_stat_activity WHERE datname = 'orbital';"
```

---

### System Resources

```bash
# Install htop if not available
sudo apt install htop

# Monitor CPU, memory, processes
htop

# Check disk usage
df -h

# Check memory usage
free -h

# Check network connections
ss -tuln | grep 3000  # Check if Node.js is running
```

---

## Maintenance Tasks

### Update Application Code

```bash
# SSH into droplet
ssh orbital@your-server-ip

cd /home/orbital/app

# Pull latest code
git pull origin main

# Install new dependencies
npm install --production

# Run migrations if any
pg-migrate up

# Reload PM2 (zero downtime)
pm2 reload orbital

# Check status
pm2 status
pm2 logs orbital --lines 50
```

---

### Database Maintenance

```bash
# Vacuum database (reclaim space, update statistics)
sudo -u postgres psql orbital -c "VACUUM ANALYZE;"

# Check database size
sudo -u postgres psql orbital -c "SELECT pg_size_pretty(pg_database_size('orbital'));"

# Check table sizes
sudo -u postgres psql orbital -c "
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
"
```

---

### Media Storage Cleanup

The cron job in `server.js` automatically deletes expired media (7 days). Manual cleanup:

```bash
# Check media directory size
du -sh /home/orbital/app/media

# Manually trigger cleanup (if needed)
# This should be handled by the app's cron job
find /home/orbital/app/media -type f -mtime +7 -delete
```

---

## Scaling Considerations

### 0-100 Families (Current MVP Setup)
- Single $12 droplet
- Local disk storage
- ~1000 concurrent WebSocket connections

### 100-1000 Families
- **Upgrade droplet:** $24/month (4GB RAM, 80GB SSD)
- **Add Spaces:** DigitalOcean Spaces for media storage ($5/month)
- **Add Redis:** For WebSocket pub/sub across multiple servers
- **Database tuning:** Optimize PostgreSQL settings

### 1000+ Families
- **Multiple droplets:** Load balanced with sticky sessions
- **CDN:** CloudFlare or DigitalOcean CDN for static assets and media
- **Managed database:** DigitalOcean Managed PostgreSQL
- **Redis cluster:** For session management and WebSocket scaling
- **Monitoring:** Sentry, Grafana, Prometheus

---

## Security Checklist

### Before Going Live

- [ ] Change default JWT_SECRET
- [ ] Use strong PostgreSQL password
- [ ] Enable SSL/TLS with Let's Encrypt
- [ ] Configure firewall (UFW) to only allow 22, 80, 443
- [ ] Disable root SSH login
- [ ] Setup automated backups
- [ ] Test backup restoration
- [ ] Configure rate limiting
- [ ] Enable security headers (Helmet)
- [ ] Test HTTPS redirect
- [ ] Verify CORS settings
- [ ] Check PostgreSQL is not exposed to public
- [ ] Review application logs for errors
- [ ] Test WebSocket over WSS (secure WebSocket)

---

## Disaster Recovery

### Backup Restoration

```bash
# Stop application
pm2 stop orbital

# Drop existing database
sudo -u postgres psql -c "DROP DATABASE orbital;"
sudo -u postgres psql -c "CREATE DATABASE orbital;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE orbital TO orbital_user;"

# Restore from backup
gunzip -c /home/orbital/backups/orbital_YYYYMMDD_HHMMSS.sql.gz | \
    psql -U orbital_user -d orbital

# Restart application
pm2 restart orbital
```

---

### Media Restoration

Media files are stored on client devices (IndexedDB). Server only keeps 7-day relay copies. If server media is lost, users can re-upload from their local copies.

---

## Related Documentation

- **[Database Schema](database-schema.md)** - Database initialization
- **[API Specification](api-specification.md)** - API endpoints to monitor
- **[WebSocket & Real-Time](websocket-realtime.md)** - WebSocket configuration
- **[Testing Strategy](testing-strategy.md)** - Testing before deployment
