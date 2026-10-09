<!-- Copyright 2026 Signal Messenger, LLC -->
<!-- SPDX-License-Identifier: AGPL-3.0-only -->

# External Client Bridge: Decision Log

Baseline: `5c1a030485ea64a1c311288cd6b5eecbe36964cd`.

## D1. Split the bridge between main and renderer

DECISION: Transport, session, authentication, authorization and limits run in
the Electron main process. A thin service adapter runs in the main window
renderer and calls existing Signal code.

WHY:

- All messaging logic (models, `ConversationController`, `MessageCache`,
  `textsecure`, job queues) runs in the renderer preload world.
- Main survives renderer reloads and owns windows, so it can own the approval
  UI and keep untrusted parsing out of the process that runs React.

ALTERNATIVES: listener in the renderer; answer reads from SQL in main.

TRADEOFF: one extra IPC hop per call; the renderer must be up for data
methods.

## D2. Local IPC only: named pipe on Windows, Unix socket elsewhere

DECISION: `net.createServer().listen(path)` on a per-user named pipe or a Unix
domain socket in a `0700` directory.

WHY: no network listener; OS user boundary; native to Node, so no dependency;
easy for Electron, Node, Python, Go and C clients.

ALTERNATIVES: localhost TCP, localhost HTTP, WebSocket.

TRADEOFF: browsers need a separately installed companion bridge. Windows pipe
DACL must be verified (threat model T3).

## D3. Length-prefixed JSON frames, zod-validated

DECISION: frame = 1-byte kind + uint32 BE length + payload; kind `0x01` JSON,
`0x02` reserved for binary. Schemas in zod with `.strict()`.

WHY: bounded parsing from the header; debuggable; zod is already a
dependency with Signal wrappers (`ts/util/schemas.std.ts`); room for binary
attachment chunks without base64.

ALTERNATIVES: newline-delimited JSON (unbounded line reads), protobuf via
protopiler (generated, Signal-internal, harder for third parties),
MessagePack (new dependency).

TRADEOFF: JSON overhead; acceptable at local IPC rates.

## D4. Version negotiation in the first message

DECISION: client `hello` lists supported versions; server picks the highest
common one or fails with `UNSUPPORTED_VERSION` and closes. Features are
advertised as capabilities and flags, never inferred from Signal's version.

## D5. Ed25519 client keys with challenge-response

DECISION: clients authenticate by signing a server nonce bound to the session
id; Signal stores only public keys. Signal also signs the handshake with a
server key that clients pin.

WHY: no access-granting secret stored by Signal; mutual authentication
defeats endpoint squatting; `node:crypto` provides Ed25519, so no new
dependency and no home-grown crypto.

ALTERNATIVES: bearer token issued at approval; OS peer credentials
(`SO_PEERCRED`, pipe client PID) which Node does not expose.

TRADEOFF: clients must manage a keypair (a few lines in any language).

## D6. Grants and enablement in SQLCipher, written only by main

DECISION: `items.externalClientGrants` and `items.externalClientsEnabled`,
removed on unlink.

WHY: plaintext config files are writable by any same-user process; a grant
there would be forgeable.

ALTERNATIVES: `ephemeral.json`, a separate JSON file.

TRADEOFF: listener cannot start until the DB is open; acceptable because no
method can be served before then anyway.

## D7. Off by default, no listener when off

DECISION: no endpoint, discovery file or socket exists unless enabled.
Unpackaged dev builds may set `SIGNAL_ENABLE_EXTERNAL_CLIENTS=1`.

## D8. Snapshot + event stream + resnapshot

DECISION: no cursor/sequence machinery over Signal state in v1. Per-session
event `seq` only detects gaps; on gap the client resnapshots.

WHY: Signal has no change log; inventing one is out of proportion.

## D9. Mark-read from an external client bypasses the window-active gate

DECISION: `messages.markRead` calls `ConversationModel.markRead` directly, not
the Redux `markConversationRead` thunk that returns unless Signal's window is
active. Requires the separate `messages.markRead` capability.

WHY: the external client is the surface the user is looking at.

TRADEOFF: Signal trusts the client's claim that the user saw the messages.
Must be visible in review.

## D10. No notification changes in v1 (superseded by D22)

Superseded on 2026-10-09 by D22. Original text, kept for the record:
v1 leaves Signal's notification logic alone and documents that clients should
not raise their own Signal notifications by default, because Signal has no
per-conversation visibility signal and a `presence.set` design needs upstream
agreement.

## D11. Send refuses instead of prompting

DECISION: external send returns `PRECONDITION_FAILED` with a reason
(untrusted identity, pending message request, blocked, not a member,
announcement-only, terminated, too long) instead of opening Signal's
safety-number modal or implicitly accepting a message request.

WHY: a remote UI must not cause trust decisions to be made silently or in a
window the user is not looking at.

## D12. Milestone A is main-only and needs no UI

DECISION: Milestone A ships `hello`/`disconnect` only, enabled by the DB item
or the dev env var. No renderer changes.

WHY: proves transport, framing, versioning and lifecycle in isolation, and is
the cheapest piece to review.

## D13. Native dialog for the Milestone B approval prompt

DECISION: approval uses `dialog.showMessageBox` modal to the main window, Deny
as default and cancel, all-or-nothing on the requested capabilities.

WHY: no new window, preload or React surface to review; the dialog cannot be
scripted by the requesting client. A per-capability window can replace it
without protocol changes.

## D14. Mutual handshake signatures, client nonce required

DECISION: `hello` requires `clientNonce`; the server signs it with its
persistent Ed25519 key. Client and server transcripts use distinct labels.

WHY: lets a client that pinned the server key reject a squatter on first
response, before sending anything sensitive.

## D15. Offset cursor for conversation lists

DECISION: `conversations.list` uses an opaque decimal offset cursor over the
left-pane ordering, max 500 per page.

WHY: the list is small and already sorted in memory; a stable keyset cursor
adds complexity without benefit until change events exist (D8).

## D16. Message cursor is a message id

DECISION: `messages.list` pages backwards with the id of the oldest row read
as the cursor; Signal looks up its `(received_at, sent_at)` like the
timeline does.

WHY: reuses Signal's own paging query unchanged; the id reveals nothing a
`MessageDTO` does not already carry.

## D17. Redact rather than omit hidden messages

DECISION: deleted, erased and view-once messages are returned with their
kind and timestamps but no content; expired disappearing messages and
non-chat rows are omitted.

WHY: clients can show "This message was deleted" or "View-once media" the
way Signal does without ever holding the content; expired messages are about
to be removed by Signal anyway.

## D18. Events: coalesced in the renderer, conversations by Redux diff

DECISION: message events come from three one-line hooks in Signal's message
code; conversation events come from diffing Redux's `conversationLookup`.
The renderer keeps one pending event per object and builds DTOs only when
it sends.

WHY: the message hooks are the existing choke points (architecture §2.9).
Conversations change through many paths, all of which end in Redux, so a
diff catches every one without touching them. Coalescing keeps a burst
(receipts, reactions, downloads) to one event per object.

## D19. Drop and resynchronize instead of buffering

DECISION: when a client falls behind, the renderer queue overflows, or the
renderer reloads, subscribers get `events.dropped`, lose their topics, and
must resubscribe and resnapshot. No replay buffer.

WHY: follows D8. Signal has no change log to replay from; a bounded drop
with an explicit signal is simpler to reason about than an unbounded or
lossy buffer, and the client already knows how to snapshot.

## D20. A Signal remote-config flag gates the bridge

DECISION: the bridge runs only when both Signal's remote-config flag
(`desktop.externalClients.beta` / `.prod`) and the user's opt-in are on.

WHY: Signal can roll it out gradually and switch it off centrally without a
release, the way other Desktop features ship. It is an extra gate, never a
substitute for the user's consent.

## D21. Sending ships in the first upstream PR

DECISION: the first PR includes `messages.sendText`, `messages.markRead` and
the notification hand-off. There is no read-only first PR.

WHY: the point of the bridge is that the user can keep Signal minimized in
the tray and work entirely in the client. A read-only bridge still needs
Signal's window open to reply, so it does not deliver that. Decided by the
project owner on 2026-10-09.

TRADEOFF: a bigger first review. Sends go through Signal's own send path and
refuse instead of prompting (D11), which keeps the new surface small.

## D22. Notification hand-off, opt-in per client

DECISION: a client holding `notifications.manage` can call
`notifications.setHandled { handled: true }`, but only while it is
subscribed to the `messages` topic (otherwise `PRECONDITION_FAILED`). While any connected client has
it set, Signal does not show message, reaction or unread-reminder
notifications. Call notifications are unaffected. The hand-off ends when the
client sets it back, unsubscribes from `messages`, has its events dropped,
disconnects, the bridge stops or the grant is revoked, so a client can never
hold notifications without receiving the messages it would notify about.

WHY: with the client as the user's surface, Signal minimized to the tray
would otherwise notify for every message the client already shows, so the
user gets two notifications for one message. This is the narrow piece of the
`presence.set` idea that clients need; it does not claim which conversation
is visible.

TRADEOFF: a client that sets the flag and then shows nothing hides
notifications. It needs a capability the user approved by name, and the
effect ends with the connection, so a crashed client cannot leave Signal
silent.

## D23. Settings: one toggle and an approved-apps list in Privacy

DECISION: Settings, Privacy gets an "Apps on this computer" section, shown
only when the remote-config flag (D20) is on: a switch for
`externalClientsEnabled` and the approved apps, each with Remove and a
confirmation. Remove revokes the grant and disconnects the app.

WHY: the user must be able to turn the bridge on without developer flags,
see what they approved and take it back.
