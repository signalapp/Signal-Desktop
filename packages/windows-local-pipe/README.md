<!-- Copyright 2026 Signal Messenger, LLC -->
<!-- SPDX-License-Identifier: AGPL-3.0-only -->

# @signalapp/windows-local-pipe

A Windows named pipe server for local IPC that is stricter than Node's
`net.Server`:

- the pipe's DACL grants access to the current user only (Node/libuv also
  grant read access to Everyone and ANONYMOUS LOGON);
- `PIPE_REJECT_REMOTE_CLIENTS`, so clients connecting over SMB
  (`\\host\pipe\name`) are refused;
- `FILE_FLAG_FIRST_PIPE_INSTANCE`, so listening fails if the name is taken.

Connections are exposed as Node `Duplex` streams. Used by Signal Desktop's
external-client bridge (`ts/externalClient`).

## Usage

```js
import { LocalPipeServer } from '@signalapp/windows-local-pipe';

const server = new LocalPipeServer();
server.on('connection', (socket) => socket.pipe(socket));
await server.listen('\\\\.\\pipe\\example');
```
