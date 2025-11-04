# Orbital Testing Strategy

This document defines the testing approach, automated test suite, and manual testing plans for Orbital MVP.

---

## Testing Philosophy

**MVP Focus:** Test critical paths and security-sensitive code. Comprehensive test coverage can be expanded post-MVP.

**Test Pyramid:**
- **Unit Tests (60%):** Individual functions, encryption, validation
- **Integration Tests (30%):** API endpoints, database interactions
- **E2E Tests (10%):** Manual testing, user flows

---

## Automated Testing

### Test Setup

#### Install Testing Dependencies

```bash
npm install --save-dev jest supertest nodemon
```

#### Jest Configuration (jest.config.js)

```javascript
module.exports = {
    testEnvironment: 'node',
    coverageDirectory: 'coverage',
    collectCoverageFrom: [
        'server/**/*.js',
        'routes/**/*.js',
        'middleware/**/*.js',
        '!server/**/*.test.js',
        '!**/node_modules/**'
    ],
    testMatch: [
        '**/__tests__/**/*.js',
        '**/*.test.js'
    ],
    coverageThreshold: {
        global: {
            statements: 60,
            branches: 50,
            functions: 60,
            lines: 60
        }
    },
    verbose: true,
    testTimeout: 10000
};
```

#### package.json Scripts

```json
{
  "scripts": {
    "test": "jest --coverage",
    "test:watch": "jest --watch",
    "test:unit": "jest --testPathPattern=unit",
    "test:integration": "jest --testPathPattern=integration"
  }
}
```

---

## Unit Tests

### Authentication Tests

**File:** `__tests__/unit/auth.test.js`

```javascript
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { validatePassword, generateToken, verifyToken } = require('../../utils/auth');

describe('Authentication Utilities', () => {
    describe('validatePassword', () => {
        it('should reject passwords shorter than 12 characters', () => {
            const result = validatePassword('Short1!');
            expect(result.valid).toBe(false);
            expect(result.message).toContain('12 characters');
        });

        it('should reject passwords without uppercase', () => {
            const result = validatePassword('lowercase123!');
            expect(result.valid).toBe(false);
            expect(result.message).toContain('uppercase');
        });

        it('should reject passwords without lowercase', () => {
            const result = validatePassword('UPPERCASE123!');
            expect(result.valid).toBe(false);
            expect(result.message).toContain('lowercase');
        });

        it('should reject passwords without numbers', () => {
            const result = validatePassword('NoNumbersHere!');
            expect(result.valid).toBe(false);
            expect(result.message).toContain('numbers');
        });

        it('should accept strong passwords', () => {
            const result = validatePassword('SecurePassword123!');
            expect(result.valid).toBe(true);
        });

        it('should reject weak passwords (low zxcvbn score)', () => {
            const result = validatePassword('password123A');
            expect(result.valid).toBe(false);
            expect(result.message).toContain('weak');
        });
    });

    describe('JWT Token Generation and Verification', () => {
        const testUser = {
            id: '123e4567-e89b-12d3-a456-426614174000',
            username: 'testuser'
        };

        it('should generate valid JWT token', () => {
            const token = generateToken(testUser);
            expect(token).toBeDefined();
            expect(typeof token).toBe('string');
        });

        it('should verify valid token', () => {
            const token = generateToken(testUser);
            const decoded = verifyToken(token);
            expect(decoded.userId).toBe(testUser.id);
            expect(decoded.username).toBe(testUser.username);
        });

        it('should reject invalid token', () => {
            const decoded = verifyToken('invalid.token.here');
            expect(decoded).toBeNull();
        });

        it('should reject expired token', () => {
            // Create token with 1ms expiration
            const token = jwt.sign(
                { userId: testUser.id, username: testUser.username },
                process.env.JWT_SECRET,
                { expiresIn: '1ms' }
            );

            // Wait for token to expire
            setTimeout(() => {
                const decoded = verifyToken(token);
                expect(decoded).toBeNull();
            }, 10);
        });
    });
});
```

---

### Encryption Tests

**File:** `__tests__/unit/encryption.test.js`

```javascript
const crypto = require('crypto');

describe('Encryption Functions', () => {
    describe('AES-GCM Encryption', () => {
        it('should encrypt and decrypt data correctly', () => {
            const plaintext = 'Secret message';
            const key = crypto.randomBytes(32);
            const iv = crypto.randomBytes(12);

            // Encrypt
            const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
            let encrypted = cipher.update(plaintext, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            const authTag = cipher.getAuthTag();

            // Decrypt
            const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
            decipher.setAuthTag(authTag);
            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');

            expect(decrypted).toBe(plaintext);
        });

        it('should fail with tampered ciphertext', () => {
            const plaintext = 'Secret message';
            const key = crypto.randomBytes(32);
            const iv = crypto.randomBytes(12);

            // Encrypt
            const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
            let encrypted = cipher.update(plaintext, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            const authTag = cipher.getAuthTag();

            // Tamper with ciphertext
            const tamperedEncrypted = '00' + encrypted.substring(2);

            // Decrypt should fail
            const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
            decipher.setAuthTag(authTag);

            expect(() => {
                decipher.update(tamperedEncrypted, 'hex', 'utf8');
                decipher.final('utf8');
            }).toThrow();
        });

        it('should fail with wrong key', () => {
            const plaintext = 'Secret message';
            const key = crypto.randomBytes(32);
            const wrongKey = crypto.randomBytes(32);
            const iv = crypto.randomBytes(12);

            // Encrypt with correct key
            const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
            let encrypted = cipher.update(plaintext, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            const authTag = cipher.getAuthTag();

            // Decrypt with wrong key should fail
            const decipher = crypto.createDecipheriv('aes-256-gcm', wrongKey, iv);
            decipher.setAuthTag(authTag);

            expect(() => {
                decipher.update(encrypted, 'hex', 'utf8');
                decipher.final('utf8');
            }).toThrow();
        });
    });
});
```

---

## Integration Tests

### API Endpoint Tests

**File:** `__tests__/integration/api.test.js`

```javascript
const request = require('supertest');
const app = require('../../server');

describe('Authentication Endpoints', () => {
    let testUsername = `testuser_${Date.now()}`;

    describe('POST /api/signup', () => {
        it('should create new user with valid data', async () => {
            const res = await request(app)
                .post('/api/signup')
                .send({
                    username: testUsername,
                    password: 'SecurePassword123!',
                    public_key: {
                        kty: 'RSA',
                        n: 'test',
                        e: 'AQAB',
                        alg: 'RSA-OAEP-256',
                        ext: true
                    }
                });

            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty('token');
            expect(res.body).toHaveProperty('user_id');
            expect(typeof res.body.token).toBe('string');
        });

        it('should reject weak passwords', async () => {
            const res = await request(app)
                .post('/api/signup')
                .send({
                    username: `testuser2_${Date.now()}`,
                    password: 'weak',
                    public_key: {}
                });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('VALIDATION_ERROR');
        });

        it('should reject duplicate usernames', async () => {
            const username = `duplicate_${Date.now()}`;

            // First signup
            await request(app)
                .post('/api/signup')
                .send({
                    username: username,
                    password: 'SecurePassword123!',
                    public_key: {}
                });

            // Second signup with same username
            const res = await request(app)
                .post('/api/signup')
                .send({
                    username: username,
                    password: 'SecurePassword123!',
                    public_key: {}
                });

            expect(res.status).toBe(409);
            expect(res.body.error).toBe('USERNAME_TAKEN');
        });

        it('should reject short usernames', async () => {
            const res = await request(app)
                .post('/api/signup')
                .send({
                    username: 'ab',
                    password: 'SecurePassword123!',
                    public_key: {}
                });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('VALIDATION_ERROR');
        });
    });

    describe('POST /api/login', () => {
        it('should login with valid credentials', async () => {
            const res = await request(app)
                .post('/api/login')
                .send({
                    username: testUsername,
                    password: 'SecurePassword123!'
                });

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('token');
            expect(res.body).toHaveProperty('user_id');
            expect(res.body).toHaveProperty('public_key');
        });

        it('should reject invalid credentials', async () => {
            const res = await request(app)
                .post('/api/login')
                .send({
                    username: testUsername,
                    password: 'wrongpassword'
                });

            expect(res.status).toBe(401);
            expect(res.body.error).toBe('INVALID_CREDENTIALS');
        });

        it('should reject non-existent username', async () => {
            const res = await request(app)
                .post('/api/login')
                .send({
                    username: 'nonexistent',
                    password: 'SecurePassword123!'
                });

            expect(res.status).toBe(401);
        });
    });
});

describe('Group Management Endpoints', () => {
    let authToken;
    let userId;

    beforeAll(async () => {
        // Create test user
        const res = await request(app)
            .post('/api/signup')
            .send({
                username: `grouptest_${Date.now()}`,
                password: 'SecurePassword123!',
                public_key: {}
            });

        authToken = res.body.token;
        userId = res.body.user_id;
    });

    describe('POST /api/groups', () => {
        it('should create group with valid data', async () => {
            const res = await request(app)
                .post('/api/groups')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    encrypted_name: 'encrypted_test_group',
                    encrypted_group_key: 'encrypted_key'
                });

            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty('group_id');
            expect(res.body).toHaveProperty('invite_code');
            expect(res.body.invite_code).toMatch(/^[A-Za-z0-9]{8}$/);
        });

        it('should reject unauthenticated requests', async () => {
            const res = await request(app)
                .post('/api/groups')
                .send({
                    encrypted_name: 'test',
                    encrypted_group_key: 'key'
                });

            expect(res.status).toBe(401);
        });
    });

    describe('GET /api/groups', () => {
        it('should return user groups', async () => {
            const res = await request(app)
                .get('/api/groups')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('groups');
            expect(Array.isArray(res.body.groups)).toBe(true);
        });
    });
});

describe('Media Upload Endpoints', () => {
    let authToken;
    let groupId;
    let threadId;

    beforeAll(async () => {
        // Create user
        const userRes = await request(app)
            .post('/api/signup')
            .send({
                username: `mediatest_${Date.now()}`,
                password: 'SecurePassword123!',
                public_key: {}
            });

        authToken = userRes.body.token;

        // Create group
        const groupRes = await request(app)
            .post('/api/groups')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
                encrypted_name: 'test',
                encrypted_group_key: 'key'
            });

        groupId = groupRes.body.group_id;

        // Create thread
        const threadRes = await request(app)
            .post('/api/threads')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
                group_id: groupId,
                encrypted_title: 'test',
                encrypted_body: 'test'
            });

        threadId = threadRes.body.thread_id;
    });

    describe('POST /api/media/upload', () => {
        it('should enforce file size limits', async () => {
            // Create buffer larger than 500MB
            const largeBuffer = Buffer.alloc(600 * 1024 * 1024);

            const res = await request(app)
                .post('/api/media/upload')
                .set('Authorization', `Bearer ${authToken}`)
                .attach('chunk', largeBuffer, 'large.mp4')
                .field('media_id', crypto.randomUUID())
                .field('thread_id', threadId)
                .field('chunk_index', 0)
                .field('total_chunks', 1);

            expect(res.status).toBe(413);
            expect(res.body.error).toBe('FILE_TOO_LARGE');
        });

        it('should accept valid small file', async () => {
            const smallBuffer = Buffer.alloc(1024); // 1KB

            const res = await request(app)
                .post('/api/media/upload')
                .set('Authorization', `Bearer ${authToken}`)
                .attach('chunk', smallBuffer, 'small.mp4')
                .field('media_id', crypto.randomUUID())
                .field('thread_id', threadId)
                .field('chunk_index', 0)
                .field('total_chunks', 1)
                .field('encrypted_metadata', '{}')
                .field('encryption_iv', 'test_iv');

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('media_id');
        });
    });
});
```

---

## Test Coverage Goals

### MVP Coverage Targets

| Component | Target Coverage | Priority |
|-----------|----------------|----------|
| Authentication | 80%+ | Critical |
| Encryption/Decryption | 90%+ | Critical |
| Media Upload | 70%+ | High |
| API Endpoints | 60%+ | High |
| Middleware | 60%+ | Medium |
| Utilities | 70%+ | Medium |

### Running Coverage Reports

```bash
# Generate coverage report
npm test -- --coverage

# View HTML coverage report
open coverage/lcov-report/index.html

# Check coverage thresholds
npm test -- --coverage --coverageReporters=text-summary
```

---

## Manual Testing

### Week 1: Core Functionality

**Participants:** Developer + 1 tester

**Daily Tests:**
1. ✅ Both users sign up successfully
2. ✅ Create group with invite code
3. ✅ Friend joins via invite code
4. ✅ Post 5 threads each with text
5. ✅ Upload 30-second video to thread
6. ✅ Verify friend can download and play video
7. ✅ Upload 3-5 photos, verify they display
8. ✅ Reply to all threads
9. ✅ Verify encryption (check database for plaintext)

**Success Metrics:**
- Zero crashes
- All messages decrypt correctly
- Videos play after download
- Media uploads complete successfully
- Latency < 500ms for text, < 30s for 50MB video
- Database and media storage contains only encrypted data

---

### Week 2: Media Stress Testing

**Participants:** 4 total users

**Tests:**
1. Create second group
2. Upload 100MB video, verify it works
3. Upload 500MB video (max size test)
4. Test concurrent uploads (2-3 users simultaneously)
5. Test auto-download behavior
6. Verify 7-day expiration (set test video to expire in 1 hour)
7. Test with 10+ threads containing media
8. Test logout/login with media in IndexedDB
9. Test on different browsers (Chrome, Firefox, Safari)
10. Document all bugs and confusion points

**Media-Specific Tests:**
- Upload fails gracefully over slow connection
- Progress indicators accurate
- Local storage management (what happens when full?)
- Verify media encryption (files on server are unreadable)

**Success Metrics:**
- UI remains responsive with large videos
- No data corruption in media
- Non-technical users can share videos easily
- Storage quotas enforced correctly

---

### Week 3: Family Testing

**Participants:** 8-10 real users (family members)

**Tests:**
1. Real conversation topics with family photos/videos
2. Share actual family videos (birthdays, holidays)
3. Test "grandma sharing baby video" scenario
4. Multiple family members downloading same video
5. Daily usage patterns with media
6. Feature requests tracking
7. Performance monitoring with real-world usage
8. Test on various devices (phones, tablets, computers)
9. Usability feedback collection

**Key Questions:**
- Do they check it daily?
- What features are immediately missing?
- Would they pay $99/year?
- Is threading better than chat?
- Can grandparents successfully use it?

---

## Browser Compatibility Testing

### Target Browsers

| Browser | Version | Priority |
|---------|---------|----------|
| Chrome | Latest | Critical |
| Firefox | Latest | Critical |
| Safari | Latest (macOS/iOS) | High |
| Edge | Latest | Medium |

### Features to Test

- WebCrypto API support
- IndexedDB functionality
- WebSocket connectivity
- Large file uploads (500MB)
- Video playback from blob URLs
- Markdown rendering

---

## Security Testing

### Manual Security Checks

1. **Encryption Verification:**
   - Connect to database, verify all content is encrypted
   - Check media files on server are encrypted
   - Inspect network traffic with browser DevTools (no plaintext)

2. **Authentication Testing:**
   - Try accessing endpoints without token (should fail)
   - Try using expired token (should fail)
   - Try SQL injection in username field

3. **XSS Testing:**
   - Post markdown with `<script>` tags
   - Verify DOMPurify strips dangerous HTML

4. **CSRF Testing:**
   - Try POST requests without CSRF token
   - Verify state-changing operations require CSRF token

5. **Rate Limiting:**
   - Attempt >10 login requests in 15 minutes
   - Verify rate limit headers in response

---

## Performance Testing

### Load Testing (Optional for MVP)

Use **Artillery** or **k6** for basic load testing:

```bash
# Install Artillery
npm install -g artillery

# Create test script (load-test.yml)
artillery quick --count 10 --num 50 http://localhost:3000/api/groups

# Run full load test
artillery run load-test.yml
```

### Metrics to Monitor

- API response time (p50, p95, p99)
- Database query time
- Memory usage during large file uploads
- WebSocket connection stability
- Concurrent user capacity

---

## Continuous Integration (Post-MVP)

### GitHub Actions Example

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: testpass
          POSTGRES_DB: orbital_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm test
        env:
          DATABASE_URL: postgresql://postgres:testpass@localhost:5432/orbital_test
          JWT_SECRET: test_secret
```

---

## Testing Checklist

### Before Each Release

- [ ] All automated tests pass
- [ ] Coverage meets minimum thresholds (60%)
- [ ] Manual testing completed for critical paths
- [ ] Browser compatibility verified
- [ ] Security checks performed
- [ ] Performance acceptable for expected load
- [ ] Database migrations tested
- [ ] Backup/restore tested
- [ ] Error handling works correctly
- [ ] WebSocket reconnection works
- [ ] Media encryption verified
- [ ] Storage quotas enforced

---

## Related Documentation

- **[API Specification](api-specification.md)** - Endpoints to test
- **[Encryption & Security](encryption-and-security.md)** - Security testing requirements
- **[Database Schema](database-schema.md)** - Database setup for tests
- **[Deployment & Operations](deployment-operations.md)** - Production testing
