# Orbital WebSocket & Real-Time Updates

**Real-Time Communication:** Orbital uses WebSockets for instant delivery of encrypted messages, thread updates, and notifications.

---

## Overview

**Why WebSockets?**
- Instant message delivery (no polling)
- Efficient bi-directional communication
- Low latency for real-time updates
- Battery-friendly (vs. frequent HTTP polling)

**Signal's Approach:**
- Signal-Desktop uses WebSockets for message delivery
- Orbital extends this for threading notifications
- Same security model (encrypted envelopes only)

---

## WebSocket Connection

### Endpoint

**Production:** `wss://api.orbital.example.com/ws`

**Development:** `ws://localhost:3000/ws`

**Protocol:** WebSocket Secure (WSS) in production, WS in development

---

### Authentication

**Method 1: Query Parameter (Recommended)**

```javascript
const token = localStorage.getItem('auth_token');
const ws = new WebSocket(`wss://api.orbital.example.com/ws?token=${token}`);
```

**Method 2: Upgrade Header**

```javascript
const ws = new WebSocket('wss://api.orbital.example.com/ws', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

**Server Verification:**
1. Server validates JWT token
2. If valid: WebSocket connection established
3. If invalid: Connection rejected with `401 Unauthorized`

---

### Connection Lifecycle

```
Client                          Server
  |                               |
  |--- WebSocket Upgrade -------> |
  |    (with JWT token)           |
  |                               |
  | <-- 101 Switching Protocols --|
  |                               |
  | <-- auth_success ------------ |
  |                               |
  |--- subscribe (groups) ------> |
  |                               |
  | <-- subscribed --------------- |
  |                               |
  |       [Connected State]       |
  |                               |
  | <-- ping (every 30s) --------- |
  |--- pong --------------------> |
  |                               |
  | <-- new_message -------------- |
  | <-- new_thread --------------- |
  |                               |
  |--- close -------------------> |
  | <-- close -------------------- |
```

---

## Message Format

### Client → Server Messages

**All messages in JSON format:**

```json
{
  "type": "message_type",
  "data": {...},
  "timestamp": 1699123456789
}
```

### Server → Client Messages

```json
{
  "type": "event_type",
  "data": {...},
  "server_timestamp": 1699123456789
}
```

---

## Connection Events

### auth_success

**Direction:** Server → Client

**Sent:** Immediately after WebSocket connection established

```json
{
  "type": "auth_success",
  "data": {
    "user_id": "uuid",
    "username": "string",
    "connected_at": "2024-11-04T12:00:00Z"
  }
}
```

**Client Action:** Proceed to subscribe to groups

---

### subscribe

**Direction:** Client → Server

**Purpose:** Subscribe to real-time updates for specific groups

```json
{
  "type": "subscribe",
  "data": {
    "group_ids": ["uuid1", "uuid2", "uuid3"]
  }
}
```

**Server Action:** Add client to group notification lists

---

### subscribed

**Direction:** Server → Client

**Sent:** Confirmation of successful subscription

```json
{
  "type": "subscribed",
  "data": {
    "group_ids": ["uuid1", "uuid2", "uuid3"],
    "subscribed_at": "2024-11-04T12:00:00Z"
  }
}
```

---

### unsubscribe

**Direction:** Client → Server

**Purpose:** Unsubscribe from group updates

```json
{
  "type": "unsubscribe",
  "data": {
    "group_ids": ["uuid1"]
  }
}
```

---

## Real-Time Events

### new_message

**Direction:** Server → Client

**Sent:** When new Signal Protocol message envelope received for subscribed group

```json
{
  "type": "new_message",
  "data": {
    "message_id": "uuid",
    "conversation_id": "uuid (group_id)",
    "encrypted_envelope": "base64_protobuf",
    "server_timestamp": 1699123456789
  },
  "server_timestamp": 1699123456789
}
```

**Client Action:**
1. Receive encrypted envelope
2. Decrypt using Signal Protocol (libsignal)
3. Update UI with decrypted content
4. Store in SQLCipher

**Server Behavior:**
- Only sends to subscribed group members
- Only sends encrypted envelopes (no plaintext)
- Guarantees delivery order within group

---

### new_thread

**Direction:** Server → Client

**Sent:** When new thread created in subscribed group

```json
{
  "type": "new_thread",
  "data": {
    "thread_id": "uuid",
    "group_id": "uuid",
    "author_id": "uuid",
    "author_username": "string",
    "encrypted_title": "base64",
    "encrypted_body": "base64",
    "created_at": "2024-11-04T12:00:00Z"
  },
  "server_timestamp": 1699123456789
}
```

**Client Action:**
1. Decrypt title and body with group Sender Key
2. Add thread to local thread list
3. Display notification (if enabled)

---

### new_reply

**Direction:** Server → Client

**Sent:** When new reply posted to thread in subscribed group

```json
{
  "type": "new_reply",
  "data": {
    "reply_id": "uuid",
    "thread_id": "uuid",
    "author_id": "uuid",
    "author_username": "string",
    "encrypted_body": "base64",
    "created_at": "2024-11-04T12:10:00Z"
  },
  "server_timestamp": 1699123456789
}
```

**Client Action:**
1. Decrypt body with group Sender Key
2. Add reply to thread view
3. Increment reply count
4. Display notification

---

### media_uploaded

**Direction:** Server → Client

**Sent:** When media upload completed for thread in subscribed group

```json
{
  "type": "media_uploaded",
  "data": {
    "media_id": "uuid",
    "thread_id": "uuid",
    "author_id": "uuid",
    "encrypted_metadata": "base64",
    "size_bytes": 52428800,
    "expires_at": "2024-11-11T12:00:00Z"
  },
  "server_timestamp": 1699123456789
}
```

**Client Action:**
1. Display media indicator in thread
2. Auto-download if WiFi + auto-download enabled
3. Show "Download" button otherwise

---

### member_joined

**Direction:** Server → Client

**Sent:** When new member joins subscribed group

```json
{
  "type": "member_joined",
  "data": {
    "group_id": "uuid",
    "user_id": "uuid",
    "username": "string",
    "joined_at": "2024-11-04T12:00:00Z"
  },
  "server_timestamp": 1699123456789
}
```

**Client Action:**
1. Update group member list
2. Optionally show notification

---

### typing_indicator (Optional - Post-MVP)

**Direction:** Client → Server → Other Clients

**Purpose:** Show who's typing in real-time

```json
{
  "type": "typing_indicator",
  "data": {
    "thread_id": "uuid",
    "user_id": "uuid",
    "username": "string",
    "is_typing": true
  }
}
```

---

## Heartbeat / Keep-Alive

### ping

**Direction:** Server → Client

**Sent:** Every 30 seconds

```json
{
  "type": "ping",
  "data": {
    "server_time": 1699123456789
  }
}
```

**Client Action:** Respond with `pong`

---

### pong

**Direction:** Client → Server

**Sent:** In response to `ping`

```json
{
  "type": "pong",
  "data": {
    "client_time": 1699123456789
  }
}
```

**Server Action:**
- Confirms client is alive
- If no `pong` received after 3 pings (90s), disconnect client

---

## Reconnection Logic

### Client-Side Reconnection

**When to Reconnect:**
- Connection lost (network interruption)
- Server timeout (no pong received)
- Server restart

**Exponential Backoff:**

```javascript
const reconnectDelays = [1000, 2000, 4000, 8000, 16000, 32000]; // ms
let reconnectAttempt = 0;

function reconnect() {
  if (reconnectAttempt >= reconnectDelays.length) {
    console.error('Max reconnection attempts reached');
    return;
  }

  const delay = reconnectDelays[reconnectAttempt];
  setTimeout(() => {
    console.log(`Reconnecting (attempt ${reconnectAttempt + 1})...`);
    connectWebSocket();
    reconnectAttempt++;
  }, delay);
}
```

**On Successful Reconnection:**
1. Reset `reconnectAttempt` to 0
2. Re-subscribe to groups
3. Fetch missed messages (using REST API)

---

### Message Recovery After Reconnection

**Client tracks last received message timestamp:**

```javascript
let lastMessageTimestamp = 0;

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  lastMessageTimestamp = message.server_timestamp;
  // Handle message...
};

// On reconnection
async function recoverMissedMessages() {
  const response = await fetch(`/v1/messages?since=${lastMessageTimestamp}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const { messages } = await response.json();

  messages.forEach(msg => {
    // Process missed messages
    processMessage(msg);
  });
}
```

---

## Client Implementation

### JavaScript WebSocket Manager

```javascript
class OrbitalWebSocketManager {
  constructor(apiUrl, token) {
    this.apiUrl = apiUrl;
    this.token = token;
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelays = [1000, 2000, 4000, 8000, 16000, 32000];
    this.subscribedGroups = [];
    this.eventHandlers = {};
  }

  connect() {
    this.ws = new WebSocket(`${this.apiUrl}/ws?token=${this.token}`);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      this.resubscribeToGroups();
    };

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleMessage(message);
    };

    this.ws.onclose = (event) => {
      console.log('WebSocket closed', event.code, event.reason);
      this.reconnect();
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error', error);
    };
  }

  handleMessage(message) {
    const { type, data } = message;

    switch (type) {
      case 'ping':
        this.send({ type: 'pong', data: { client_time: Date.now() } });
        break;

      case 'new_message':
      case 'new_thread':
      case 'new_reply':
      case 'media_uploaded':
      case 'member_joined':
        this.emit(type, data);
        break;

      default:
        console.warn('Unknown message type:', type);
    }
  }

  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        ...message,
        timestamp: Date.now()
      }));
    }
  }

  subscribe(groupIds) {
    this.subscribedGroups = [...new Set([...this.subscribedGroups, ...groupIds])];
    this.send({
      type: 'subscribe',
      data: { group_ids: groupIds }
    });
  }

  unsubscribe(groupIds) {
    this.subscribedGroups = this.subscribedGroups.filter(
      id => !groupIds.includes(id)
    );
    this.send({
      type: 'unsubscribe',
      data: { group_ids: groupIds }
    });
  }

  resubscribeToGroups() {
    if (this.subscribedGroups.length > 0) {
      this.subscribe(this.subscribedGroups);
    }
  }

  reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.emit('max_reconnect_attempts');
      return;
    }

    const delay = this.reconnectDelays[
      Math.min(this.reconnectAttempts, this.reconnectDelays.length - 1)
    ];

    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);

    setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  on(event, handler) {
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = [];
    }
    this.eventHandlers[event].push(handler);
  }

  emit(event, data) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].forEach(handler => handler(data));
    }
  }

  close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

// Usage
const wsManager = new OrbitalWebSocketManager('wss://api.orbital.example.com', authToken);

wsManager.on('new_thread', (data) => {
  console.log('New thread:', data);
  // Update UI
});

wsManager.on('new_reply', (data) => {
  console.log('New reply:', data);
  // Update thread view
});

wsManager.connect();
wsManager.subscribe(['group-uuid-1', 'group-uuid-2']);
```

---

## Server Implementation (Node.js)

### WebSocket Server Setup

```javascript
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');

const wss = new WebSocket.Server({ noServer: true });

// Handle WebSocket upgrade
server.on('upgrade', (request, socket, head) => {
  // Extract token from query or header
  const url = new URL(request.url, 'http://localhost');
  const token = url.searchParams.get('token');

  // Verify JWT
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    request.user = decoded;

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } catch (err) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
  }
});

// Connection handler
wss.on('connection', (ws, request) => {
  const user = request.user;
  ws.userId = user.userId;
  ws.subscribedGroups = [];
  ws.isAlive = true;

  console.log(`User ${user.username} connected`);

  // Send auth success
  ws.send(JSON.stringify({
    type: 'auth_success',
    data: {
      user_id: user.userId,
      username: user.username,
      connected_at: new Date().toISOString()
    }
  }));

  // Handle incoming messages
  ws.on('message', (data) => {
    const message = JSON.parse(data);
    handleClientMessage(ws, message);
  });

  // Pong received
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  // Connection closed
  ws.on('close', () => {
    console.log(`User ${user.username} disconnected`);
  });
});

// Heartbeat interval (30 seconds)
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      return ws.terminate();
    }

    ws.isAlive = false;
    ws.send(JSON.stringify({
      type: 'ping',
      data: { server_time: Date.now() }
    }));
  });
}, 30000);

// Handle client messages
function handleClientMessage(ws, message) {
  switch (message.type) {
    case 'pong':
      ws.isAlive = true;
      break;

    case 'subscribe':
      ws.subscribedGroups = message.data.group_ids;
      ws.send(JSON.stringify({
        type: 'subscribed',
        data: {
          group_ids: ws.subscribedGroups,
          subscribed_at: new Date().toISOString()
        }
      }));
      break;

    case 'unsubscribe':
      ws.subscribedGroups = ws.subscribedGroups.filter(
        id => !message.data.group_ids.includes(id)
      );
      break;
  }
}

// Broadcast to group
function broadcastToGroup(groupId, event) {
  wss.clients.forEach((client) => {
    if (client.subscribedGroups.includes(groupId) &&
        client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        ...event,
        server_timestamp: Date.now()
      }));
    }
  });
}

// Example: Notify group of new thread
function notifyNewThread(thread) {
  broadcastToGroup(thread.group_id, {
    type: 'new_thread',
    data: thread
  });
}
```

---

## Error Handling

### Client-Side Errors

```javascript
ws.onerror = (error) => {
  console.error('WebSocket error:', error);
  // Show user-friendly message
  showNotification('Connection error. Attempting to reconnect...');
};

ws.onclose = (event) => {
  if (event.code === 1000) {
    // Normal closure
    console.log('WebSocket closed normally');
  } else if (event.code === 1006) {
    // Abnormal closure (network issue)
    console.log('Connection lost. Reconnecting...');
    reconnect();
  } else if (event.code === 1008) {
    // Policy violation (e.g., invalid token)
    console.error('Authentication failed');
    redirectToLogin();
  }
};
```

### Server-Side Errors

```javascript
ws.on('error', (error) => {
  console.error(`WebSocket error for user ${ws.userId}:`, error);
  ws.terminate();
});
```

---

## Performance Considerations

### Scalability

**Single Server (MVP):**
- ~1000 concurrent WebSocket connections
- Sufficient for 100-500 families

**Multi-Server (Future):**
- Use Redis Pub/Sub for cross-server messaging
- Load balancer with sticky sessions
- Shared subscription state in Redis

---

### Bandwidth Optimization

**Only send updates to subscribed clients:**
- Client subscribes to specific groups
- Server only sends relevant events
- Reduces unnecessary traffic

**Compression:**
- Enable WebSocket per-message deflate
- Reduces payload size by 60-80%

---

## Security Considerations

### Authentication

- ✅ JWT token required for connection
- ✅ Token validated before upgrade
- ✅ Invalid token = connection rejected

### Encrypted Content

- ✅ All message content encrypted (Signal Protocol)
- ✅ Server relays opaque envelopes only
- ✅ No plaintext in WebSocket messages

### Rate Limiting

- ✅ Max 5 connection attempts per minute per IP
- ✅ Max reconnection attempts enforced client-side

---

## Testing WebSocket Connection

### Browser DevTools

```javascript
// In browser console
const ws = new WebSocket('ws://localhost:3000/ws?token=YOUR_TOKEN');

ws.onopen = () => console.log('Connected');
ws.onmessage = (event) => console.log('Message:', JSON.parse(event.data));
ws.onerror = (error) => console.error('Error:', error);

// Subscribe to groups
ws.send(JSON.stringify({
  type: 'subscribe',
  data: { group_ids: ['group-uuid'] }
}));
```

### Testing Tools

- **wscat:** CLI WebSocket client
- **Postman:** WebSocket testing support
- **Artillery:** Load testing WebSockets

```bash
# Install wscat
npm install -g wscat

# Connect to WebSocket
wscat -c "ws://localhost:3000/ws?token=YOUR_TOKEN"

# Send subscribe message
{"type":"subscribe","data":{"group_ids":["uuid"]}}
```

---

## Related Documentation

- **[API Specification](api-specification.md)** - REST API endpoints
- **[Encryption & Security](encryption-and-security.md)** - WebSocket security model
- **[Frontend Architecture](frontend-architecture.md)** - How UI integrates WebSocket
- **[Testing Strategy](testing-strategy.md)** - WebSocket testing approach
