<!-- Copyright 2026 Signal Messenger, LLC -->
<!-- SPDX-License-Identifier: AGPL-3.0-only -->

# External Client Bridge: Threat Model

Baseline: `5c1a030485ea64a1c311288cd6b5eecbe36964cd`. Read with
`docs/external-client-architecture.md`.

## 1. What we protect

| Asset                                             | Why it matters                                                     |
| ------------------------------------------------- | ------------------------------------------------------------------ |
| Message content and history                       | Primary confidentiality asset.                                     |
| Ability to send as the user                       | Impersonation, social engineering of contacts.                     |
| Contact graph, profiles, group membership         | Metadata Signal works hard to minimize.                            |
| Attachments and avatars                           | Content; also `path` + `localKey` are read capabilities.           |
| Identity, session and ratchet keys; SQLCipher key | Must never be reachable through the bridge at all.                 |
| Read/typing state                                 | Leaks presence and behavior; sending receipts is a privacy action. |
| Grant store                                       | Integrity: an attacker who can write a grant gains access.         |

## 2. Trust boundaries

```text
 [other OS users] ─┐
 [network]  ───────┼──X── (no listener reachable)
 [browser pages] ──┘
                         ┌────────────────── same OS user ──────────────────┐
 [sandboxed/low-integrity│ processes]  ──?──▶ endpoint ──▶ main process ──▶ renderer
 [ordinary same-user    │ processes]  ─────▶ endpoint         │
                         │                                     └─ approval UI (Signal-owned)
                         └───────────────────────────────────────────────────┘
```

Boundaries the bridge introduces:

- **B1 endpoint**: untrusted bytes enter main.
- **B2 session**: unauthenticated → authenticated → capability-scoped.
- **B3 main → renderer**: validated typed calls only.
- **B4 approval UI**: the only place a grant can be created.

## 3. Adversaries

| ID  | Adversary                                                                                           | In scope?                                                      |
| --- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| A1  | Remote network attacker                                                                             | Yes. Must have zero reachable surface.                         |
| A2  | Web page in any browser                                                                             | Yes. Must have zero reachable surface (no TCP/HTTP/WebSocket). |
| A3  | Other local OS user                                                                                 | Yes. Must not connect, or must fail authentication.            |
| A4  | Sandboxed same-user process (Flatpak/Snap app, AppContainer, browser renderer, low integrity level) | Yes. Should be blocked by OS confinement plus authentication.  |
| A5  | Unsandboxed same-user malware                                                                       | Partially. See §4.                                             |
| A6  | An approved but buggy or malicious external client                                                  | Yes. Bounded by capabilities and resource limits.              |
| A7  | A process that impersonates Signal (endpoint squatting)                                             | Yes, toward clients.                                           |
| A8  | Local admin/root, physical access with unlocked session                                             | No. Out of scope, as for Signal Desktop itself.                |

## 4. The honest position on same-user malware (A5)

On Windows the SQLCipher key is protected by `safeStorage`, which is DPAPI and
user-scoped. On Linux it depends on the keyring backend (`basic_text` gives no
protection). Any unsandboxed process running as the user can usually read
`config.json`, decrypt the key and open the database, or inject into the
Signal process. **The bridge cannot defend against an adversary who already
has those powers, and must not claim to.**

What the bridge must guarantee is that it does not **lower the bar**:

1. Connecting to the endpoint must not be easier than reading Signal's files.
   Mandatory authentication with a grant that only Signal's own UI can create
   achieves that.
2. A grant must not be forgeable by writing a plaintext file. Grants therefore
   live in SQLCipher, not in `ephemeral.json` or `config.json`.
3. The approval prompt must not be clickable by the requester. It is a
   Signal-owned modal window; the requester only supplies data shown in it.
   (A5 with input-injection ability can click it, but A5 can also click the
   Signal window directly.)
4. The bridge must be off unless the user turns it on, so users who never use
   it get no new surface at all.

The bridge does add value against A3 and A4, and gives the user explicit,
auditable, revocable consent for A6.

## 5. Threats and mitigations

STRIDE category in brackets.

### Endpoint and transport

**T1 [I/E] Network or browser reaches the bridge.**
Mitigation: only a Unix domain socket or Windows named pipe; no TCP, HTTP or
WebSocket listener exists in any configuration. Remote named-pipe access on
Windows is refused by checking that the pipe is local-only (see T3).
Test: assert no `AF_INET`/`AF_INET6` listener after enabling.

**T2 [I/E] Another OS user connects (Linux/macOS).**
Mitigation: socket inside a `0700` directory owned by the user
(`$XDG_RUNTIME_DIR` or `<userData>/external-client`), socket mode `0600`.
Before binding, `lstat` the directory: must be a directory, owned by
`process.getuid()`, mode `& 0o077 === 0`, not a symlink; otherwise refuse.
Stale socket is removed only if `lstat` shows a socket owned by the user.
Test: wrong-mode directory, symlinked directory, foreign-owned socket.

**T3 [I/E] Another OS user connects (Windows).**
Named pipes live in a machine-global namespace. The default DACL for a pipe
created with a NULL security descriptor grants full control to SYSTEM,
Administrators and the creator owner, and **read to Everyone**. With only read
access a foreign client could open the pipe but cannot write `hello`.
Mitigations:

- The server never writes before receiving a valid `hello`, and never sends
  anything but handshake results before authentication.
- Authentication is mandatory.
- Each client open gets its own pipe instance, so a read-only client can
  only read its own connection, on which the server says nothing until it
  receives a `hello` that the client cannot write.

Verified on Windows 11 (10.0.26200, Node 24.19, 2026-10-08, ACLs read with
`accesschk64 -l` against a non-elevated listener):

- Default `listen` and `readableAll: false, writableAll: false` give the same
  DACL: SYSTEM, Administrators and the user get full access; **Everyone and
  ANONYMOUS LOGON get read** (`FILE_READ_DATA`, attributes, EA,
  `READ_CONTROL`, `SYNCHRONIZE`). Medium integrity, no-write-up.
- `readableAll: true, writableAll: true` adds Everyone read/write including
  `FILE_APPEND_DATA` (= `FILE_CREATE_PIPE_INSTANCE`), which would let any
  local user add server instances. The bridge must never set these options.
- A same-user read/write client connects normally.

Residual risk with Node's DACL: no data exposure (above), but another local
user, or a remote user if remote clients are not rejected, can open
read-only connections and hold the connection slots (T5) until the
handshake timeout, repeatedly.

Verified on the live bridge pipe (2026-10-08): libuv does **not** set
`PIPE_REJECT_REMOTE_CLIENTS`. Connections through `\\localhost\pipe\…`,
`\\127.0.0.1\pipe\…` and `\\<hostname>\pipe\…` (the SMB redirector)
succeed. Any account that can reach the machine over SMB can therefore open
read-only connections (slot exhaustion), and someone holding the user's own
credentials remotely gets a full connection and can trigger the approval
prompt (still needs a click at the desktop) or authenticate with a stolen
client key.

Mitigation (implemented 2026-10-08): on Windows the bridge no longer uses
`net.Server`. `packages/windows-local-pipe` (a small N-API module, the same
pattern as `packages/windows-ucv`) creates every pipe instance with a
protected DACL granting `GENERIC_ALL` to the current user's SID only,
`PIPE_REJECT_REMOTE_CLIENTS`, and `FILE_FLAG_FIRST_PIPE_INSTANCE`. No
Everyone or ANONYMOUS LOGON entries, no SMB clients. The implicit
medium-integrity no-write-up label still keeps low-integrity and
AppContainer processes of the same user out.
Test: `ts/test-node/externalClient/windowsPipe_test.node.ts` (handshake over
the native pipe, squatting refused, `\\localhost\pipe\…` refused) in CI on
`windows-latest`; DACL checked by hand with `accesschk64 -l`.
Verified inside Electron on Windows 11 (2026-10-08, 16:32 PT): the live
bridge pipe's descriptor is
`O:<user> G:<user> D:P(A;;FA;;;<user>)`, with no Everyone, ANONYMOUS LOGON,
Administrators or SYSTEM entries and no explicit label (implicit Medium
no-write-up). `\\localhost\…`, `\\127.0.0.1\…` and `\\<hostname>\…`
are refused with `EPERM`; local clients connect; a stored grant and the
server key survive an app restart. Not yet tested: a low-integrity client
(expected to be refused by no-write-up).

**T4 [S] Endpoint squatting (A7).**
A process creates the endpoint before Signal starts and impersonates Signal
to clients: it can capture outgoing messages or feed fake ones.
Mitigations:

- Windows: verified 2026-10-08 that when another process already owns the
  pipe name, Node's `listen` fails with `EADDRINUSE` rather than sharing it
  (libuv's first instance uses `FILE_FLAG_FIRST_PIPE_INSTANCE`). Signal then
  has no listener; it must log this and never retry under the same name
  silently.
- POSIX: the `0700` directory check means a squatter must already be the same
  user.
- Server authentication: Signal signs the handshake with a server Ed25519 key
  whose public key the client pinned at approval. A squatter cannot produce it.
- Clients must treat discovery files as hints only.

**T5 [D] Connection flooding.**
Mitigation: max concurrent connections (8 in v1), handshake timeout (10 s),
idle-unauthenticated timeout, per-connection request concurrency limit.

### Framing and parsing

**T6 [D/T] Oversized or malformed frames.**
Mitigation: length-prefixed frames, hard max (1 MiB in v1) checked from the
header before buffering; unknown frame kinds rejected; JSON parsed only
after the full frame is present; zod `.strict()` schemas with bounded string
lengths and array sizes; on any violation reply `INVALID_REQUEST` and close.
Test: length > max, truncated header, non-UTF-8, deep nesting, unknown keys,
prototype-pollution keys (`__proto__`, `constructor`).

**T7 [T] Prototype pollution / type confusion.**
Mitigation: parse with `JSON.parse` into plain data, validate with zod before
any property access beyond the envelope, never merge client objects into
internal ones, never use client strings as object keys for dispatch (dispatch
via `Map` over a closed method list).

### Authentication and authorization

**T8 [S] Client impersonation.**
Mitigation: Ed25519 challenge-response over a server-chosen 32-byte nonce,
bound to the session id and protocol label, verified with `node:crypto`.
`displayName` is presentation only and is never used for decisions; it is
limited to 64 characters and may not contain control, format (including
bidi overrides), surrogate or unassigned code points, so it cannot spoof the
prompt text.
Test: wrong key, replayed signature from a previous session, signature over a
different session id.

**T9 [E] Self-approval.**
Mitigation: grants are created only by the main-process approval dialog in
response to a user click; the requesting connection has no method that
creates or edits a grant. The prompt is rate-limited (one outstanding prompt
per client key; repeated denials suppress further prompts for that key for a
cool-down).
Test: client calls a non-existent `authorization.approve`; client sends
`authorization.request` repeatedly.

**T10 [E] Capability escalation.**
Mitigation: each method declares the single capability it needs; the check is
in the session layer before the renderer is called. Grants are a set chosen
by the user, which may be smaller than requested. Requesting new capabilities
requires a new prompt.
Test: client with `messages.read` calls `messages.sendText`.

**T11 [R] Revocation does not take effect.**
Mitigation: revocation deletes the grant and closes every live session for
that key synchronously; subsequent `authenticate` fails. Unlink deletes all
grants (`items` key classified as removed on unlink).
Test: revoke during an open subscription; reconnect after revoke.

**T12 [E] Grant-store tampering.**
Mitigation: grants in SQLCipher, written only by main. Enablement also read
from SQLCipher, so flipping a plaintext config cannot enable the feature.

### Data exposure

**T13 [I] Leaking internal state through DTOs.**
Mitigation: explicit DTO mappers with allow-listed fields; no
`model.attributes` or `format()` objects cross the boundary; tests assert DTO
key sets.

**T13b [I] Clients keep messages Signal would have erased.**
Disappearing, deleted-for-everyone and view-once messages are erased by
Signal; a client that cached them would defeat that.
Mitigation: content of deleted, erased and view-once messages never crosses
the bridge; expired messages are not returned; every message carries
`expiresAt`, and the protocol requires clients to discard by then. Residual:
a client can ignore `expiresAt` for content it received while the message
was live; this is the same trust Signal places in a linked device's user.
Test: DTO tests for each case (`messageDto_test.std.ts`).

**T14 [I/E] Arbitrary file read via attachments.**
Mitigation: no path parameter exists. Attachments are addressed by an opaque
id that the server maps to a `message_attachments` primary key it has
validated belongs to a message the session may read. `path`/`localKey` never
leave Signal. Main decrypts and streams with bounded chunks.
Test: path-like ids, ids of attachments in conversations outside scope,
traversal strings.

**T15 [E] Reaching internal IPC or code execution.**
Mitigation: closed method enum; main constructs renderer calls itself; the
renderer accepts calls only on `ipcRenderer` (main-originated) and only for
known methods; no eval, no dynamic import, no Redux dispatch by name.
Test: method names matching real IPC channels (`sql-channel:read`), Redux
action types, `__proto__`.

**T16 [I] Sensitive data in logs.**
Mitigation: log client key fingerprints (first 8 hex of SHA-256), method
names and error classes only; never bodies, DTOs, display names verbatim
(they are attacker-chosen and could be used for log injection), or keys.

### Behavior on behalf of the user

**T17 [T/R] Sending bypasses safety checks.**
Mitigation: the send helper refuses on untrusted/unverified identities,
pending message requests, blocked conversations, announcement-only groups
where we are not admin, terminated groups, and over-length bodies, instead of
silently calling `enqueueMessageForSend` (which would also implicitly accept a
message request via `enableProfileSharing`).
Implemented in `ExternalClientSend.preload.ts` (`getSendBlockReason`), which
mirrors `CompositionArea` gating and Signal's invalid-message toasts, and
runs the same untrusted-identity check as the composer
(`getUntrustedRecipients`). Refusals carry a machine-readable `reason`. The
send leaves the user's draft in Signal untouched.

**T18 [I] Read receipts sent without the user seeing messages.**
Mitigation: `messages.markRead` is a distinct capability, labeled "Mark your
messages as read, which may send read receipts" in the approval dialog; the
user setting `read-receipt-setting` is still enforced by existing code. The
message must belong to the named conversation.

**T19 [I/D] Duplicate, leaking or suppressed notifications.**
Mitigation (D22): Signal keeps notifying unless a client holding the
separately approved `notifications.manage` capability takes over. The
hand-off covers message, reaction and unread-reminder notifications only;
calls still notify. It requires an active `messages` subscription (so the
client also needs `messages.read`) and ends automatically on unsubscribe,
dropped events, disconnect, bridge stop or revoke, so a crashed, lagging or
removed client cannot leave Signal silent.
Residual: an approved client can take over notifications and then show none.

### Resource exhaustion by an approved client (A6)

**T20 [D] Memory exhaustion via slow reader or huge pages.**
Mitigation: bounded per-session event backlog with drop-and-signal
(`events.dropped` once 1 MiB is unread, then no events until the client
resubscribes; disconnect at 2 MiB); bounded renderer queue (5000 objects,
coalesced, overflow drops everyone's events rather than growing); page size
cap (100); concurrent request cap (16); attachment streaming with
backpressure (`socket.write` return value / `drain`); send rate limit (e.g.
1/s burst 5). Implemented for events in Milestone D.

**T20b [I] Events leaking what snapshots would hide.**
Mitigation: events use the same DTO mappers and the same "listed
conversation" rule as the list methods, applied when the event is sent; a
topic needs the same capability as the matching methods, checked on
subscribe and again on every delivery. Renderer event payloads are
re-validated in main (closed event list, batch cap) and accepted only from
the main window.

## 6. Explicitly inaccessible

The bridge must never expose, directly or indirectly:

- SQL, SQLCipher, the DB key, `config.json`, `ephemeral.json`.
- Filesystem paths under `userData`; attachment `path`, `localKey`,
  `plaintextHash`, digests, incremental MACs.
- libsignal objects, identity/pre/signed/Kyber keys, sessions, sender
  certificates, profile keys, group master keys or secret params.
- Protobuf envelopes, websocket or HTTP access, `WebAPI`, `MessageSender`.
- `ipcRenderer`/`ipcMain` channels, `BrowserWindow`/`webContents`.
- Redux state or dispatch, `ConversationModel`/`MessageModel` instances.
- Storage items (`itemStorage`) other than through specific DTO fields.
- Device linking, registration, backups, PIN/SVR, account deletion.
- Calling/RingRTC.

## 7. Residual risks

- A5 remains able to do anything the user can do. The bridge does not change
  that and documentation must say so plainly.
- Windows pipe DACL grants Everyone/ANONYMOUS LOGON read until the native
  DACL step lands (T3): connection-slot exhaustion, no data exposure.
- Users may approve malicious clients. Mitigated by clear capability text and
  a visible, revocable list; not eliminable.
- A legitimate approved client's private key is as safe as that client's
  storage.

## 8. Security test matrix (maps to the spec)

| Spec item                  | Threat    | Test                                                  |
| -------------------------- | --------- | ----------------------------------------------------- |
| unauthorized local process | T8, T10   | connect, `hello`, call data method → `NOT_AUTHORIZED` |
| wrong client key           | T8        | authenticate with unregistered key → `NOT_AUTHORIZED` |
| revoked client             | T11       | revoke then reconnect; revoke mid-session             |
| malformed messages         | T6, T7    | fuzz corpus                                           |
| oversized request          | T6        | length header > max closes before buffering           |
| unknown method             | T15       | `UNSUPPORTED_METHOD`                                  |
| unsupported version        | handshake | `UNSUPPORTED_VERSION` and close                       |
| arbitrary file access      | T14       | traversal ids → `NOT_FOUND`                           |
| arbitrary internal IPC     | T15       | IPC channel names as methods → `UNSUPPORTED_METHOD`   |
| capability escalation      | T10       | read-only client sends → `PERMISSION_DENIED`          |
| pre-hello silence          | T3        | connect and read with timeout → no bytes              |
