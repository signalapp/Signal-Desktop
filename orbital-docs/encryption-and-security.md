# Orbital Encryption & Security

**Security Model:** Orbital inherits Signal's proven E2EE infrastructure and extends it for threaded discussions.

---

## Overview

**Orbital's Encryption Strategy:**
- **Inherit Signal Protocol** for all message encryption (E2EE with forward secrecy)
- **Use libsignal** (Rust → WASM) for all cryptographic operations
- **Extend** Signal's infrastructure for threading metadata
- **Add** media relay encryption (7-day temporary storage)

**Core Principle:** Never reinvent cryptography. Use Signal's battle-tested implementation.

---

## Signal Protocol Integration

### What We Get from Signal

**libsignal** provides:
- **Double Ratchet Algorithm** - Forward & backward secrecy (keys rotate per message)
- **X3DH (Extended Triple Diffie-Hellman)** - Asynchronous key agreement (works offline)
- **Sender Keys** - Efficient group messaging (multicast encryption)
- **Sealed Sender** - Optional metadata protection (hide sender from server)
- **Ed25519** - Digital signatures for authentication
- **Curve25519** - Elliptic curve key exchange

### How We Use Signal Protocol

```
┌─────────────────────────────────────────────────┐
│   Orbital Frontend (Signal-Desktop Fork)        │
├─────────────────────────────────────────────────┤
│  libsignal (WASM)                               │
│  ├── Signal Protocol (E2EE)                     │
│  ├── Key Management                             │
│  └── Message Encryption/Decryption              │
├─────────────────────────────────────────────────┤
│  SQLCipher (Encrypted Local Storage)            │
│  ├── Private Keys                               │
│  ├── Group Keys (Sender Keys)                   │
│  ├── Message History                            │
│  └── Downloaded Media (decrypted)               │
└─────────────────────────────────────────────────┘
         ↕ Encrypted Envelopes Only
┌─────────────────────────────────────────────────┐
│   Orbital Backend (Node.js + PostgreSQL)        │
├─────────────────────────────────────────────────┤
│  Signal Protocol Relay                          │
│  ├── Routes encrypted envelopes                 │
│  ├── No access to plaintext                     │
│  └── Stores only encrypted data                 │
├─────────────────────────────────────────────────┤
│  Threading Layer (Encrypted Metadata)           │
│  ├── Thread associations (which messages)       │
│  ├── Encrypted thread titles                    │
│  └── Group structure (encrypted names)          │
└─────────────────────────────────────────────────┘
```

---

## Key Management

### User Key Pairs (Signal Protocol)

**Registration Flow:**

1. **Client generates identity key pair** (Curve25519)
   - Private key stored in SQLCipher (never leaves device)
   - Public key uploaded to server during registration

2. **Client generates prekeys**
   - Signed prekey (rotates weekly)
   - One-time prekeys (consumed during key exchange)

3. **Server stores only public keys**
   - Identity public key
   - Signed prekey
   - One-time prekeys

**Implementation:** Signal-Desktop handles this automatically via libsignal.

---

### Group Keys (Sender Keys)

**Group Key Distribution:**

```
When creating a group:
1. Creator generates Sender Key (via Signal Protocol)
2. Sender Key distributed to each member via X3DH
3. Each member receives encrypted copy (only they can decrypt)
4. All group messages encrypted with Sender Key
5. Key rotates when membership changes
```

**Why Sender Keys?**
- Efficient multicast: Encrypt once, send to all members
- Works offline: Members can receive keys asynchronously
- Forward secrecy: Keys rotate when group changes
- Proven protocol: Used by Signal, WhatsApp, etc.

**Orbital Threading Addition:**
- Thread metadata (title, associations) encrypted with group Sender Key
- Server sees encrypted thread structure, not content

---

## Message Encryption

### Text Messages (Threads & Replies)

**Encryption Flow:**

```
1. User writes thread/reply
2. Content encrypted with group Sender Key (via libsignal)
3. Encrypted envelope sent to server
4. Server routes envelope to group members
5. Recipients decrypt with their copy of Sender Key
```

**What Server Sees:**
```json
{
  "encrypted_envelope": "base64_encrypted_data",
  "recipient_group_id": "uuid",
  "timestamp": 1234567890
}
```

**What Server CANNOT See:**
- Message content
- Thread title
- Author identity (if sealed sender enabled)
- Relationships between messages

---

### Media Encryption

**Video/Photo Encryption:**

Orbital uses Signal's attachment encryption protocol:

```
Upload Flow:
1. Client generates random attachment key (256-bit AES-GCM key)
2. Client encrypts media with attachment key
3. Encrypted media uploaded to server (chunked for large files)
4. Attachment key encrypted with group Sender Key
5. Encrypted key sent to group members via Signal envelope

Download Flow:
1. Recipient receives encrypted attachment key in message
2. Recipient decrypts attachment key with Sender Key
3. Recipient downloads encrypted media from server
4. Recipient decrypts media with attachment key
5. Decrypted media stored in SQLCipher (client-side)
```

**Server Storage:**
- Encrypted media blobs (7-day retention)
- No access to decryption keys
- No ability to read media content

**Media Encryption Details:**
```javascript
// Signal's media encryption (simplified)
{
  "encrypted_blob": "encrypted_video.enc",
  "attachment_key": "encrypted_with_sender_key",
  "digest": "sha256_of_plaintext",
  "size": 524288000,
  "expires_at": "2024-11-11T00:00:00Z"
}
```

---

## Database Encryption

### Client-Side: SQLCipher

**What is SQLCipher?**
- Encrypted SQLite database
- Full database encryption (not just sensitive fields)
- Used by Signal-Desktop for all local storage

**What We Store Encrypted:**
- Private keys (identity key, session keys)
- Message history (threads & replies)
- Group keys (Sender Keys)
- Downloaded media (decrypted for playback)
- User preferences

**Encryption Key:**
- Derived from user's local passphrase (Signal's approach)
- Stored in OS secure storage (Keychain on macOS, etc.)
- Never sent to server

---

### Server-Side: PostgreSQL

**What Server Stores:**

```sql
-- All content is encrypted
CREATE TABLE signal_messages (
    id UUID PRIMARY KEY,
    conversation_id UUID NOT NULL,
    encrypted_envelope BYTEA NOT NULL,  -- Signal envelope
    server_timestamp TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

CREATE TABLE threads (
    id UUID PRIMARY KEY,
    group_id UUID NOT NULL,
    root_message_id UUID REFERENCES signal_messages(id),
    encrypted_title TEXT NOT NULL,  -- Encrypted with group key
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE media (
    id UUID PRIMARY KEY,
    thread_id UUID REFERENCES threads(id),
    encrypted_blob_path TEXT NOT NULL,  -- Path to encrypted file
    encryption_iv VARCHAR(32) NOT NULL,  -- IV for media encryption
    size_bytes BIGINT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
);
```

**Server CANNOT Access:**
- Message plaintext (encrypted envelopes only)
- Thread content (encrypted titles and bodies)
- Media content (encrypted blobs, no keys)
- User identities (optional with sealed sender)

---

## Security Properties

### Forward Secrecy

**What is Forward Secrecy?**
If an attacker compromises a key today, they cannot decrypt past messages.

**How Signal Provides It:**
- Double Ratchet rotates keys with every message
- Each message encrypted with unique key
- Old keys deleted after use
- Compromising current key doesn't expose history

**Orbital Benefits:**
- Family videos remain secure even if device lost
- No single "group key" compromise exposes all history
- Automatic key rotation on group membership changes

---

### Sealed Sender (Optional)

**What is Sealed Sender?**
Hides sender identity from server (metadata protection).

**How It Works:**
```
Normal Message:
Server sees: Alice → Family Group (knows who sent)

Sealed Sender:
Server sees: ??? → Family Group (doesn't know sender)
Recipients decrypt and verify sender signature
```

**Trade-offs:**
- ✅ Better metadata privacy
- ⚠️ Slightly higher bandwidth
- ⚠️ More complex debugging

**Orbital Decision:** Optional for MVP, can enable per-group.

---

### Authentication

**Message Authentication:**
- Every message signed with sender's Ed25519 key
- Recipients verify signature before displaying
- Prevents spoofing and tampering

**Group Membership Verification:**
- Signal Protocol verifies all key exchanges
- Safety numbers allow manual verification
- Trust-on-first-use (TOFU) model

---

## Security Audit Checklist

### Before MVP Launch

**Encryption Verification:**
- [ ] Database inspection shows only encrypted content
- [ ] Network traffic inspection shows no plaintext
- [ ] Media files on server are encrypted
- [ ] SQLCipher encrypted on client
- [ ] All Signal Protocol checks pass

**Key Management:**
- [ ] Private keys never leave client
- [ ] Public keys properly distributed
- [ ] Group keys properly rotated
- [ ] Key deletion on expiration

**Implementation Security:**
- [ ] No custom crypto (only Signal Protocol)
- [ ] SQL injection protection (parameterized queries)
- [ ] XSS protection (DOMPurify for markdown)
- [ ] CSRF protection (tokens on state changes)
- [ ] Rate limiting (API endpoints)
- [ ] Input validation (all endpoints)

**Server Security:**
- [ ] HTTPS/TLS only (no HTTP)
- [ ] WebSocket over WSS (secure WebSocket)
- [ ] Firewall configured (only 22, 80, 443)
- [ ] Database not exposed to public
- [ ] Security headers (Helmet.js)

---

## Threat Model

### What We Protect Against

**✅ Server Compromise:**
- Server breach exposes only encrypted data
- No private keys on server
- Forward secrecy protects message history

**✅ Network Eavesdropping:**
- All traffic over TLS
- Message content encrypted end-to-end
- Metadata minimized (sealed sender optional)

**✅ Malicious Group Members:**
- Cannot decrypt messages before they joined
- Cannot impersonate other members (signatures)
- Cannot modify others' messages (authentication)

**✅ Key Compromise (Past Messages):**
- Forward secrecy protects history
- Compromised key only exposes future messages
- Key rotation limits exposure window

---

### What We DON'T Protect Against (Yet)

**⚠️ Client-Side Attacks:**
- Malware on user's device (access to SQLCipher)
- Physical device access (screen recording, keyloggers)
- **Mitigation:** OS-level security, device encryption

**⚠️ Metadata Analysis:**
- Server knows which groups exist
- Server knows message timing patterns
- Server knows group membership
- **Mitigation:** Sealed sender (optional), future work

**⚠️ Advanced Persistent Threats:**
- State-level attackers with device backdoors
- **Mitigation:** Out of scope for MVP

---

## Comparison to Build-From-Scratch Approach

| Security Feature | Build From Scratch | Signal Fork (Orbital) |
|-----------------|-------------------|---------------------|
| **Forward Secrecy** | ❌ No (single group key) | ✅ Yes (Double Ratchet) |
| **Key Exchange** | ⚠️ Custom (database-backed) | ✅ X3DH (proven) |
| **Authentication** | ❌ No signatures | ✅ Ed25519 signatures |
| **Client Storage** | ⚠️ IndexedDB (XSS vulnerable) | ✅ SQLCipher (encrypted) |
| **Metadata Protection** | ❌ None | ✅ Sealed Sender (optional) |
| **Security Audit** | ❌ Needed post-launch | ✅ Inherited from Signal |
| **Group Encryption** | ⚠️ Single AES key | ✅ Sender Keys (rotating) |
| **Implementation Time** | 5+ days | ✅ Immediate (use Signal's) |

**Verdict:** Signal fork provides enterprise-grade security with zero custom crypto work.

---

## Implementation Guide

### Using libsignal in Orbital

**Signal-Desktop Already Includes:**
- libsignal WASM bindings
- Key management utilities
- Message encryption/decryption APIs
- Group key management

**Our Job:**
1. **Keep Signal Protocol Intact** - Don't modify encryption code
2. **Extend Message Metadata** - Add thread associations (encrypted)
3. **Use Sender Keys for Threads** - Thread titles encrypted with group key
4. **Verify Encryption Working** - Audit database for plaintext

**Example: Creating Encrypted Thread**

```javascript
// This happens automatically via Signal-Desktop APIs
// We just need to use the existing message sending flow

async function createThread(groupId, title, body) {
  // 1. Encrypt title and body with group Sender Key
  const encryptedTitle = await encryptWithSenderKey(groupId, title);
  const encryptedBody = await encryptWithSenderKey(groupId, body);

  // 2. Send encrypted envelope via Signal Protocol
  const message = {
    type: 'thread_create',
    encrypted_title: encryptedTitle,
    encrypted_body: encryptedBody,
    timestamp: Date.now()
  };

  await sendSignalMessage(groupId, message);

  // 3. Server stores encrypted envelope + thread metadata
  // Server CANNOT read title or body
}
```

**Testing Encryption:**

```bash
# Connect to database
psql orbital

# Check that content is encrypted
SELECT encrypted_title FROM threads LIMIT 1;
# Should see: encrypted base64 string, NOT plaintext

# Check Signal envelopes
SELECT encrypted_envelope FROM signal_messages LIMIT 1;
# Should see: binary encrypted data
```

---

## Additional Resources

- **Signal Protocol Specification:** https://signal.org/docs/
- **libsignal Documentation:** https://github.com/signalapp/libsignal
- **Signal-Desktop Security:** https://github.com/signalapp/Signal-Desktop/blob/main/SECURITY.md
- **Double Ratchet Algorithm:** https://signal.org/docs/specifications/doubleratchet/
- **X3DH Specification:** https://signal.org/docs/specifications/x3dh/

---

## Security Contact

**Report vulnerabilities privately to:** [Set up security email]

**DO NOT** disclose security issues publicly before coordinating with maintainers.

---

## Related Documentation

- **[Signal Fork Strategy](signal-fork-strategy.md)** - Why we chose Signal
- **[Database Schema](database-schema.md)** - What's stored encrypted
- **[API Specification](api-specification.md)** - How encrypted data flows
- **[Testing Strategy](testing-strategy.md)** - Security testing plan
