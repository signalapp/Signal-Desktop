// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  decodeBase64Url,
  serverTranscript,
  verifySignature,
} from '../../externalClient/auth.node.ts';
import type { EndpointType } from '../../externalClient/endpoint.node.ts';
import { getExternalClientEndpoint } from '../../externalClient/endpoint.node.ts';
import type {
  ApprovalPromptType,
  GrantStorageType,
} from '../../externalClient/ExternalClientAuthority.node.ts';
import { ExternalClientAuthority } from '../../externalClient/ExternalClientAuthority.node.ts';
import { ExternalClientServer } from '../../externalClient/ExternalClientServer.node.ts';
import { FrameKind } from '../../externalClient/framing.std.ts';
import type {
  ApprovalRequestType,
  ExternalClientHostType,
  GrantType,
  ServiceResultType,
} from '../../externalClient/hostTypes.std.ts';
import type { LimitsType } from '../../externalClient/protocol.std.ts';
import {
  ErrorCode,
  IMPLEMENTED_CAPABILITIES,
  LIMITS,
  PROTOCOL_NAME,
  SessionStatus,
} from '../../externalClient/protocol.std.ts';
import type { FakeKeyType } from '../../test-helpers/externalClientFakeClient.node.ts';
import {
  FakeClient,
  generateFakeClientKey,
} from '../../test-helpers/externalClientFakeClient.node.ts';

const silentLog = { info: () => null, warn: () => null, error: () => null };

async function sleep(ms: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms));
}

function makeMemoryStorage(): GrantStorageType & {
  grants: unknown;
  serverKey: unknown;
} {
  const storage = {
    grants: undefined as unknown,
    serverKey: undefined as unknown,
    readGrants: async () => storage.grants,
    writeGrants: async (grants: ReadonlyArray<GrantType>) => {
      storage.grants = grants;
    },
    readServerKey: async () => storage.serverKey,
    writeServerKey: async (key: unknown) => {
      storage.serverKey = key;
    },
  };
  return storage;
}

describe('externalClient/ExternalClientServer', () => {
  if (process.platform === 'win32') {
    // Named-pipe behavior is covered by manual testing on Windows for now.
    return;
  }

  let tempDir: string;
  let endpoint: EndpointType;
  let server: ExternalClientServer;
  let storage: ReturnType<typeof makeMemoryStorage>;
  let authority: ExternalClientAuthority;
  let prompts: Array<ApprovalRequestType>;
  let promptAnswer: ApprovalPromptType;
  let serviceCalls: Array<{ method: string; params: unknown }>;
  let serviceAnswer: () => Promise<ServiceResultType>;
  let status: (typeof SessionStatus)[keyof typeof SessionStatus];
  let topicChanges: Array<ReadonlyArray<string>>;
  let notificationChanges: Array<boolean>;
  const clients = new Array<FakeClient>();

  const host: ExternalClientHostType = {
    getStatus: async () => status,
    callService: async (method, params) => {
      serviceCalls.push({ method, params });
      return serviceAnswer();
    },
  };

  function makeServer(limits?: Partial<LimitsType>): ExternalClientServer {
    return new ExternalClientServer({
      endpoint,
      getSignalVersion: () => '8.33.0-test',
      log: silentLog,
      authority,
      host,
      limits,
      onTopicsChanged: topics => topicChanges.push(topics),
      onNotificationsHandledChanged: handled =>
        notificationChanges.push(handled),
    });
  }

  async function startServer(limits?: Partial<LimitsType>): Promise<void> {
    server = makeServer(limits);
    await server.start();
  }

  async function connectClient(): Promise<FakeClient> {
    const client = await FakeClient.connect(endpoint.path);
    clients.push(client);
    return client;
  }

  async function approvedClient(
    key: FakeKeyType = generateFakeClientKey(),
    capabilities: ReadonlyArray<string> = ['conversations.read']
  ): Promise<{ client: FakeClient; key: FakeKeyType }> {
    const client = await connectClient();
    const hello = await client.hello();
    const response = await client.requestAuthorization(
      key,
      hello,
      capabilities
    );
    assert.deepEqual(response.result, { capabilities });
    return { client, key };
  }

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'signal-ext-'));
    endpoint = getExternalClientEndpoint({
      platform: 'linux',
      userDataPath: join(tempDir, 'userData'),
      username: 'tester',
      runtimeDir: tempDir,
    });
    storage = makeMemoryStorage();
    prompts = [];
    promptAnswer = async request => request.capabilities;
    authority = new ExternalClientAuthority({
      storage,
      prompt: async request => {
        prompts.push(request);
        return promptAnswer(request);
      },
    });
    serviceCalls = [];
    serviceAnswer = async () => ({ ok: true, value: { conversations: [] } });
    status = SessionStatus.Ready;
    topicChanges = [];
    notificationChanges = [];
  });

  afterEach(async () => {
    for (const client of clients.splice(0)) {
      client.close();
    }
    await server?.stop();
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('handshake', () => {
    it('answers hello with versions, implemented capabilities and a signed server proof', async () => {
      await startServer();
      const client = await connectClient();
      const result = await client.hello();

      assert.deepEqual(Object.keys(result).sort(), [
        'capabilities',
        'challenge',
        'features',
        'protocol',
        'protocolVersion',
        'server',
        'sessionId',
        'signalVersion',
      ]);
      assert.strictEqual(result.protocol, PROTOCOL_NAME);
      assert.strictEqual(result.protocolVersion, 1);
      assert.strictEqual(result.signalVersion, '8.33.0-test');
      assert.deepEqual(result.capabilities, IMPLEMENTED_CAPABILITIES);
      assert.deepEqual(result.features, {
        'authentication.required': true,
        'calling.available': false,
      });
      assert.match(String(result.sessionId), /^[0-9a-f]{32}$/);

      const serverInfo = result.server as Record<string, string>;
      assert.isTrue(
        verifySignature(
          String(serverInfo.publicKey),
          serverTranscript(
            String(result.sessionId),
            decodeBase64Url(String(result.challenge)),
            decodeBase64Url(client.clientNonce)
          ),
          String(serverInfo.signature)
        )
      );
    });

    it('keeps the same server key across sessions', async () => {
      await startServer();
      const first = await (await connectClient()).hello();
      const second = await (await connectClient()).hello();
      assert.deepEqual(
        (first.server as Record<string, string>).publicKey,
        (second.server as Record<string, string>).publicKey
      );
      assert.notEqual(first.challenge, second.challenge);
    });

    it('requires a client nonce', async () => {
      await startServer();
      const client = await connectClient();
      const params = client.helloParams();
      delete params.clientNonce;
      const response = await client.request('session.hello', params);
      assert.strictEqual(response.error?.code, ErrorCode.InvalidRequest);
      await client.waitClosed();
    });

    it('creates a private directory and socket', async () => {
      await startServer();
      assert.strictEqual(endpoint.kind, 'socket');
      if (endpoint.kind !== 'socket') {
        return;
      }
      const permissions = (mode: number) => mode.toString(8).slice(-3);
      assert.strictEqual(
        permissions((await stat(endpoint.directory)).mode),
        '700'
      );
      assert.strictEqual(permissions((await stat(endpoint.path)).mode), '600');
    });

    it('writes nothing before the client speaks', async () => {
      await startServer();
      const client = await connectClient();
      await sleep(200);
      assert.strictEqual(client.pending, 0);
      assert.isFalse(client.closed);
    });

    it('requires hello first', async () => {
      await startServer();
      const client = await connectClient();
      const response = await client.request('conversations.list', {});
      assert.strictEqual(response.error?.code, ErrorCode.InvalidRequest);
      await client.waitClosed();
    });

    it('rejects an unsupported protocol version and closes', async () => {
      await startServer();
      const client = await connectClient();
      const response = await client.request('session.hello', {
        ...client.helloParams(),
        versions: [2, 3],
      });
      assert.strictEqual(response.error?.code, ErrorCode.UnsupportedVersion);
      await client.waitClosed();
    });

    it('closes on an oversized frame without buffering it', async () => {
      await startServer();
      const client = await connectClient();
      const header = new Uint8Array(5);
      new DataView(header.buffer).setUint8(0, FrameKind.Json);
      new DataView(header.buffer).setUint32(1, LIMITS.maxFrameBytes + 1, false);
      client.socket.write(header);
      const response = await client.next();
      assert.strictEqual(response.error?.code, ErrorCode.InvalidRequest);
      await client.waitClosed();
    });

    it('closes on non-JSON and invalid UTF-8 payloads', async () => {
      await startServer();
      for (const payload of [
        new TextEncoder().encode('{not json'),
        new Uint8Array([0x7b, 0xff, 0xfe, 0x7d]),
      ]) {
        // oxlint-disable-next-line no-await-in-loop
        const client = await connectClient();
        const frame = new Uint8Array(5 + payload.byteLength);
        new DataView(frame.buffer).setUint8(0, FrameKind.Json);
        new DataView(frame.buffer).setUint32(1, payload.byteLength, false);
        frame.set(payload, 5);
        client.socket.write(frame);
        // oxlint-disable-next-line no-await-in-loop
        const response = await client.next();
        assert.strictEqual(response.error?.code, ErrorCode.InvalidRequest);
        // oxlint-disable-next-line no-await-in-loop
        await client.waitClosed();
      }
    });

    it('rejects a second hello', async () => {
      await startServer();
      const client = await connectClient();
      await client.hello();
      const response = await client.request(
        'session.hello',
        client.helloParams()
      );
      assert.strictEqual(response.error?.code, ErrorCode.InvalidRequest);
      await client.waitClosed();
    });

    it('acknowledges disconnect and closes', async () => {
      await startServer();
      const client = await connectClient();
      await client.hello();
      const response = await client.request('session.disconnect');
      assert.deepEqual(response.result, {});
      await client.waitClosed();
    });

    it('times out clients that never say hello', async () => {
      await startServer({ handshakeTimeoutMs: 100 });
      const client = await connectClient();
      await client.waitClosed();
      assert.strictEqual(client.pending, 0);
    });

    it('times out clients that say hello but never authenticate', async () => {
      await startServer({ handshakeTimeoutMs: 150 });
      const client = await connectClient();
      await client.hello();
      await client.waitClosed();
    });

    it('limits concurrent connections', async () => {
      await startServer({ maxConnections: 2 });
      await connectClient();
      await connectClient();
      await sleep(50);
      const third = await connectClient();
      await third.waitClosed();
      assert.strictEqual(server.sessionCount, 2);
    });

    it('removes the socket on stop and can restart', async () => {
      await startServer();
      await server.stop();
      try {
        await stat(endpoint.path);
        assert.fail('socket should have been removed');
      } catch (error) {
        assert.strictEqual(error.code, 'ENOENT');
      }

      await startServer();
      const client = await connectClient();
      await client.hello();
    });

    it('closes live sessions on stop', async () => {
      await startServer();
      const client = await connectClient();
      await client.hello();
      await server.stop();
      await client.waitClosed();
    });

    it('refuses to replace a file that is not its socket', async () => {
      if (endpoint.kind !== 'socket') {
        return;
      }
      await startServer();
      await server.stop();
      await writeFile(endpoint.path, 'not a socket');
      server = makeServer();
      let threw = false;
      try {
        await server.start();
      } catch {
        threw = true;
      }
      assert.isTrue(threw);
      assert.isFalse(server.isListening);
    });
  });

  describe('authorization', () => {
    it('refuses data methods before authentication without closing', async () => {
      await startServer();
      const client = await connectClient();
      await client.hello();
      for (const method of [
        'conversations.list',
        'conversations.get',
        'session.getStatus',
      ]) {
        // oxlint-disable-next-line no-await-in-loop
        const response = await client.request(method, {});
        assert.strictEqual(response.error?.code, ErrorCode.NotAuthorized);
      }
      assert.isFalse(client.closed);
      assert.isEmpty(serviceCalls);
    });

    it('refuses unknown methods, including internal IPC names', async () => {
      await startServer();
      const { client } = await approvedClient();
      for (const method of [
        'messages.sendAttachment',
        'sql-channel:read',
        'external-client:call',
        'executeSQL',
        'dispatchReduxAction',
        '__proto__',
        'constructor',
        'hasOwnProperty',
      ]) {
        // oxlint-disable-next-line no-await-in-loop
        const response = await client.request(method, {});
        assert.strictEqual(
          response.error?.code,
          ErrorCode.UnsupportedMethod,
          method
        );
      }
      assert.isFalse(client.closed);
      assert.isEmpty(serviceCalls);
    });

    it('prompts once, then serves the approved capability', async () => {
      await startServer();
      const key = generateFakeClientKey();
      const { client } = await approvedClient(key);

      assert.lengthOf(prompts, 1);
      assert.strictEqual(prompts[0]?.displayName, 'Fake Client');
      assert.deepEqual(prompts[0]?.capabilities, ['conversations.read']);
      assert.match(prompts[0]?.fingerprint ?? '', /^[0-9a-f ]{19}$/);

      const response = await client.request('conversations.list', {
        limit: 10,
      });
      assert.deepEqual(response.result, { conversations: [] });
      assert.deepEqual(serviceCalls, [
        { method: 'conversations.list', params: { limit: 10 } },
      ]);
    });

    it('lets an approved key reconnect without a prompt', async () => {
      await startServer();
      const key = generateFakeClientKey();
      (await approvedClient(key)).client.close();

      const client = await connectClient();
      const hello = await client.hello();
      const response = await client.authenticate(key, hello);
      assert.deepEqual(response.result, {
        capabilities: ['conversations.read'],
      });
      assert.lengthOf(prompts, 1);

      const grant = await authority.findGrant(key.publicKey);
      assert.isNumber(grant?.lastSeenAt);
    });

    it('re-requesting a held capability does not prompt again', async () => {
      await startServer();
      const key = generateFakeClientKey();
      (await approvedClient(key)).client.close();
      await approvedClient(key);
      assert.lengthOf(prompts, 1);
    });

    it('rejects an unknown key', async () => {
      await startServer();
      const client = await connectClient();
      const hello = await client.hello();
      const response = await client.authenticate(
        generateFakeClientKey(),
        hello
      );
      assert.strictEqual(response.error?.code, ErrorCode.NotAuthorized);
      await client.waitClosed();
    });

    it('rejects a valid key with a signature for another session', async () => {
      await startServer();
      const key = generateFakeClientKey();
      (await approvedClient(key)).client.close();

      const client = await connectClient();
      const hello = await client.hello();
      const response = await client.request('session.authenticate', {
        publicKey: key.publicKey,
        signature: FakeClient.proof(key, hello, '0'.repeat(32)),
      });
      assert.strictEqual(response.error?.code, ErrorCode.NotAuthorized);
      await client.waitClosed();
    });

    it('rejects an authorization request with a forged proof', async () => {
      await startServer();
      const client = await connectClient();
      const hello = await client.hello();
      const victim = generateFakeClientKey();
      const response = await client.request('authorization.request', {
        publicKey: victim.publicKey,
        signature: FakeClient.proof(generateFakeClientKey(), hello),
        displayName: 'Impostor',
        capabilities: ['conversations.read'],
      });
      assert.strictEqual(response.error?.code, ErrorCode.NotAuthorized);
      assert.isEmpty(prompts);
    });

    it('denies, closes, and then rate-limits the same key', async () => {
      await startServer();
      promptAnswer = async () => undefined;
      const key = generateFakeClientKey();

      const first = await connectClient();
      const response = await first.requestAuthorization(
        key,
        await first.hello(),
        ['conversations.read']
      );
      assert.strictEqual(response.error?.code, ErrorCode.PermissionDenied);
      await first.waitClosed();

      const second = await connectClient();
      const retry = await second.requestAuthorization(
        key,
        await second.hello(),
        ['conversations.read']
      );
      assert.strictEqual(retry.error?.code, ErrorCode.RateLimited);
      assert.lengthOf(prompts, 1);
      assert.isUndefined(await authority.findGrant(key.publicKey));
    });

    it('refuses capabilities this build does not implement', async () => {
      await startServer();
      const client = await connectClient();
      const response = await client.requestAuthorization(
        generateFakeClientKey(),
        await client.hello(),
        ['typing.send']
      );
      assert.strictEqual(response.error?.code, ErrorCode.UnsupportedCapability);
      assert.isEmpty(prompts);
    });

    it('refuses unknown capability names', async () => {
      await startServer();
      const client = await connectClient();
      const response = await client.requestAuthorization(
        generateFakeClientKey(),
        await client.hello(),
        ['calls.control']
      );
      assert.strictEqual(response.error?.code, ErrorCode.InvalidRequest);
      assert.isEmpty(prompts);
    });

    it('refuses display names with control or bidi characters', async () => {
      await startServer();
      for (const displayName of ['Signal‮ppa', 'two\nlines', '']) {
        // oxlint-disable-next-line no-await-in-loop
        const client = await connectClient();
        // oxlint-disable-next-line no-await-in-loop
        const response = await client.requestAuthorization(
          generateFakeClientKey(),
          // oxlint-disable-next-line no-await-in-loop
          await client.hello(),
          ['conversations.read'],
          displayName
        );
        assert.strictEqual(response.error?.code, ErrorCode.InvalidRequest);
      }
      assert.isEmpty(prompts);
    });

    it('enforces capabilities per method', async () => {
      await startServer();
      const key = generateFakeClientKey();
      // A grant that holds a different capability than the method needs.
      storage.grants = [
        {
          publicKey: key.publicKey,
          fingerprint: 'x',
          displayName: 'Reader',
          capabilities: ['messages.read'],
          approvedAt: 1,
          lastSeenAt: null,
        },
      ];
      const client = await connectClient();
      const hello = await client.hello();
      assert.deepEqual((await client.authenticate(key, hello)).result, {
        capabilities: ['messages.read'],
      });
      const response = await client.request('conversations.list', {});
      assert.strictEqual(response.error?.code, ErrorCode.PermissionDenied);
      assert.isEmpty(serviceCalls);
    });

    it('keeps message reads behind messages.read', async () => {
      await startServer();
      const { client } = await approvedClient();
      for (const method of ['messages.list', 'messages.get']) {
        // oxlint-disable-next-line no-await-in-loop
        const response = await client.request(method, {});
        assert.strictEqual(
          response.error?.code,
          ErrorCode.PermissionDenied,
          method
        );
      }
      assert.isEmpty(serviceCalls);
    });

    it('revocation closes live sessions and blocks reconnects', async () => {
      await startServer();
      const key = generateFakeClientKey();
      const { client } = await approvedClient(key);

      assert.isTrue(await authority.revoke(key.publicKey));
      assert.strictEqual(server.revoke(key.publicKey), 1);
      await client.waitClosed();

      const again = await connectClient();
      const response = await again.authenticate(key, await again.hello());
      assert.strictEqual(response.error?.code, ErrorCode.NotAuthorized);
    });
  });

  describe('service calls', () => {
    it('validates params before calling the service', async () => {
      await startServer();
      // Hold every implemented capability, so validation is what refuses.
      const { client } = await approvedClient(
        generateFakeClientKey(),
        IMPLEMENTED_CAPABILITIES
      );
      for (const [method, params] of [
        ['conversations.list', { limit: 0 }],
        ['conversations.list', { limit: LIMITS.maxConversationPage + 1 }],
        ['conversations.list', { cursor: 'abc' }],
        ['conversations.list', { extra: true }],
        ['conversations.get', {}],
        ['conversations.get', { conversationId: '../../etc/passwd' }],
        ['conversations.get', { conversationId: '+15555550100 ' }],
        ['messages.list', {}],
        ['messages.list', { conversationId: 'abc', limit: 0 }],
        [
          'messages.list',
          { conversationId: 'abc', limit: LIMITS.maxMessagePage + 1 },
        ],
        ['messages.list', { conversationId: 'abc', cursor: '../x' }],
        ['messages.list', { conversationId: 'abc', before: 1 }],
        ['messages.get', {}],
        ['messages.get', { messageId: 'a b' }],
      ] as const) {
        // oxlint-disable-next-line no-await-in-loop
        const response = await client.request(method, params);
        assert.strictEqual(
          response.error?.code,
          ErrorCode.InvalidArgument,
          JSON.stringify(params)
        );
      }
      assert.isEmpty(serviceCalls);
    });

    it('forwards message reads to the service', async () => {
      await startServer();
      const page = { messages: [], nextCursor: null };
      serviceAnswer = async () => ({ ok: true, value: page });
      const { client } = await approvedClient(generateFakeClientKey(), [
        'messages.read',
      ]);
      const params = { conversationId: 'abc-123', limit: 20, cursor: 'm-1' };
      const response = await client.request('messages.list', params);
      assert.deepEqual(response.result, page);
      assert.deepEqual(serviceCalls, [{ method: 'messages.list', params }]);
    });

    it('passes service errors through as codes only', async () => {
      await startServer();
      serviceAnswer = async () => ({ ok: false, code: ErrorCode.NotReady });
      const { client } = await approvedClient();
      const response = await client.request('conversations.get', {
        conversationId: 'abc-123',
      });
      assert.deepEqual(response.error, {
        code: ErrorCode.NotReady,
        message: 'Signal is not ready',
      });
    });

    it('reports status only to authorized clients', async () => {
      await startServer();
      status = SessionStatus.Unlinked;
      const { client } = await approvedClient();
      const response = await client.request('session.getStatus');
      assert.deepEqual(response.result, { state: 'unlinked' });
    });

    it('caps outstanding requests per session', async () => {
      await startServer({ maxOutstandingRequests: 2 });
      const { client } = await approvedClient();
      serviceAnswer = () => new Promise(() => null);
      for (let i = 0; i < 3; i += 1) {
        client.send({ id: `q${i}`, method: 'conversations.list', params: {} });
      }
      const response = await client.next();
      assert.strictEqual(response.id, 'q2');
      assert.strictEqual(response.error?.code, ErrorCode.RateLimited);
    });
  });

  describe('events', () => {
    const message = { id: 'm-1', conversationId: 'c-1', body: 'hi' };
    const conversation = { id: 'c-1', title: 'Chat' };

    async function waitForTopics(expected: ReadonlyArray<string>) {
      for (let i = 0; i < 50; i += 1) {
        if (topicChanges.at(-1)?.join() === expected.join()) {
          return;
        }
        // oxlint-disable-next-line no-await-in-loop
        await sleep(10);
      }
      assert.deepEqual(topicChanges.at(-1), expected);
    }

    it('requires authorization to subscribe', async () => {
      await startServer();
      const client = await connectClient();
      await client.hello();
      const response = await client.request('events.subscribe', {
        topics: ['messages'],
      });
      assert.strictEqual(response.error?.code, ErrorCode.NotAuthorized);
    });

    it('refuses topics the client has no capability for', async () => {
      await startServer();
      const { client } = await approvedClient();
      const response = await client.request('events.subscribe', {
        topics: ['conversations', 'messages'],
      });
      assert.strictEqual(response.error?.code, ErrorCode.PermissionDenied);
      assert.deepEqual(server.topics, []);
    });

    it('rejects unknown topics', async () => {
      await startServer();
      const { client } = await approvedClient();
      const response = await client.request('events.subscribe', {
        topics: ['typing'],
      });
      assert.strictEqual(response.error?.code, ErrorCode.InvalidArgument);
    });

    it('delivers events only for subscribed topics, in order', async () => {
      await startServer();
      const { client } = await approvedClient(undefined, [
        'conversations.read',
        'messages.read',
      ]);
      const subscribed = await client.request('events.subscribe', {
        topics: ['messages'],
      });
      assert.deepEqual(subscribed.result, { topics: ['messages'] });
      await waitForTopics(['messages']);

      server.broadcast('conversation.updated', conversation);
      server.broadcast('message.added', message);
      server.broadcast('message.removed', {
        messageId: 'm-1',
        conversationId: 'c-1',
      });

      assert.deepEqual(await client.nextEvent(), {
        event: 'message.added',
        seq: 1,
        data: message,
      });
      const removed = await client.nextEvent();
      assert.strictEqual(removed.event, 'message.removed');
      assert.strictEqual(removed.seq, 2);
      await sleep(20);
      assert.strictEqual(client.pendingEvents, 0);
    });

    it('routes events to each session by its own topics', async () => {
      await startServer();
      const both = ['conversations.read', 'messages.read'];
      const { client: first } = await approvedClient(undefined, both);
      const { client: second } = await approvedClient(undefined, both);
      await first.request('events.subscribe', { topics: ['conversations'] });
      await second.request('events.subscribe', { topics: ['messages'] });
      await waitForTopics(['conversations', 'messages']);

      server.broadcast('message.updated', message);
      server.broadcast('conversation.updated', conversation);

      assert.strictEqual(
        (await first.nextEvent()).event,
        'conversation.updated'
      );
      assert.strictEqual((await second.nextEvent()).event, 'message.updated');
      await sleep(20);
      assert.strictEqual(first.pendingEvents, 0);
      assert.strictEqual(second.pendingEvents, 0);
    });

    it('stops delivering after unsubscribe', async () => {
      await startServer();
      const { client } = await approvedClient();
      await client.request('events.subscribe', { topics: ['conversations'] });
      await waitForTopics(['conversations']);
      const response = await client.request('events.unsubscribe');
      assert.deepEqual(response.result, { topics: [] });
      await waitForTopics([]);

      server.broadcast('conversation.updated', conversation);
      await sleep(20);
      assert.strictEqual(client.pendingEvents, 0);
    });

    it('clears topics when the client disconnects', async () => {
      await startServer();
      const { client } = await approvedClient();
      await client.request('events.subscribe', { topics: ['conversations'] });
      await waitForTopics(['conversations']);
      client.close();
      await waitForTopics([]);
      assert.deepEqual(server.topics, []);
    });

    it('tells subscribers to resynchronize when events are dropped', async () => {
      await startServer();
      const { client } = await approvedClient();
      await client.request('events.subscribe', { topics: ['conversations'] });
      server.broadcast('conversation.updated', conversation);
      server.dropEvents();
      server.broadcast('conversation.updated', conversation);

      assert.strictEqual((await client.nextEvent()).seq, 1);
      assert.deepEqual(await client.nextEvent(), {
        event: 'events.dropped',
        seq: 2,
        data: {},
      });
      await sleep(20);
      assert.strictEqual(client.pendingEvents, 0);
      await waitForTopics([]);

      // Resubscribing works and continues the sequence.
      await client.request('events.subscribe', { topics: ['conversations'] });
      server.broadcast('conversation.updated', conversation);
      assert.strictEqual((await client.nextEvent()).seq, 3);
    });

    it('drops events for a client that is not reading', async () => {
      await startServer({ maxEventBacklogBytes: 64 * 1024 });
      const { client } = await approvedClient();
      await client.request('events.subscribe', { topics: ['conversations'] });
      await waitForTopics(['conversations']);
      client.socket.pause();

      const big = { id: 'c-1', title: 'x'.repeat(16 * 1024) };
      for (let i = 0; i < 200 && server.topics.length > 0; i += 1) {
        server.broadcast('conversation.updated', big);
      }
      assert.deepEqual(server.topics, []);

      client.socket.resume();
      let last;
      do {
        // oxlint-disable-next-line no-await-in-loop
        last = await client.nextEvent();
      } while (last.event === 'conversation.updated');
      assert.strictEqual(last.event, 'events.dropped');
    });
  });

  describe('sending and notifications', () => {
    it('requires messages.send to send', async () => {
      await startServer();
      const { client } = await approvedClient(undefined, ['messages.read']);
      const response = await client.request('messages.sendText', {
        conversationId: 'abc-123',
        body: 'hi',
      });
      assert.strictEqual(response.error?.code, ErrorCode.PermissionDenied);
      assert.deepEqual(serviceCalls, []);
    });

    it('forwards a valid send', async () => {
      await startServer();
      const { client } = await approvedClient(undefined, ['messages.send']);
      serviceAnswer = async () => ({ ok: true, value: { message: {} } });
      const params = { conversationId: 'abc-123', body: 'hi' };
      const response = await client.request('messages.sendText', params);
      assert.deepEqual(response.result, { message: {} });
      assert.deepEqual(serviceCalls, [{ method: 'messages.sendText', params }]);
    });

    it('rejects empty and oversized bodies before Signal sees them', async () => {
      await startServer();
      const { client } = await approvedClient(undefined, ['messages.send']);
      for (const body of ['', 'x'.repeat(64 * 1024 + 1)]) {
        // oxlint-disable-next-line no-await-in-loop
        const response = await client.request('messages.sendText', {
          conversationId: 'abc-123',
          body,
        });
        assert.strictEqual(response.error?.code, ErrorCode.InvalidArgument);
      }
      assert.deepEqual(serviceCalls, []);
    });

    it('passes the reason a send was refused', async () => {
      await startServer();
      const { client } = await approvedClient(undefined, ['messages.send']);
      serviceAnswer = async () => ({
        ok: false,
        code: ErrorCode.PreconditionFailed,
        reason: 'untrustedIdentity',
      });
      const response = await client.request('messages.sendText', {
        conversationId: 'abc-123',
        body: 'hi',
      });
      assert.deepEqual(response.error, {
        code: ErrorCode.PreconditionFailed,
        message: 'Precondition failed',
        reason: 'untrustedIdentity',
      });
    });

    it('requires messages.markRead to mark read', async () => {
      await startServer();
      const { client } = await approvedClient(undefined, ['messages.read']);
      const response = await client.request('messages.markRead', {
        conversationId: 'abc-123',
        upToMessageId: 'm-1',
      });
      assert.strictEqual(response.error?.code, ErrorCode.PermissionDenied);
    });

    it('requires notifications.manage to take over notifications', async () => {
      await startServer();
      const { client } = await approvedClient(undefined, ['messages.read']);
      const response = await client.request('notifications.setHandled', {
        handled: true,
      });
      assert.strictEqual(response.error?.code, ErrorCode.PermissionDenied);
      assert.isFalse(server.notificationsHandled);
    });

    it('hands notifications back when the app releases or disconnects', async () => {
      await startServer();
      const caps = ['messages.read', 'notifications.manage'];
      const { client: first } = await approvedClient(undefined, caps);
      const { client: second } = await approvedClient(undefined, caps);
      for (const client of [first, second]) {
        // oxlint-disable-next-line no-await-in-loop
        await client.request('events.subscribe', { topics: ['messages'] });
      }

      const on = await first.request('notifications.setHandled', {
        handled: true,
      });
      assert.deepEqual(on.result, { handled: true });
      await second.request('notifications.setHandled', { handled: true });
      assert.isTrue(server.notificationsHandled);
      assert.deepEqual(notificationChanges, [true]);

      await first.request('notifications.setHandled', { handled: false });
      assert.isTrue(server.notificationsHandled, 'second app still handles');

      second.close();
      for (let i = 0; i < 50 && server.notificationsHandled; i += 1) {
        // oxlint-disable-next-line no-await-in-loop
        await sleep(10);
      }
      assert.isFalse(server.notificationsHandled);
      assert.deepEqual(notificationChanges, [true, false]);
    });

    it('only hands off notifications while the app receives messages', async () => {
      await startServer();
      const { client } = await approvedClient(undefined, [
        'messages.read',
        'notifications.manage',
      ]);

      const refused = await client.request('notifications.setHandled', {
        handled: true,
      });
      assert.strictEqual(refused.error?.code, ErrorCode.PreconditionFailed);
      assert.isFalse(server.notificationsHandled);

      await client.request('events.subscribe', { topics: ['messages'] });
      await client.request('notifications.setHandled', { handled: true });
      assert.isTrue(server.notificationsHandled);

      await client.request('events.unsubscribe', { topics: ['messages'] });
      assert.isFalse(server.notificationsHandled);
      assert.deepEqual(notificationChanges, [true, false]);

      await client.request('events.subscribe', { topics: ['messages'] });
      await client.request('notifications.setHandled', { handled: true });
      server.dropEvents();
      assert.isFalse(server.notificationsHandled, 'released on drop');
    });
  });
});
