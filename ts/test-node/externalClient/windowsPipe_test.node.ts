// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { randomBytes } from 'node:crypto';
import { connect } from 'node:net';

import type { EndpointType } from '../../externalClient/endpoint.node.ts';
import type { GrantType } from '../../externalClient/hostTypes.std.ts';
import { ExternalClientAuthority } from '../../externalClient/ExternalClientAuthority.node.ts';
import { ExternalClientServer } from '../../externalClient/ExternalClientServer.node.ts';
import {
  ErrorCode,
  IMPLEMENTED_CAPABILITIES,
  SessionStatus,
} from '../../externalClient/protocol.std.ts';
import {
  FakeClient,
  generateFakeClientKey,
} from '../../test-helpers/externalClientFakeClient.node.ts';

// Runs the bridge over a real named pipe from @signalapp/windows-local-pipe.
// The DACL itself (current user only) is checked by hand with accesschk;
// see docs/external-client-threat-model.md, T3.

const silentLog = { info: () => null, warn: () => null, error: () => null };

describe('externalClient/windows named pipe', function (this: Mocha.Suite) {
  if (process.platform !== 'win32') {
    return;
  }
  this.timeout(10_000);

  let name: string;
  let server: ExternalClientServer;
  const clients = new Array<FakeClient>();

  function makeServer(): ExternalClientServer {
    let grants: unknown;
    let serverKey: unknown;
    const endpoint: EndpointType = { kind: 'pipe', path: name };
    return new ExternalClientServer({
      endpoint,
      getSignalVersion: () => '8.33.0-test',
      log: silentLog,
      authority: new ExternalClientAuthority({
        storage: {
          readGrants: async () => grants,
          writeGrants: async (value: ReadonlyArray<GrantType>) => {
            grants = value;
          },
          readServerKey: async () => serverKey,
          writeServerKey: async (value: unknown) => {
            serverKey = value;
          },
        },
        prompt: async request => request.capabilities,
      }),
      host: {
        getStatus: async () => SessionStatus.Ready,
        callService: async () => ({ ok: true, value: { conversations: [] } }),
      },
    });
  }

  async function connectClient(path = name): Promise<FakeClient> {
    const client = await FakeClient.connect(path);
    clients.push(client);
    return client;
  }

  beforeEach(async () => {
    name = `\\\\.\\pipe\\signal-ext-test-${randomBytes(8).toString('hex')}`;
    server = makeServer();
    await server.start();
  });

  afterEach(async () => {
    for (const client of clients.splice(0)) {
      client.close();
    }
    await server.stop();
  });

  it('completes the handshake and serves an approved client', async () => {
    const client = await connectClient();
    const hello = await client.hello();
    assert.deepEqual(hello.capabilities, IMPLEMENTED_CAPABILITIES);
    const key = generateFakeClientKey();
    const granted = await client.requestAuthorization(key, hello, [
      'conversations.read',
    ]);
    assert.deepEqual(granted.result, { capabilities: ['conversations.read'] });
    const list = await client.request('conversations.list', {});
    assert.deepEqual(list.result, { conversations: [] });

    const disconnect = await client.request('session.disconnect');
    assert.isDefined(disconnect.result);
    await client.waitClosed();
  });

  it('delivers the final error before closing', async () => {
    const client = await connectClient();
    const payload = new TextEncoder().encode('{not json');
    const frame = new Uint8Array(5 + payload.byteLength);
    new DataView(frame.buffer).setUint8(0, 1);
    new DataView(frame.buffer).setUint32(1, payload.byteLength, false);
    frame.set(payload, 5);
    client.socket.write(frame);
    const response = await client.next();
    assert.strictEqual(response.error?.code, ErrorCode.InvalidRequest);
    await client.waitClosed();
  });

  it('serves several clients at once', async () => {
    const all = await Promise.all([
      connectClient(),
      connectClient(),
      connectClient(),
    ]);
    const hellos = await Promise.all(all.map(client => client.hello()));
    assert.strictEqual(new Set(hellos.map(h => h.sessionId)).size, 3);
  });

  it('refuses a second listener on the same name', async () => {
    const squatter = makeServer();
    let failed = false;
    try {
      await squatter.start();
    } catch {
      failed = true;
    }
    assert.isTrue(failed);
    assert.isFalse(squatter.isListening);
  });

  it('refuses clients that come in over SMB', async () => {
    const remotePath = name.replace('\\\\.\\', '\\\\localhost\\');
    const error = await new Promise<NodeJS.ErrnoException | undefined>(
      resolve => {
        const socket = connect(remotePath);
        socket.once('connect', () => {
          socket.destroy();
          resolve(undefined);
        });
        socket.once('error', resolve);
      }
    );
    assert.isDefined(error, 'remote connection should fail');
  });
});
