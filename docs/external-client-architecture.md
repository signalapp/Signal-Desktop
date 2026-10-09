<!-- Copyright 2026 Signal Messenger, LLC -->
<!-- SPDX-License-Identifier: AGPL-3.0-only -->

# External Client Bridge: Architecture

Status: Phase 0 investigation, plus Milestone A design.
Baseline: `signalapp/Signal-Desktop` `main` at
`5c1a030485ea64a1c311288cd6b5eecbe36964cd` (v8.33.0-alpha.1, committed
2026-10-07). All `file:line` references below are against that commit.

This document describes how Signal Desktop is structured today, where an
optional, local, capability-authorized "external client" interface would
attach, and why. The companion documents are:

- `docs/external-client-threat-model.md`
- `docs/external-client-probe.node.mjs` (a dependency-free reference client)
- `docs/external-client-decisions.md` (decision log)

## 1. Summary

The single most important finding is that **Signal Desktop's application
logic does not live in the Electron main process.** Conversations, messages,
sending, receiving, the websocket, read state, typing, notifications and
calling all run in the main window's renderer, inside the preload's isolated
world. The main process owns the window, OS integration, settings files, the
SQLCipher worker pool, and the `attachment://` protocol handler.

The bridge therefore has to be split across the two processes:

```text
 external process                Electron main process                 main window renderer (preload world)
 ────────────────                ─────────────────────                 ────────────────────────────────────
                                 ExternalClientTransport
  Rambox adapter  ── pipe/UDS ─▶   (net.Server, framing, limits)
                                 ExternalClientSession
                                   (handshake, client auth,
                                    capability checks, rate limits)
                                 ExternalClientAuthorizations
                                   (approval prompt, persisted
                                    grants, revocation)
                                         │
                                         │  one dedicated IPC channel pair,
                                         │  closed method enum, DTOs only
                                         ▼
                                                                       ExternalClientService (adapter)
                                                                         ConversationController / models
                                                                         DataReader paging
                                                                         enqueueMessageForSend
                                                                         markConversationRead
                                                                       ExternalClientEvents
                                                                         ConversationController.conversationUpdated
                                                                         ConversationModel.onNewMessage
                                                                         MessageCache._updateCaches
```

- **Main process** owns everything that faces the untrusted client: the
  listener, wire framing, input validation, client authentication, capability
  enforcement, resource limits and the approval UI. It never forwards a raw
  client request; it forwards a validated, typed call for a method on a fixed
  list, on behalf of an authenticated session that holds the capability.
- **Renderer** hosts a thin adapter that maps each typed call onto existing
  Signal functions and maps internal models onto public DTOs. It contains no
  transport, authorization or protocol code.

Milestone A (connect, receive protocol version, Signal version, capability
vocabulary) needs **no renderer changes at all**; it is answered entirely in
main.

## 2. Current Signal Desktop architecture (as found)

### 2.1 File-suffix convention

Signal enforces process placement by file suffix
(`.oxlint/rules/enforceFileSuffix.mjs:546-562`):

| Suffix        | Runs in                                            |
| ------------- | -------------------------------------------------- |
| `.main.ts`    | Electron main process (uses `ipcMain`, `app`, …)   |
| `.preload.ts` | Renderer preload world (Node + DOM, `ipcRenderer`) |
| `.dom.ts(x)`  | Renderer UI, DOM only                              |
| `.node.ts`    | Node only; usable in main or worker threads        |
| `.std.ts`     | Environment-agnostic                               |

The bridge follows this: transport and protocol code is `.node.ts`/`.std.ts`
(unit-testable under plain Node), wiring is `.main.ts`, the adapter is
`.preload.ts`.

### 2.2 Main process

- Entry: `app/main.main.ts` (3,542 lines). Bundled as `bundles/main.js`
  (`package.json` `main`).
- Single-instance lock at `app/main.main.ts:260`; `second-instance` handler
  routes `sgnl://` argv at `:265`.
- `app.on('ready')` at `:2189`: DNS fallback, `installFileHandler`
  (`protocol_filter.node.ts`), logging, `initializeSQL(userDataPath)` →
  `sqlInitPromise` (`:2233`), `SettingsChannel.install()` (`:2260`), loading
  window if SQL takes > 3 s (`:2375`), then `createWindow()` (`:689`).
- Main window `webPreferences` (`:722-732`): `nodeIntegration: false`,
  `sandbox: false`, `contextIsolation: true` (outside tests), preload
  `bundles/preload/wrapper.js`. Auxiliary windows (about, debug log, PDF,
  screen share, permissions popup) are `sandbox: true`, `contextIsolation:
true`.
- No listening sockets exist today. `node:net` appears only client-side
  (`ts/util/createProxyAgent.node.ts:128`). OS URL schemes: `sgnl`,
  `signalcaptcha` (`:2751-2763`). Internal Electron protocols: `attachment`,
  `asset`, `emoji`, `bundles` (dev).

### 2.3 Main window renderer and preload

- `preload.wrapper.ts` compiles and runs `bundles/preload/main.js` with a V8
  code cache; that bundle starts at `ts/windows/main/start.preload.ts`, which
  imports the phased preload modules (`phase1-ipc`, `phase2-dependencies`,
  `phase3-post-signal`).
- `ts/background.preload.ts` (`startApp`, `:332`) is the application. It is
  exposed to the page world with `contextBridge.exposeInMainWorld('startApp')`
  (`start.preload.ts:190`) and invoked by an inline script in
  `background.html:127`. **React, Redux, the Signal models, `textsecure` and
  RingRTC all run in this preload world.**
- Main→renderer messages are `webContents.send(channel)` handled by
  `ipc.on(...)` in `ts/windows/main/phase1-ipc.preload.ts` (for example
  `open-settings-tab` `:330`, `get-ready-for-shutdown` `:477`). That file is
  the established place for main-initiated renderer work.

### 2.4 IPC abstractions

There is no generic RPC layer. Each feature registers named channels:

- SQL: `sql-channel:read` / `sql-channel:write` (`ts/sql/channels.preload.ts`,
  `app/sql_channel.main.ts:57-75`), dispatched by method name to
  `DataReader` / `DataWriter`.
- Settings: `settings:get:<name>` / `settings:set:<name>`
  (`ts/main/settingsChannel.main.ts:85`).
- Request/response with sequence ids: the captcha challenge handler
  (`ts/main/challengeMain.main.ts`) is a compact precedent for a main↔renderer
  request with a correlation id.

### 2.5 Application/service layer

There is no messaging service layer. Logic lives in:

- `ConversationModel` (`ts/models/conversations.preload.ts:331`), a plain class
  whose `set()` feeds `ConversationController`.
- `MessageModel` (`ts/models/messages.preload.ts:13`), a thin attribute holder
  registered in `MessageCache`.
- Redux thunks in `ts/state/ducks/*.preload.ts`, some of which hold business
  rules (pre-send checks, read gating).
- A handful of headless utilities: `markConversationRead`,
  `maybeForwardMessages`, `sendEditedMessage`, `shouldShowInvalidMessageToast`,
  `isConversationAccepted`, `blockSendUntilConversationsAreVerified`.

### 2.6 State ownership

| State                  | Owner                                                                    | Notes                                                                                                                               |
| ---------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Conversations          | `window.ConversationController` (`ts/ConversationController.preload.ts`) | `getAll()` `:460`, `get(id)` `:440`; `get` throws before `load()` `:1588` completes. `model.format()` `:2168` → `ConversationType`. |
| Messages (in memory)   | `window.MessageCache` (`ts/services/MessageCache.preload.ts`)            | Only messages currently loaded or in flight.                                                                                        |
| Messages (persisted)   | SQLCipher via `DataReader`/`DataWriter`                                  | Paging in §2.9.                                                                                                                     |
| UI selection, composer | Redux (`ts/state`)                                                       | Selected conversation: `getSelectedConversationId` (`ts/state/selectors/nav.std.ts:25`).                                            |
| Account/linking        | `items` table (`uuid_id`, `password`)                                    | Main checks linking with `getIsLinked()` (`app/main.main.ts:1448`).                                                                 |

### 2.7 Database ownership

- SQLCipher runs in four Node worker threads owned by `MainSQL`
  (`ts/sql/main.main.ts:143`, `WORKER_COUNT` `:22`); writes go to the primary
  worker, reads are load-balanced.
- The key comes from Electron `safeStorage` (`getSQLKey()`,
  `app/main.main.ts:1726`).
- **The main process can already read the database directly**:
  `sql.sqlRead('getItemById', …)` is used for `zoomFactor`, linking state
  (`:1450`), auto-update and attachment orphan cleanup.
- Error states: key/safeStorage failure dialogs (`onDatabaseInitializationError`,
  `:1944`), corruption and read-only handlers (`:1691`, `:1705`), `sql-error`
  to the renderer (`:1940`). There is no distinct "database locked" state;
  "key unavailable" and "corrupted" are the closest analogues.

### 2.8 Message send path (plain text)

All in the renderer:

1. UI gating in `ts/components/CompositionArea.dom.tsx:1015-1135` (blocked,
   message request not accepted, unregistered, announcement-only, terminated,
   pending approval). These are **React render conditions**, not callable
   checks.
2. `sendMultiMediaMessage` thunk (`ts/state/ducks/composer.preload.ts:651`) →
   `withPreSendChecks` (`:522`): `blockSendUntilConversationsAreVerified`
   (opens a blocking safety-number modal) and
   `shouldShowInvalidMessageToast` (expired build, blocked, left group, body >
   64 KB). Then it consumes composer state (quote, draft attachments, link
   preview).
3. `ConversationModel.enqueueMessageForSend` (`conversations.preload.ts:4279`):
   timer, recipients, `MessageCache.register`, **`enableProfileSharing`
   (`:4461`, implicitly accepts a message request)**, job enqueue,
   `beforeMessageSend` (adds to Redux, clears draft unless `dontClearDraft`).
4. `conversationJobQueue` (`ts/jobs/conversationJobQueue.preload.ts:851`) →
   `sendNormalMessage` (`ts/jobs/helpers/sendNormalMessage.preload.ts:88`):
   filters blocked/unregistered/non-member recipients, fails on untrusted
   identities, requires an accepted conversation for direct sends.
5. `MessageSender` → `OutgoingMessage` → websocket (`WebAPI.preload.ts`,
   `SocketManager.preload.ts`).

**Finding:** no existing function takes `(conversationId, body)` and runs the
full set of checks without touching composer UI state. `maybeForwardMessages`
(`ts/util/maybeForwardMessages.preload.ts:36`) is the closest headless model.
The bridge needs one small new renderer function (§4.3).

### 2.9 Message receive/update path

- `MessageReceiver` (`ts/textsecure/MessageReceiver.preload.ts:311`) emits
  `MessageEvent`/`SentEvent`/`TypingEvent`; `background.preload.ts:625-747`
  wires them to `onMessageReceived` (`:2624`) / `onSentMessage` (`:3196`) →
  `handleDataMessage` (`ts/messages/handleDataMessage.preload.ts:91`) →
  `saveAndNotify` (`ts/messages/saveAndNotify.preload.ts:23`).
- Semantic choke points usable for events without touching Redux:

| Event                              | Choke point                                                                                                                                                             |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| message added (in/out)             | `ConversationModel.#doAddSingleMessage` (`:1635`), reached from `onNewMessage` (`:1567`) and `beforeMessageSend` (`:4241`)                                              |
| message updated                    | `MessageCache._updateCaches` (`MessageCache.preload.ts:199`), throttled to `messageChanged` (`:296`). Only fires for messages held in memory.                           |
| message removed                    | `cleanupMessages` → `cleanupMessageFromMemory` (`ts/util/cleanup.preload.ts:107,160`); plus two out-of-band `messageDeleted` callers. Delete-for-everyone is an update. |
| conversation added/updated/removed | `ConversationController.#addConversation` (`:352`), `conversationUpdated` (`:267`, batched), `#removeConversation` (`:376`)                                             |
| typing                             | `ConversationModel.notifyTyping` (`:5989`) → `conversationUpdated`                                                                                                      |

`window.Whisper.events` carries no message or conversation events.

### 2.10 Pagination

`DataReader.getOlderMessagesByConversation` /
`getNewerMessagesByConversation` / `getConversationRangeCenteredOnMessage`
take `AdjacentMessagesByConversationOptionsType`
(`ts/sql/Interface.std.ts:97`): `conversationId`, `messageId?`,
`receivedAt?`, `sentAt?`, `limit?` (default 100), `includeStoryReplies`,
`storyId`. The cursor is `(received_at, sent_at, id)`. This maps directly onto
an opaque external page cursor.

### 2.11 Read state and typing

- `ConversationModel.markRead` (`:5186`) → `ts/util/markConversationRead.preload.ts:36`
  marks rows read, queues read syncs and (if accepted and the setting allows)
  read receipts.
- The Redux thunk path `markMessageRead` (`ducks/conversations.preload.ts:1531`)
  **returns early unless the Signal window is active**. An external client is
  by definition presenting the conversation elsewhere, so the bridge must call
  the model-level function and treat "the client says the user saw it" as the
  presence signal. That is a policy decision (§6, Decision D9).
- Typing send: `bumpTyping` (`:1270`) → `sendTypingMessage` (`:1458`). Receive:
  `notifyTyping` (`:5989`), exposed as `typingContactIdTimestamps`.

### 2.12 Attachments and avatars

- Stored encrypted (v2) under `userData/attachments.noindex/<xx>/<64 hex>`
  with a per-file `localKey` (`app/attachments.node.ts:320`).
  `message_attachments` table PK: `(messageId, editHistoryIndex,
attachmentType, orderInMessage)`.
- Renderer displays them through `attachment://v2/<path>?key=<localKey>&size=…`
  (`app/attachment_channel.main.ts:611`), which normalizes and confines the
  path (`isPathInside`) and decrypts on the fly with range support.
- `path` and `localKey` are, in effect, the capability to read the file. **They
  must never reach an external client.**
- Main can decrypt without the renderer (`readAndDecryptDataFromDisk`,
  `decryptAttachmentV2ToSink`) once it has the DB row.
- Avatars: `profileAvatar` / `avatar` on the conversation are
  `{ path, localKey?, … }` relative to `attachments.noindex`.

### 2.13 Notifications

- `ts/services/notifications.preload.ts` (`NotificationService` `:161`) drops
  notifications when `activeWindowService.isActive()` (`:453`), i.e. the Signal
  window is focused and had input in the last 15 s. Earlier gating in
  `ts/messages/maybeNotify.preload.ts`.
- There is **no "conversation visible" concept** in the notification path.
  Only window activity suppresses notifications.
- Consequence: while Rambox shows Signal, Signal Desktop's own window is
  typically hidden, so Signal will raise OS notifications _and_ Rambox may
  raise its own. See §7.4.

### 2.14 Calling

RingRTC is driven from `ts/services/calling.preload.ts` (`CallingClass`
`:577`, singleton `:4567`), entirely in the renderer. Main only handles media
permissions and the screen-share and call-diagnostic windows. Calling is out
of scope; the bridge advertises no calling capability.

### 2.15 Settings

- `ephemeral.json` (`app/ephemeral_config.main.ts`) for settings main needs
  before the DB is open (theme, spellcheck, tray). Plaintext.
- `config.json` (`app/user_config.main.ts`) for the DB key and media
  permissions. Plaintext (key is `safeStorage`-encrypted).
- `items` table (SQLCipher) for everything else, via `itemStorage`
  (`ts/textsecure/Storage.preload.ts`), typed by `StorageAccessType`
  (`ts/types/StorageKeys.std.ts:77`). Every key must be classified as kept or
  removed on unlink (`:378`, `:472`, enforced at `:631`).
- Preferences UI: `ts/components/Preferences.dom.tsx`, bound in
  `ts/state/smart/Preferences.preload.tsx` with `createItemsAccess`. There is no
  "Advanced" page; the Privacy page (`Preferences.dom.tsx:1918`) is the nearest
  fit.
- Reusable first-use prompt template: the permissions popup
  (`showPermissionsPopupWindow`, `app/main.main.ts:1625`), a modal, sandboxed,
  context-isolated child window of the main window.

### 2.16 Validation and serialization dependencies

- `zod` 4.3.6 with Signal wrappers in `ts/util/schemas.std.ts`
  (`parseUnknown`, `safeParseUnknown`, `parseStrict`, `parseLoose`).
- Protobuf is compiled by `@indutny/protopiler` into generated code; there is
  no `protobufjs` runtime.
- `node:crypto` (bundled with Electron's Node) provides Ed25519
  sign/verify and X25519 with no new dependency.

## 3. What can run where

| Capability                                 | Main can do it alone                                                                              | Needs renderer    |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------- | ----------------- |
| Listener, framing, validation              | yes                                                                                               | no                |
| Handshake, protocol/app version            | yes                                                                                               | no                |
| Client auth, capability checks             | yes                                                                                               | no                |
| Approval prompt                            | yes (native dialog)                                                                               | no                |
| Persist/read grants                        | yes (`sql.sqlRead/sqlWrite` on `items`)                                                           | no                |
| Linked / DB-ready status                   | yes (`sqlInitPromise`, `getIsLinked`)                                                             | no                |
| List conversations with live unread/typing | no (models are renderer-only)                                                                     | yes               |
| Page messages                              | technically yes (SQL), but DTO correctness depends on renderer-side hydration and in-memory edits | yes (recommended) |
| Send text                                  | no                                                                                                | yes               |
| Mark read                                  | no (syncs, receipts, model updates)                                                               | yes               |
| Events                                     | no                                                                                                | yes               |
| Stream attachment bytes                    | yes once it has a validated row; row lookup goes through renderer                                 | partial           |

**Renderer-only APIs:** everything on `ConversationModel`, `MessageModel`,
`ConversationController`, `MessageCache`, Redux, `textsecure`, job queues,
calling, notifications.

**Callable outside the renderer:** `MainSQL` reads/writes, attachment
decryption helpers, settings files, `app`/window control.

## 4. Proposed design

### 4.1 Components

| Component                      | Process                  | Responsibility                                                                                                                                |
| ------------------------------ | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `ExternalClientTransport`      | main (`.node.ts`)        | Platform listener (named pipe / Unix socket), connection limits, framing, backpressure. Knows nothing about Signal.                           |
| `ExternalClientSession`        | main (`.node.ts`)        | Per-connection state machine: `hello` → authenticate → authorized. Validates every frame, enforces capability per method, per-session limits. |
| `ExternalClientAuthorizations` | main (`.main.ts`)        | Grants store (SQLCipher `items`), approval prompt, revocation, last-seen.                                                                     |
| `ExternalClientMain`           | main (`.main.ts`)        | Lifecycle: start when enabled and DB ready, stop on disable/quit/unlink; status.                                                              |
| `ExternalClientService`        | renderer (`.preload.ts`) | Typed method table that calls existing Signal code and returns DTOs.                                                                          |
| `ExternalClientEvents`         | renderer (`.preload.ts`) | Subscribes to the choke points in §2.9 and emits semantic DTO events to main, only while at least one subscribed session exists.              |

### 4.2 Main ↔ renderer boundary

- Two channels only: `external-client:call` (main→renderer, `{ seq, method,
params }`) and `external-client:result` / `external-client:event`
  (renderer→main).
- `method` is a member of a closed enum shared in a `.std.ts` file. The
  renderer re-validates `params` with the same zod schema (defense in depth;
  main already did). Unknown methods are dropped and logged.
- Main never forwards client JSON. It constructs the call object from the
  validated request.
- If the renderer is not ready (startup, reload, unlinked), main answers
  `NOT_READY` without calling it.

### 4.3 Mapping external operations to existing Signal code

| External operation         | Capability           | Existing code that performs it                                                                                                                                                                                                                                                                                                                 |
| -------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `session.hello`            | none                 | main: `app.getVersion()`, protocol constants                                                                                                                                                                                                                                                                                                   |
| `session.authenticate`     | none                 | main: `node:crypto` Ed25519 verify against stored grant                                                                                                                                                                                                                                                                                        |
| `session.getStatus`        | any granted          | main: `sqlInitPromise`, `getIsLinked()`, renderer-ready flag                                                                                                                                                                                                                                                                                   |
| `conversations.list`       | `conversations.read` | `ConversationController.getAll()` + `model.format()` → DTO; filtered with the same rules the left pane uses (`ts/state/selectors/conversations` helpers)                                                                                                                                                                                       |
| `conversations.get`        | `conversations.read` | `ConversationController.get(id)`                                                                                                                                                                                                                                                                                                               |
| `messages.list`            | `messages.read`      | `DataReader.getOlderMessagesByConversation` / `getNewerMessagesByConversation`, via `MessageCache` so in-memory state wins                                                                                                                                                                                                                     |
| `messages.get`             | `messages.read`      | `MessageCache` / `DataReader.getMessageById`                                                                                                                                                                                                                                                                                                   |
| `messages.sendText`        | `messages.send`      | new `sendTextFromExternalClient(conversationId, body)` that runs `shouldShowInvalidMessageToast`-equivalent checks, refuses when `!isConversationAccepted`, announcement-only and not admin, terminated, or any untrusted/unverified recipient; then `conversation.enqueueMessageForSend({ body, attachments: [] }, { dontClearDraft: true })` |
| `messages.markRead`        | `messages.markRead`  | `ConversationModel.markRead` → `markConversationRead` util                                                                                                                                                                                                                                                                                     |
| `typing.send` (later)      | `typing.send`        | `conversation.throttledBumpTyping()`                                                                                                                                                                                                                                                                                                           |
| `attachments.open` (later) | `attachments.read`   | renderer resolves opaque id → row; main decrypts with `decryptAttachmentV2ToSink` and streams                                                                                                                                                                                                                                                  |
| `avatars.open` (later)     | `conversations.read` | same as attachments, avatar disposition                                                                                                                                                                                                                                                                                                        |
| events                     | per event class      | §2.9 choke points                                                                                                                                                                                                                                                                                                                              |

The send helper refuses rather than prompts. It must not pop the
safety-number modal in the Signal window on behalf of a remote UI; it returns
`PRECONDITION_FAILED` with a reason code (`untrustedIdentity`,
`messageRequestPending`, `blocked`, `notAMember`, `announcementOnly`,
`terminated`, `bodyTooLong`) so the user resolves it in Signal Desktop.

### 4.4 Transport decision

- **Windows:** named pipe via `net.createServer().listen(pipePath)`. Name
  `\\.\pipe\signal-desktop-external-client-<16 hex of SHA-256(userData realpath
‖ username)>`. Node's libuv is expected to create the first instance with
  `FILE_FLAG_FIRST_PIPE_INSTANCE`, so a pre-squatted name makes `listen` fail
  (fail closed); this is from libuv's documented behavior and has not been
  tested on Windows yet. The default pipe DACL grants read to Everyone; the protocol
  therefore never writes before the client sends `hello`, and authentication
  is mandatory (§5). Tightening the DACL to the current user needs either
  `readableAll/writableAll: false` semantics confirmed on Windows or a small
  native call; **this must be verified on Windows before Milestone B** (see
  threat model T3).
- **Linux:** `$XDG_RUNTIME_DIR/signal-desktop/<hash>.sock` (directory created
  `0700`, checked with `lstat` for owner, mode and not-a-symlink). Fallback
  when `XDG_RUNTIME_DIR` is unset: `<userData>/external-client/` with the same
  checks. Socket `chmod 0600` after bind (the `0700` parent closes the race).
- **macOS:** `<userData>/external-client/<hash>.sock` (well under the 104-byte
  `sun_path` limit for default installs), same checks.
- **Discovery:** Signal writes `external-client.json` next to the socket (or in
  `<userData>` on Windows) with `{ protocol, protocolVersion, endpoint }`.
  Discovery is a convenience, never a trust signal.
- No TCP, no HTTP, no WebSocket, no browser origins.

### 4.5 Wire protocol

- Frames: 1-byte kind + 4-byte big-endian length + payload. Kind `0x01` is a
  UTF-8 JSON message. Kind `0x02` is reserved for binary attachment chunks and
  rejected in v1. Max frame 1 MiB (v1).
- Messages: JSON-RPC-shaped (`{ id, method, params }`, `{ id, result }`,
  `{ id, error: { code, message } }`, `{ event, data }`) but not JSON-RPC 2.0,
  to avoid inheriting batch semantics.
- Every message validated with zod (`.strict()` objects, bounded strings and
  arrays). Unknown fields rejected.
- Versioned from the first frame: `hello` carries `protocol:
"signal-external-client"` and the list of versions the client speaks; the
  server picks one or returns `UNSUPPORTED_VERSION` and closes.

See `docs/external-client-protocol.md` (to be written in Milestone B; the v1
schema lives in `ts/externalClient/protocol.std.ts`).

### 4.6 Authorization design

- Client generates an Ed25519 keypair on install and keeps the private key in
  its own storage.
- `hello` carries a 32-byte random `clientNonce`. The response carries a
  32-byte `challenge` and the server's Ed25519 signature over
  `SERVER_LABEL ‖ 0 ‖ sessionId ‖ 0 ‖ challenge ‖ 0 ‖ clientNonce`, so a
  client that has pinned the server key detects an endpoint squatter.
- First connection: `authorization.request { publicKey, signature,
displayName, capabilities }`, where `signature` covers
  `CLIENT_LABEL ‖ 0 ‖ sessionId ‖ 0 ‖ challenge`. Signal shows a native modal
  dialog on the main window naming the client, a short fingerprint of its key
  and the requested capabilities, with Deny as the default. Approve persists a
  grant; deny persists nothing. (A richer window that lets the user untick
  individual capabilities can replace the dialog later; the authority already
  accepts a narrowed set.)
- Subsequent connections: `session.authenticate { publicKey, signature }`
  over the same client transcript, verified against stored grants with
  `node:crypto`. No shared secret is stored by Signal.
- Grants are stored in SQLCipher (`items`, key `externalClientGrants`),
  written only by main. They are removed on unlink.
- Every capability is checked in main per method, per call.

### 4.7 Capability model (v1 vocabulary)

```text
conversations.read  messages.read  messages.send  messages.markRead
notifications.manage
attachments.read    typing.read    typing.send    contacts.read
profile.read        calls.control (reserved, never granted in v1)
```

The `hello` response lists capabilities the server **implements**; grants list
what a client **holds**. `calling.available` is reported as `false`.

### 4.8 State synchronization

Signal has no change-sequence abstraction (Redux and models are snapshot
state; `MessageCache` updates are throttled and memory-only). V1 therefore
uses **snapshot + event stream + resnapshot on reconnect**:

1. Client calls `events.subscribe` first; from the response on, events for
   its topics arrive interleaved with responses.
2. Client takes snapshots (`conversations.list`, `messages.list`).
3. Client applies events as idempotent upserts and removals; events that
   overlap the snapshot are harmless. Each carries a per-session
   monotonically increasing `seq`.
4. On any gap (disconnect, `events.dropped`), the client resubscribes,
   discards caches and resnapshots.

Implementation (Milestone D): the renderer coalesces changes per object and
sends batches over `external-client:events`; main only forwards them to
sessions subscribed to the topic. Main tells the renderer the union of
subscribed topics over `external-client:topics`, so with no subscriber the
renderer does nothing. See plan §5d.

Message updates for messages not resident in `MessageCache` are not observed
(§2.9); clients must treat message DTOs as refreshable and re-fetch visible
pages after reconnect. This limitation is documented, not papered over.

### 4.9 Failure behavior

| Condition                          | Behavior                                                                                                  |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Feature disabled                   | No listener, no discovery file, socket removed.                                                           |
| Endpoint already exists / squatted | Log, do not listen, do not retry in a loop.                                                               |
| DB not ready / key error           | Listener not started until `sqlInitPromise` resolves OK.                                                  |
| Not linked                         | `hello` succeeds; data methods return `NOT_READY` (`unlinked`).                                           |
| Renderer reloading                 | Calls return `NOT_READY`; sessions stay open; subscribers get `events.dropped` when the renderer is back. |
| Unlink                             | All grants deleted, all sessions closed.                                                                  |
| Revocation                         | Grant deleted, matching sessions closed immediately.                                                      |
| Quit                               | Listener closed in `before-quit`; socket file removed.                                                    |
| Malformed frame / oversize         | `INVALID_REQUEST` and close.                                                                              |
| Client too slow (event backlog)    | Over 1 MiB unread: send `events.dropped`, unsubscribe; client must resnapshot. 2 MiB: disconnect.         |

### 4.10 Sequence diagrams

First-time authorization:

```text
Client                      Main (session)                 Main (prompt)          Renderer
  │ connect ─────────────────▶│
  │ hello{versions}──────────▶│
  │◀── helloResult{v1, signalVersion, capabilities, sessionId, serverKey?}
  │ authorization.request{pubKey, name, caps}▶│
  │                           │── show approval ──────────▶│
  │                           │◀──────── approved(caps') ──│
  │                           │ persist grant (sql items)
  │◀── authorizationResult{granted caps', serverKey}
  │ (session now authorized)
```

Send text:

```text
Client                  Main (session)                      Renderer (service)
  │ messages.sendText ─▶│ validate, check messages.send
  │                     │── external-client:call{seq,…} ──▶│ preconditions
  │                     │                                   │ enqueueMessageForSend
  │                     │◀── external-client:result{seq,…} ─│
  │◀── {messageId} ─────│
  │                     │◀── external-client:event messageAdded ─ (via #doAddSingleMessage)
  │◀── event{seq, messageAdded}
```

## 5. Security considerations (summary)

See the threat model for detail. Highlights:

- Off by default; enabling requires the user, in Signal's own settings UI.
- Locality is necessary, not sufficient: every data method needs an
  authenticated session holding the specific capability.
- Signal never sends data before the client speaks, and never sends anything
  but the handshake before authentication.
- No paths, keys, `localKey`s, service objects, Redux actions or raw IPC cross
  the boundary.
- No Electron security setting, CSP or sandbox setting changes.

## 6. Alternatives considered

| Alternative                                                           | Why not                                                                                                                                                                 |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Listener inside the renderer (preload has Node)                       | Dies on every renderer reload, puts an untrusted-input parser in the process that holds keys in memory and runs React, and makes the approval UI ownable by the page.   |
| Bridge answers reads directly from SQL in main                        | Duplicates DTO hydration and filtering logic, misses in-memory edits, and drifts with schema migrations. Rejected by the spec's "no business logic in the bridge" rule. |
| Localhost TCP/HTTP/WebSocket                                          | Reachable by browsers and any local user; needs origin and token handling; spec forbids.                                                                                |
| Bearer token instead of Ed25519                                       | Simpler, but Signal would have to store a secret that grants access; a DB leak would leak access. Ed25519 is in `node:crypto`, so the cost is low.                      |
| Peer-credential checks (`SO_PEERCRED`, `GetNamedPipeClientProcessId`) | Not exposed by Node; would need a native module. Also weak on Windows (same user can impersonate). Kept as a possible later hardening.                                  |
| Embedding/reparenting Signal's `BrowserWindow`                        | Spec non-goal; couples to Electron internals and helps no non-Electron client.                                                                                          |
| Protobuf wire format                                                  | Signal's protopiler output is generated and Signal-internal; JSON + zod is more debuggable for third parties and needs no new dependency. Schema is still explicit.     |

## 7. Open issues

1. **Windows pipe DACL** (T3 in the threat model): confirm default DACL and
   whether Node's `readableAll`/`writableAll` false gives a user-only DACL.
2. **Send preconditions**: the refusal list in §4.3 must stay in sync with
   `CompositionArea` render gating; propose extracting a shared
   `getComposerBlockReason(conversation)` so UI and bridge use one function.
3. **Message-update coverage**: updates to non-resident messages are invisible.
   Acceptable for v1; a future `MessageCache` hook could close it.
4. **Notifications**: resolved for v1 by the hand-off in decision D22
   (`notifications.setHandled`). A per-conversation
   `presence.set({ active, visibleConversationId })` remains a possible
   later refinement.
5. **Read semantics**: marking read on behalf of an external UI bypasses the
   "window active" gate by design; that must be explicit in review.
6. **UI reuse**: Signal's React components depend on Redux selectors and
   preload globals; reuse by external Electron frontends is not realistic
   short-term. A protocol-backed renderer adapter is the only plausible
   long-term route and is out of scope.
