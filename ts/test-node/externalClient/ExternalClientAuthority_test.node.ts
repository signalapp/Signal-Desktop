// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import type {
  ApprovalPromptType,
  GrantStorageType,
} from '../../externalClient/ExternalClientAuthority.node.ts';
import {
  DENIAL_COOLDOWN_MS,
  ExternalClientAuthority,
} from '../../externalClient/ExternalClientAuthority.node.ts';
import type { GrantType } from '../../externalClient/hostTypes.std.ts';
import type { CapabilityType } from '../../externalClient/protocol.std.ts';
import { explodePromise } from '../../util/explodePromise.std.ts';
import { generateFakeClientKey } from '../../test-helpers/externalClientFakeClient.node.ts';

describe('externalClient/ExternalClientAuthority', () => {
  let stored: { grants: unknown; serverKey: unknown };
  let storage: GrantStorageType;
  let now: number;

  beforeEach(() => {
    stored = { grants: undefined, serverKey: undefined };
    storage = {
      readGrants: async () => stored.grants,
      writeGrants: async (grants: ReadonlyArray<GrantType>) => {
        stored.grants = grants;
      },
      readServerKey: async () => stored.serverKey,
      writeServerKey: async key => {
        stored.serverKey = key;
      },
    };
    now = 1_000_000;
  });

  function makeAuthority(prompt: ApprovalPromptType): ExternalClientAuthority {
    return new ExternalClientAuthority({ storage, prompt, now: () => now });
  }

  function request(
    publicKey: string,
    capabilities: ReadonlyArray<CapabilityType> = ['conversations.read']
  ) {
    return {
      publicKey,
      fingerprint: 'ignored',
      displayName: 'App',
      capabilities,
    };
  }

  it('creates the server key once and persists it', async () => {
    const authority = makeAuthority(async () => undefined);
    const key = await authority.getServerKey();
    assert.deepEqual(stored.serverKey, key);
    const reloaded = makeAuthority(async () => undefined);
    assert.deepEqual(await reloaded.getServerKey(), key);
  });

  it('treats a corrupt grant list as empty', async () => {
    stored.grants = [{ publicKey: 'not a key', capabilities: 'all' }];
    const authority = makeAuthority(async () => undefined);
    assert.deepEqual(await authority.listGrants(), []);
  });

  it('never grants more than was requested', async () => {
    const { publicKey } = generateFakeClientKey();
    const authority = makeAuthority(async () => [
      'conversations.read',
      'messages.send',
    ]);
    const result = await authority.requestApproval(request(publicKey));
    assert.isTrue(result.approved);
    assert.deepEqual((await authority.findGrant(publicKey))?.capabilities, [
      'conversations.read',
    ]);
  });

  it('records the server-computed fingerprint, not the caller one', async () => {
    const { publicKey } = generateFakeClientKey();
    const authority = makeAuthority(async req => req.capabilities);
    await authority.requestApproval(request(publicKey));
    const grant = await authority.findGrant(publicKey);
    assert.notEqual(grant?.fingerprint, 'ignored');
    assert.match(String(grant?.fingerprint), /^[0-9a-f]{4}( [0-9a-f]{4}){3}$/);
  });

  it('applies a cooldown after a denial, then allows a new prompt', async () => {
    const { publicKey } = generateFakeClientKey();
    let prompts = 0;
    const authority = makeAuthority(async () => {
      prompts += 1;
      return undefined;
    });
    assert.deepEqual(await authority.requestApproval(request(publicKey)), {
      approved: false,
      reason: 'denied',
    });
    assert.deepEqual(await authority.requestApproval(request(publicKey)), {
      approved: false,
      reason: 'cooldown',
    });
    now += DENIAL_COOLDOWN_MS;
    await authority.requestApproval(request(publicKey));
    assert.strictEqual(prompts, 2);
  });

  it('shows one prompt at a time', async () => {
    const { promise, resolve } = explodePromise<
      ReadonlyArray<CapabilityType> | undefined
    >();
    const authority = makeAuthority(() => promise);
    const first = authority.requestApproval(
      request(generateFakeClientKey().publicKey)
    );
    assert.deepEqual(
      await authority.requestApproval(
        request(generateFakeClientKey().publicKey)
      ),
      { approved: false, reason: 'busy' }
    );
    resolve(['conversations.read']);
    assert.isTrue((await first).approved);
  });

  it('keeps concurrent updates', async () => {
    const keys = [generateFakeClientKey(), generateFakeClientKey()];
    const authority = makeAuthority(async req => req.capabilities);
    await authority.requestApproval(request(keys[0]?.publicKey ?? ''));
    await authority.requestApproval(request(keys[1]?.publicKey ?? ''));
    now += 5;
    await Promise.all(keys.map(key => authority.markSeen(key.publicKey)));
    const grants = await authority.listGrants();
    assert.lengthOf(grants, 2);
    assert.isTrue(grants.every(grant => grant.lastSeenAt === now));
  });

  it('revokes only the named key', async () => {
    const keys = [generateFakeClientKey(), generateFakeClientKey()];
    const authority = makeAuthority(async req => req.capabilities);
    for (const key of keys) {
      // oxlint-disable-next-line no-await-in-loop
      await authority.requestApproval(request(key.publicKey));
    }
    assert.isTrue(await authority.revoke(keys[0]?.publicKey ?? ''));
    assert.isFalse(await authority.revoke(keys[0]?.publicKey ?? ''));
    assert.isUndefined(await authority.findGrant(keys[0]?.publicKey ?? ''));
    assert.isDefined(await authority.findGrant(keys[1]?.publicKey ?? ''));
  });
});
