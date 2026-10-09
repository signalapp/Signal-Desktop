// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// Development tool: a reference client for the external-client bridge.
/* oxlint-disable no-console, no-plusplus, no-undef, no-await-in-loop -- standalone Node script */

// Minimal external client for Milestones A to E. No dependencies.
// Works on Windows (named pipe), Linux and macOS (Unix socket).
//
//   node docs/external-client-probe.node.mjs --request      first run: asks Signal for approval
//   node docs/external-client-probe.node.mjs                later runs: authenticates, lists chats
//
// Options:
//   --user-data <dir>     Signal profile dir (default: the platform default)
//   --endpoint <path>     connect here instead of computing the endpoint
//   --key <file>          client key file (default: per-user config dir)
//   --limit <n>           conversations to list (default 10)
//   --messages <n>        also print the last n messages of the first
//                         conversation listed (needs messages.read)
//   --watch               stay connected and print live events until Ctrl+C
//   --capabilities <list> with --request: comma-separated capabilities to ask
//                         for (default conversations.read,messages.read)
//   --to <title>          conversation for --send/--mark-read, by exact title
//                         (default: Note to Self)
//   --send <text>         send a text message (needs messages.send)
//   --mark-read           mark the target conversation read up to its newest
//                         message (needs messages.markRead)
//   --notifications       with --watch: take over message notifications
//                         while connected (needs notifications.manage)
//
// The key file holds this probe's Ed25519 private key and the Signal server
// key it pinned on approval. Delete it to start over.
import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  randomBytes,
  sign,
  verify,
} from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { connect } from 'node:net';
import { homedir, userInfo } from 'node:os';
import { dirname, join } from 'node:path';

const CLIENT_LABEL = 'signal-external-client/v1/client-auth';
const SERVER_LABEL = 'signal-external-client/v1/server-auth';

function parseArgs(argv) {
  const out = {
    request: false,
    limit: 10,
    messages: 0,
    watch: false,
    capabilities: ['conversations.read', 'messages.read'],
    markRead: false,
    notifications: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--request') out.request = true;
    else if (arg === '--user-data') out.userData = argv[++i];
    else if (arg === '--endpoint') out.endpoint = argv[++i];
    else if (arg === '--key') out.keyFile = argv[++i];
    else if (arg === '--limit') out.limit = Number(argv[++i]);
    else if (arg === '--messages') out.messages = Number(argv[++i]);
    else if (arg === '--watch') out.watch = true;
    else if (arg === '--capabilities')
      out.capabilities = argv[++i].split(',').filter(Boolean);
    else if (arg === '--to') out.to = argv[++i];
    else if (arg === '--send') out.send = argv[++i];
    else if (arg === '--mark-read') out.markRead = true;
    else if (arg === '--notifications') out.notifications = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  return out;
}

function configDir() {
  if (process.platform === 'win32')
    return join(process.env.APPDATA, 'signal-external-probe');
  return join(
    process.env.XDG_CONFIG_HOME || join(homedir(), '.config'),
    'signal-external-probe'
  );
}

function defaultUserData() {
  if (process.platform === 'win32') return join(process.env.APPDATA, 'Signal');
  if (process.platform === 'darwin')
    return join(homedir(), 'Library', 'Application Support', 'Signal');
  return join(
    process.env.XDG_CONFIG_HOME || join(homedir(), '.config'),
    'Signal'
  );
}

function endpointFor(userData) {
  const id = createHash('sha256')
    .update(realpathSync(userData))
    .update('\0')
    .update(userInfo().username)
    .digest('hex')
    .slice(0, 16);
  if (process.platform === 'win32')
    return `\\\\.\\pipe\\signal-desktop-external-client-${id}`;
  const dir =
    process.platform === 'linux' && process.env.XDG_RUNTIME_DIR
      ? join(process.env.XDG_RUNTIME_DIR, 'signal-desktop')
      : join(realpathSync(userData), 'external-client');
  return join(dir, `${id}.sock`);
}

function saveKey(file, { privateKeyPem, publicKey, serverPublicKey }) {
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  writeFileSync(
    file,
    JSON.stringify({ privateKeyPem, publicKey, serverPublicKey }, null, 2),
    {
      mode: 0o600,
    }
  );
}

function loadKey(file) {
  if (existsSync(file)) {
    const saved = JSON.parse(readFileSync(file, 'utf8'));
    return { ...saved, privateKey: createPrivateKey(saved.privateKeyPem) };
  }
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const saved = {
    privateKeyPem: privateKey.export({ format: 'pem', type: 'pkcs8' }),
    publicKey: publicKey.export({ format: 'jwk' }).x,
    serverPublicKey: null,
  };
  saveKey(file, saved);
  return { ...saved, privateKey };
}

function transcript(parts) {
  const chunks = [];
  parts.forEach((part, i) => {
    if (i > 0) chunks.push(Buffer.from([0]));
    chunks.push(typeof part === 'string' ? Buffer.from(part, 'utf8') : part);
  });
  return Buffer.concat(chunks);
}

function frame(obj) {
  const payload = Buffer.from(JSON.stringify(obj), 'utf8');
  const header = Buffer.alloc(5);
  header.writeUInt8(1, 0);
  header.writeUInt32BE(payload.length, 1);
  return Buffer.concat([header, payload]);
}

function openConnection(endpoint) {
  const socket = connect(endpoint);
  const waiting = new Map();
  let buffered = Buffer.alloc(0);
  let nextId = 0;
  socket.on('data', chunk => {
    buffered = Buffer.concat([buffered, chunk]);
    while (buffered.length >= 5) {
      const len = buffered.readUInt32BE(1);
      if (buffered.length < 5 + len) break;
      const msg = JSON.parse(buffered.subarray(5, 5 + len).toString('utf8'));
      buffered = buffered.subarray(5 + len);
      if (msg.event) {
        onEvent(msg);
        continue;
      }
      const resolve = waiting.get(msg.id);
      waiting.delete(msg.id);
      resolve?.(msg);
    }
  });
  socket.on('close', () => {
    for (const resolve of waiting.values()) {
      resolve({ error: { code: 'CLOSED', message: 'connection closed' } });
    }
    waiting.clear();
  });
  const ready = new Promise((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('error', reject);
  });
  return {
    ready,
    socket,
    call(method, params) {
      const id = `p${nextId++}`;
      socket.write(
        frame(params === undefined ? { id, method } : { id, method, params })
      );
      return new Promise(resolve => waiting.set(id, resolve));
    },
  };
}

let lastSeq = 0;
function onEvent({ event, seq, data }) {
  const gap = seq !== lastSeq + 1 ? `  (GAP: expected ${lastSeq + 1})` : '';
  lastSeq = seq;
  const when = new Date().toLocaleTimeString();
  let what;
  if (event.startsWith('message.') && data.body !== undefined) {
    const status = data.sendStatus ? ` (${data.sendStatus})` : '';
    what = `${data.direction === 'outgoing' ? '>' : '<'} ${data.body ?? `[${data.kind}]`}${status}`;
  } else if (event === 'conversation.updated') {
    what = `${data.title} unread ${data.unreadCount}`;
  } else {
    what = JSON.stringify(data);
  }
  console.log(`${when} #${seq} ${event}: ${what}${gap}`);
}

function must(response, what) {
  if (response.error) {
    console.error(
      `${what} failed: ${response.error.code} ${response.error.message}`
    );
    process.exit(1);
  }
  return response.result;
}

const args = parseArgs(process.argv.slice(2));
const keyFile = args.keyFile || join(configDir(), 'key.json');
const key = loadKey(keyFile);
const endpoint =
  args.endpoint || endpointFor(args.userData || defaultUserData());
console.log('endpoint:', endpoint);
console.log('client key:', key.publicKey, `(${keyFile})`);

const conn = openConnection(endpoint);
try {
  await conn.ready;
} catch (err) {
  console.error('connect failed:', err.code || err.message);
  process.exit(1);
}

const clientNonce = randomBytes(32);
const hello = must(
  await conn.call('session.hello', {
    protocol: 'signal-external-client',
    versions: [1],
    client: { name: 'probe', version: '0.5' },
    clientNonce: clientNonce.toString('base64url'),
  }),
  'hello'
);
console.log(
  `hello: protocol v${hello.protocolVersion}, Signal ${hello.signalVersion}, ` +
    `capabilities ${JSON.stringify(hello.capabilities)}`
);

const challenge = Buffer.from(hello.challenge, 'base64url');
const serverKey = createPublicKey({
  key: { kty: 'OKP', crv: 'Ed25519', x: hello.server.publicKey },
  format: 'jwk',
});
const serverOk = verify(
  null,
  transcript([SERVER_LABEL, hello.sessionId, challenge, clientNonce]),
  serverKey,
  Buffer.from(hello.server.signature, 'base64url')
);
if (!serverOk) {
  console.error('server signature INVALID; not continuing');
  process.exit(1);
}
if (key.serverPublicKey && key.serverPublicKey !== hello.server.publicKey) {
  console.error(
    `server key CHANGED (pinned ${key.serverPublicKey}); not continuing`
  );
  process.exit(1);
}
console.log(
  `server signature ok${key.serverPublicKey ? ', matches pinned key' : ' (not pinned yet)'}`
);

const signature = sign(
  null,
  transcript([CLIENT_LABEL, hello.sessionId, challenge]),
  key.privateKey
).toString('base64url');

if (args.request) {
  console.log('asking Signal for approval; answer the dialog in Signal...');
  const granted = must(
    await conn.call('authorization.request', {
      publicKey: key.publicKey,
      signature,
      displayName: 'Signal probe client',
      capabilities: args.capabilities,
    }),
    'authorization.request'
  );
  key.serverPublicKey = hello.server.publicKey;
  saveKey(keyFile, key);
  console.log(
    'approved:',
    JSON.stringify(granted.capabilities),
    '- server key pinned'
  );
} else {
  const auth = must(
    await conn.call('session.authenticate', {
      publicKey: key.publicKey,
      signature,
    }),
    'authenticate (run with --request first?)'
  );
  if (!key.serverPublicKey) {
    key.serverPublicKey = hello.server.publicKey;
    saveKey(keyFile, key);
  }
  console.log('authenticated:', JSON.stringify(auth.capabilities));
}

const status = must(await conn.call('session.getStatus'), 'getStatus');
console.log('status:', JSON.stringify(status));

const list = await conn.call('conversations.list', { limit: args.limit });
if (list.error) {
  console.log(`conversations.list: ${list.error.code} ${list.error.message}`);
} else {
  console.log(
    `conversations (${list.result.conversations.length}, nextCursor ${list.result.nextCursor}):`
  );
  for (const c of list.result.conversations) {
    console.log(
      `  ${c.type.padEnd(7)} unread ${String(c.unreadCount).padStart(3)}  ${c.title}`
    );
  }
}

const first = list.result?.conversations[0];
if (args.messages > 0 && first) {
  const page = await conn.call('messages.list', {
    conversationId: first.id,
    limit: args.messages,
  });
  if (page.error) {
    console.log(`messages.list: ${page.error.code} ${page.error.message}`);
  } else {
    console.log(
      `last ${page.result.messages.length} messages in "${first.title}":`
    );
    for (const m of page.result.messages) {
      const when = new Date(m.sentAt).toISOString();
      const text = m.body ?? `[${m.kind}]`;
      const files = m.attachments.length
        ? ` (+${m.attachments.length} attachment)`
        : '';
      console.log(
        `  ${when} ${m.direction === 'outgoing' ? '>' : '<'} ${text}${files}`
      );
    }
  }
}

// Finds the --send/--mark-read target by paging through the whole list.
async function findTarget() {
  let cursor;
  do {
    const page = must(
      await conn.call('conversations.list', { limit: 100, cursor }),
      'conversations.list'
    );
    const match = page.conversations.find(c =>
      args.to === undefined ? c.noteToSelf : c.title === args.to
    );
    if (match) {
      return match;
    }
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  console.error(`no conversation titled ${args.to ?? '(Note to Self)'}`);
  process.exit(1);
}

if (args.send !== undefined || args.markRead) {
  const target = await findTarget();
  if (args.send !== undefined) {
    const sent = await conn.call('messages.sendText', {
      conversationId: target.id,
      body: args.send,
    });
    if (sent.error) {
      const reason = sent.error.reason ? ` (${sent.error.reason})` : '';
      console.log(`messages.sendText: ${sent.error.code}${reason}`);
    } else {
      const m = sent.result.message;
      console.log(`sent to "${target.title}": ${m.id} status ${m.sendStatus}`);
    }
  }
  if (args.markRead) {
    const page = must(
      await conn.call('messages.list', { conversationId: target.id, limit: 1 }),
      'messages.list'
    );
    const newest = page.messages.at(-1);
    if (!newest) {
      console.log(`"${target.title}" has no messages to mark read`);
    } else {
      const marked = await conn.call('messages.markRead', {
        conversationId: target.id,
        upToMessageId: newest.id,
      });
      console.log(
        marked.error
          ? `messages.markRead: ${marked.error.code}`
          : `marked "${target.title}" read up to ${newest.id}`
      );
    }
  }
}

if (args.watch) {
  const sub = must(
    await conn.call('events.subscribe', {
      topics: ['conversations', 'messages'],
    }),
    'events.subscribe'
  );
  if (args.notifications) {
    const handled = must(
      await conn.call('notifications.setHandled', { handled: true }),
      'notifications.setHandled'
    );
    console.log(`notifications handled by this client: ${handled.handled}`);
  }
  console.log(`watching ${JSON.stringify(sub.topics)}; Ctrl+C to stop`);
  conn.socket.on('close', () => {
    console.log('connection closed');
    process.exit(0);
  });
  process.on('SIGINT', async () => {
    await conn.call('session.disconnect');
    conn.socket.end();
    process.exit(0);
  });
} else {
  await conn.call('session.disconnect');
  conn.socket.end();
}
