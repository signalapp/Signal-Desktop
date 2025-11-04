# Orbital Frontend Architecture

**Frontend Approach:** Fork Signal-Desktop's React/TypeScript codebase and adapt UI for threaded discussions instead of chat.

---

## Overview

### From Signal-Desktop

**Signal-Desktop Stack:**
- **React** - UI framework
- **TypeScript** - Type-safe JavaScript
- **Redux** - State management (with custom middleware)
- **Electron** - Desktop app wrapper
- **SQLCipher** - Encrypted local database
- **libsignal (WASM)** - Signal Protocol implementation
- **Webpack** - Build system

**What We Keep:**
- ✅ All encryption infrastructure (libsignal, SQLCipher)
- ✅ React + TypeScript setup
- ✅ Redux state management
- ✅ Media handling components (video player, image gallery)
- ✅ Message composer and formatting
- ✅ Authentication and key management

**What We Modify:**
- 🔄 UI layout (chat → threaded forum)
- 🔄 Conversation list → Thread list
- 🔄 Message bubbles → Thread cards
- 🔄 Composer → Thread/reply composer

**What We Remove:**
- ❌ Voice/video calling
- ❌ Stories
- ❌ Payments
- ❌ Phone number verification UI
- ❌ Contact sync
- ❌ Linked devices

---

## Architecture Diagram

```
┌────────────────────────────────────────────────────────┐
│          Orbital Frontend (Electron + React)           │
├────────────────────────────────────────────────────────┤
│  React Components                                      │
│  ├── GroupList (adapted from ConversationList)        │
│  ├── ThreadList (new)                                 │
│  ├── ThreadCard (new - replaces MessageBubble)        │
│  ├── ThreadView (adapted from ConversationView)       │
│  ├── ReplyList (adapted from MessageList)             │
│  ├── ThreadComposer (adapted from CompositionArea)    │
│  └── MediaGallery (keep from Signal)                  │
├────────────────────────────────────────────────────────┤
│  Redux State Management                                │
│  ├── groups (adapted from conversations)              │
│  ├── threads (new)                                     │
│  ├── replies (new)                                     │
│  ├── media (new - for relay management)               │
│  └── user (keep from Signal)                          │
├────────────────────────────────────────────────────────┤
│  Services Layer                                        │
│  ├── SignalProtocolService (keep)                     │
│  ├── EncryptionService (keep - libsignal wrapper)     │
│  ├── ThreadingService (new - API client)              │
│  ├── MediaService (extend Signal's)                   │
│  └── WebSocketService (extend Signal's)               │
├────────────────────────────────────────────────────────┤
│  Data Layer                                            │
│  ├── SQLCipher Database (encrypted storage)           │
│  │   ├── messages (Signal's table)                    │
│  │   ├── threads (new table)                          │
│  │   ├── replies (new table)                          │
│  │   ├── media (new table)                            │
│  │   └── keys (Signal's table)                        │
│  └── libsignal (WASM) - Signal Protocol               │
└────────────────────────────────────────────────────────┘
         ↕ HTTPS/WSS
┌────────────────────────────────────────────────────────┐
│          Orbital Backend (Node.js + PostgreSQL)        │
└────────────────────────────────────────────────────────┘
```

---

## Project Structure

### Signal-Desktop Directory Layout (Adapted)

```
Orbital-Desktop/
├── ts/                          # TypeScript source
│   ├── components/              # React components
│   │   ├── GroupList.tsx        # Adapted from ConversationList
│   │   ├── ThreadList.tsx       # NEW - thread listing
│   │   ├── ThreadCard.tsx       # NEW - thread display card
│   │   ├── ThreadView.tsx       # Adapted from ConversationView
│   │   ├── ReplyList.tsx        # Adapted from MessageList
│   │   ├── ThreadComposer.tsx   # Adapted from CompositionArea
│   │   ├── MediaUploader.tsx    # Extend Signal's attachment UI
│   │   └── ...                  # Other Signal components
│   │
│   ├── state/                   # Redux state management
│   │   ├── ducks/
│   │   │   ├── groups.ts        # Adapted from conversations
│   │   │   ├── threads.ts       # NEW - thread state
│   │   │   ├── replies.ts       # NEW - reply state
│   │   │   ├── media.ts         # NEW - media relay state
│   │   │   └── user.ts          # Keep from Signal
│   │   └── selectors/
│   │       ├── threads.ts       # NEW - thread selectors
│   │       └── ...
│   │
│   ├── services/                # Business logic
│   │   ├── SignalProtocol.ts    # Keep - Signal Protocol wrapper
│   │   ├── Threading.ts         # NEW - API client for threads
│   │   ├── Media.ts             # Extend - media upload/download
│   │   └── WebSocket.ts         # Extend - real-time updates
│   │
│   ├── sql/                     # SQLCipher interface
│   │   ├── Client.ts            # Database client
│   │   ├── mainWorker.ts        # Worker thread for DB
│   │   └── Interface.ts         # Type definitions
│   │
│   ├── util/                    # Utilities
│   │   ├── encryption.ts        # Encryption helpers
│   │   ├── markdown.ts          # Markdown rendering
│   │   └── ...
│   │
│   └── background.ts            # Main process (Electron)
│
├── stylesheets/                 # CSS (SCSS)
│   ├── _threads.scss            # NEW - thread styles
│   ├── _replies.scss            # NEW - reply styles
│   └── ...
│
├── public/                      # Static files
├── build/                       # Build configuration
└── orbital-docs/                # Orbital documentation
```

---

## Key Components

### ThreadList Component

**Purpose:** Display list of threads in a group (replaces chat message list)

**Location:** `ts/components/ThreadList.tsx`

**Props:**
```typescript
interface ThreadListProps {
  groupId: string;
  threads: Array<Thread>;
  onThreadClick: (threadId: string) => void;
  onCreateThread: () => void;
}
```

**Component Structure:**
```tsx
const ThreadList: React.FC<ThreadListProps> = ({
  groupId,
  threads,
  onThreadClick,
  onCreateThread
}) => {
  return (
    <div className="thread-list">
      <div className="thread-list-header">
        <h2>Discussions</h2>
        <button onClick={onCreateThread}>New Thread</button>
      </div>

      <div className="thread-list-body">
        {threads.map(thread => (
          <ThreadCard
            key={thread.id}
            thread={thread}
            onClick={() => onThreadClick(thread.id)}
          />
        ))}
      </div>
    </div>
  );
};
```

---

### ThreadCard Component

**Purpose:** Display single thread preview (replaces message bubble)

**Location:** `ts/components/ThreadCard.tsx`

**Props:**
```typescript
interface ThreadCardProps {
  thread: Thread;
  onClick: () => void;
}

interface Thread {
  id: string;
  groupId: string;
  authorId: string;
  authorUsername: string;
  encryptedTitle: string;
  encryptedBody: string;
  decryptedTitle?: string;  // Decrypted client-side
  decryptedBody?: string;
  replyCount: number;
  mediaCount: number;
  createdAt: Date;
}
```

**Component:**
```tsx
const ThreadCard: React.FC<ThreadCardProps> = ({ thread, onClick }) => {
  const { decryptedTitle, decryptedBody, authorUsername, replyCount, mediaCount, createdAt } = thread;

  return (
    <div className="thread-card" onClick={onClick}>
      <div className="thread-card-header">
        <h3 className="thread-title">{decryptedTitle}</h3>
        <span className="thread-author">by {authorUsername}</span>
      </div>

      <div className="thread-card-body">
        <p className="thread-preview">
          {decryptedBody?.substring(0, 200)}...
        </p>
      </div>

      <div className="thread-card-footer">
        <span className="thread-meta">
          {replyCount} replies · {mediaCount} media
        </span>
        <span className="thread-date">
          {formatDate(createdAt)}
        </span>
      </div>
    </div>
  );
};
```

---

### ThreadView Component

**Purpose:** Display single thread with all replies (adapted from ConversationView)

**Location:** `ts/components/ThreadView.tsx`

**Props:**
```typescript
interface ThreadViewProps {
  thread: Thread;
  replies: Array<Reply>;
  onReply: (body: string) => void;
  onBack: () => void;
}
```

**Component Structure:**
```tsx
const ThreadView: React.FC<ThreadViewProps> = ({
  thread,
  replies,
  onReply,
  onBack
}) => {
  return (
    <div className="thread-view">
      {/* Header */}
      <div className="thread-view-header">
        <button onClick={onBack}>← Back</button>
        <h2>{thread.decryptedTitle}</h2>
      </div>

      {/* Original Thread */}
      <div className="thread-original">
        <div className="thread-author">{thread.authorUsername}</div>
        <div className="thread-body">
          <Markdown text={thread.decryptedBody} />
        </div>
        {thread.media && <MediaGallery media={thread.media} />}
        <div className="thread-date">{formatDate(thread.createdAt)}</div>
      </div>

      {/* Replies */}
      <div className="thread-replies">
        <h3>{replies.length} Replies</h3>
        <ReplyList replies={replies} />
      </div>

      {/* Reply Composer */}
      <ThreadComposer
        onSubmit={onReply}
        placeholder="Write a reply..."
      />
    </div>
  );
};
```

---

### ThreadComposer Component

**Purpose:** Compose new threads or replies (adapted from Signal's CompositionArea)

**Location:** `ts/components/ThreadComposer.tsx`

**Props:**
```typescript
interface ThreadComposerProps {
  mode: 'thread' | 'reply';
  onSubmit: (data: ThreadData | ReplyData) => void;
  placeholder?: string;
}

interface ThreadData {
  title: string;
  body: string;
  media?: File[];
}

interface ReplyData {
  body: string;
  media?: File[];
}
```

**Component:**
```tsx
const ThreadComposer: React.FC<ThreadComposerProps> = ({
  mode,
  onSubmit,
  placeholder
}) => {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [media, setMedia] = useState<File[]>([]);

  const handleSubmit = () => {
    if (mode === 'thread') {
      onSubmit({ title, body, media });
    } else {
      onSubmit({ body, media });
    }

    // Reset form
    setTitle('');
    setBody('');
    setMedia([]);
  };

  return (
    <div className="thread-composer">
      {mode === 'thread' && (
        <input
          type="text"
          placeholder="Thread title..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      )}

      <textarea
        placeholder={placeholder || 'Write your message...'}
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />

      <div className="composer-actions">
        <MediaPicker onSelect={setMedia} />
        <button onClick={handleSubmit} disabled={!body.trim()}>
          {mode === 'thread' ? 'Post Thread' : 'Reply'}
        </button>
      </div>

      {media.length > 0 && <MediaPreview files={media} />}
    </div>
  );
};
```

---

## State Management (Redux)

### Thread State (NEW)

**Location:** `ts/state/ducks/threads.ts`

**State Shape:**
```typescript
interface ThreadsState {
  byGroupId: {
    [groupId: string]: {
      threadIds: string[];
      totalCount: number;
      hasMore: boolean;
    };
  };
  byId: {
    [threadId: string]: Thread;
  };
  loading: boolean;
  error?: string;
}
```

**Actions:**
```typescript
// Fetch threads for group
export const fetchThreads = (groupId: string) => async (dispatch) => {
  dispatch({ type: 'threads/FETCH_START' });

  try {
    const response = await ThreadingService.getThreads(groupId);
    dispatch({
      type: 'threads/FETCH_SUCCESS',
      payload: { groupId, threads: response.threads }
    });
  } catch (error) {
    dispatch({ type: 'threads/FETCH_ERROR', error });
  }
};

// Create new thread
export const createThread = (groupId: string, title: string, body: string) =>
  async (dispatch, getState) => {
    // 1. Encrypt title and body with group Sender Key
    const groupKey = selectors.getGroupKey(getState(), groupId);
    const encryptedTitle = await EncryptionService.encrypt(title, groupKey);
    const encryptedBody = await EncryptionService.encrypt(body, groupKey);

    // 2. Send via API
    const response = await ThreadingService.createThread({
      groupId,
      encryptedTitle,
      encryptedBody
    });

    // 3. Add to local state
    dispatch({
      type: 'threads/CREATE_SUCCESS',
      payload: {
        groupId,
        thread: { ...response, decryptedTitle: title, decryptedBody: body }
      }
    });
  };
```

---

## Data Layer (SQLCipher)

### Thread Tables

**Add to Signal's SQLCipher database:**

```sql
-- Threads table
CREATE TABLE threads (
    id TEXT PRIMARY KEY,
    groupId TEXT NOT NULL,
    authorId TEXT NOT NULL,
    encryptedTitle TEXT NOT NULL,
    encryptedBody TEXT NOT NULL,
    createdAt INTEGER NOT NULL,
    replyCount INTEGER DEFAULT 0,
    mediaCount INTEGER DEFAULT 0
);

-- Replies table
CREATE TABLE replies (
    id TEXT PRIMARY KEY,
    threadId TEXT NOT NULL REFERENCES threads(id),
    authorId TEXT NOT NULL,
    encryptedBody TEXT NOT NULL,
    createdAt INTEGER NOT NULL,
    FOREIGN KEY (threadId) REFERENCES threads(id) ON DELETE CASCADE
);

-- Media table (local client storage)
CREATE TABLE media_local (
    id TEXT PRIMARY KEY,
    threadId TEXT REFERENCES threads(id),
    encryptedBlob BLOB NOT NULL,
    decryptedSize INTEGER NOT NULL,
    mimeType TEXT NOT NULL,
    uploadedAt INTEGER NOT NULL,
    expiresAt INTEGER  -- Server expiration (7 days)
);

-- Indexes
CREATE INDEX idx_threads_group ON threads(groupId, createdAt DESC);
CREATE INDEX idx_replies_thread ON replies(threadId, createdAt ASC);
```

### Database Service

**Location:** `ts/sql/Threads.ts`

```typescript
export async function saveThread(thread: Thread): Promise<void> {
  const db = await getDatabase();

  await db.run(
    `INSERT INTO threads (id, groupId, authorId, encryptedTitle, encryptedBody, createdAt)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      thread.id,
      thread.groupId,
      thread.authorId,
      thread.encryptedTitle,
      thread.encryptedBody,
      thread.createdAt
    ]
  );
}

export async function getThreadsByGroup(groupId: string, limit: number, offset: number): Promise<Thread[]> {
  const db = await getDatabase();

  const threads = await db.all(
    `SELECT * FROM threads WHERE groupId = ? ORDER BY createdAt DESC LIMIT ? OFFSET ?`,
    [groupId, limit, offset]
  );

  return threads;
}
```

---

## Encryption Integration (libsignal)

### Encrypting Thread Content

**Location:** `ts/services/Encryption.ts`

```typescript
import { encryptMessageWithSenderKey } from './SignalProtocol';

export async function encryptThreadContent(
  groupId: string,
  title: string,
  body: string
): Promise<{ encryptedTitle: string; encryptedBody: string }> {
  // Get group's Sender Key
  const senderKey = await getSenderKeyForGroup(groupId);

  // Encrypt with Signal Protocol
  const encryptedTitle = await encryptMessageWithSenderKey(title, senderKey);
  const encryptedBody = await encryptMessageWithSenderKey(body, senderKey);

  return { encryptedTitle, encryptedBody };
}

export async function decryptThreadContent(
  groupId: string,
  encryptedTitle: string,
  encryptedBody: string
): Promise<{ decryptedTitle: string; decryptedBody: string }> {
  // Get group's Sender Key
  const senderKey = await getSenderKeyForGroup(groupId);

  // Decrypt with Signal Protocol
  const decryptedTitle = await decryptMessageWithSenderKey(encryptedTitle, senderKey);
  const decryptedBody = await decryptMessageWithSenderKey(encryptedBody, senderKey);

  return { decryptedTitle, decryptedBody };
}
```

---

## API Integration

### Threading Service

**Location:** `ts/services/Threading.ts`

```typescript
class ThreadingService {
  private baseUrl: string;
  private authToken: string;

  constructor() {
    this.baseUrl = process.env.API_URL || 'http://localhost:3000';
    this.authToken = localStorage.getItem('auth_token') || '';
  }

  async getThreads(groupId: string, limit = 50, offset = 0): Promise<{ threads: Thread[] }> {
    const response = await fetch(
      `${this.baseUrl}/api/groups/${groupId}/threads?limit=${limit}&offset=${offset}`,
      {
        headers: {
          'Authorization': `Bearer ${this.authToken}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch threads: ${response.statusText}`);
    }

    return response.json();
  }

  async createThread(data: {
    groupId: string;
    encryptedTitle: string;
    encryptedBody: string;
  }): Promise<{ threadId: string; createdAt: string }> {
    const response = await fetch(`${this.baseUrl}/api/threads`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`Failed to create thread: ${response.statusText}`);
    }

    return response.json();
  }

  async getReplies(threadId: string): Promise<{ replies: Reply[] }> {
    const response = await fetch(
      `${this.baseUrl}/api/threads/${threadId}/replies`,
      {
        headers: {
          'Authorization': `Bearer ${this.authToken}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch replies: ${response.statusText}`);
    }

    return response.json();
  }
}

export default new ThreadingService();
```

---

## Build Process

### Signal-Desktop Build System

**Webpack Configuration:**
- Signal uses Webpack for bundling
- TypeScript compiled to JavaScript
- SCSS compiled to CSS
- Assets bundled into app

**Build Commands:**

```bash
# Development build (with hot reload)
npm run dev

# Production build
npm run build

# Type checking
npm run type-check

# Linting
npm run lint
```

**Electron Packaging:**

```bash
# Package for current platform
npm run package

# Package for all platforms
npm run package-all
```

---

## Styling

### SCSS Organization

**Location:** `stylesheets/`

**New Thread Styles:**

```scss
// stylesheets/_threads.scss
.thread-list {
  display: flex;
  flex-direction: column;
  height: 100%;

  &-header {
    display: flex;
    justify-content: space-between;
    padding: 16px;
    border-bottom: 1px solid var(--border-color);
  }

  &-body {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  }
}

.thread-card {
  background: var(--background-secondary);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: var(--background-hover);
  }

  &-header {
    margin-bottom: 8px;

    .thread-title {
      font-size: 18px;
      font-weight: 600;
      margin: 0 0 4px 0;
    }

    .thread-author {
      font-size: 14px;
      color: var(--text-secondary);
    }
  }

  &-body {
    margin-bottom: 12px;

    .thread-preview {
      font-size: 14px;
      color: var(--text-primary);
      margin: 0;
    }
  }

  &-footer {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    color: var(--text-secondary);
  }
}
```

---

## Related Documentation

- **[Encryption & Security](encryption-and-security.md)** - libsignal integration
- **[API Specification](api-specification.md)** - Backend API calls
- **[WebSocket & Real-Time](websocket-realtime.md)** - Real-time updates
- **[Testing Strategy](testing-strategy.md)** - Frontend testing
- **[Signal Fork Strategy](signal-fork-strategy.md)** - Overall architecture approach
