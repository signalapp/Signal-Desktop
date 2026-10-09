// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod';

import { explodePromise } from '../util/explodePromise.std.ts';
import { safeParseUnknown } from '../util/schemas.std.ts';
import type { ServerKeyType } from './auth.node.ts';
import { generateServerKey, getKeyFingerprint } from './auth.node.ts';
import type {
  ApprovalRequestType,
  ApprovalResultType,
  ExternalClientAuthorityType,
  GrantType,
} from './hostTypes.std.ts';
import type { CapabilityType } from './protocol.std.ts';
import { ALL_CAPABILITIES, keySchema } from './protocol.std.ts';

// Owns client grants and the server key. Persistence and the approval prompt
// are injected: in the app they are the encrypted database and a dialog
// owned by Signal's main process.

export type GrantStorageType = Readonly<{
  readGrants: () => Promise<unknown>;
  writeGrants: (grants: ReadonlyArray<GrantType>) => Promise<void>;
  readServerKey: () => Promise<unknown>;
  writeServerKey: (key: ServerKeyType) => Promise<void>;
}>;

// Resolves to the capabilities the user allowed, or undefined if denied.
export type ApprovalPromptType = (
  request: ApprovalRequestType
) => Promise<ReadonlyArray<CapabilityType> | undefined>;

export const DENIAL_COOLDOWN_MS = 60_000;
const MAX_GRANTS = 32;

const grantSchema = z.object({
  publicKey: keySchema,
  fingerprint: z.string(),
  displayName: z.string(),
  capabilities: z.array(
    z.enum(ALL_CAPABILITIES as [CapabilityType, ...Array<CapabilityType>])
  ),
  approvedAt: z.number(),
  lastSeenAt: z.number().nullable(),
});
const grantsSchema = z.array(grantSchema);

const serverKeySchema = z.object({
  privateKey: z.string().min(1),
  publicKey: keySchema,
});

export class ExternalClientAuthority implements ExternalClientAuthorityType {
  readonly #storage: GrantStorageType;
  readonly #prompt: ApprovalPromptType;
  readonly #now: () => number;
  readonly #deniedAt = new Map<string, number>();
  #promptInFlight = false;
  #serverKey: ServerKeyType | undefined;
  #writeQueue: Promise<void> = Promise.resolve();

  constructor({
    storage,
    prompt,
    now = Date.now,
  }: {
    storage: GrantStorageType;
    prompt: ApprovalPromptType;
    now?: () => number;
  }) {
    this.#storage = storage;
    this.#prompt = prompt;
    this.#now = now;
  }

  async getServerKey(): Promise<ServerKeyType> {
    if (this.#serverKey) {
      return this.#serverKey;
    }
    const stored = safeParseUnknown(
      serverKeySchema,
      await this.#storage.readServerKey()
    );
    if (stored.success) {
      this.#serverKey = stored.data;
      return stored.data;
    }
    const created = generateServerKey();
    await this.#storage.writeServerKey(created);
    this.#serverKey = created;
    return created;
  }

  async listGrants(): Promise<ReadonlyArray<GrantType>> {
    const stored: unknown = (await this.#storage.readGrants()) ?? [];
    const parsed = safeParseUnknown(grantsSchema, stored);
    // A corrupt list grants nothing.
    return parsed.success ? parsed.data : [];
  }

  async findGrant(publicKey: string): Promise<GrantType | undefined> {
    return (await this.listGrants()).find(
      grant => grant.publicKey === publicKey
    );
  }

  async requestApproval(
    request: ApprovalRequestType
  ): Promise<ApprovalResultType> {
    const deniedAt = this.#deniedAt.get(request.publicKey);
    if (deniedAt !== undefined && this.#now() - deniedAt < DENIAL_COOLDOWN_MS) {
      return { approved: false, reason: 'cooldown' };
    }
    // One prompt at a time, so a client cannot stack dialogs.
    if (this.#promptInFlight) {
      return { approved: false, reason: 'busy' };
    }

    this.#promptInFlight = true;
    let allowed: ReadonlyArray<CapabilityType> | undefined;
    try {
      allowed = await this.#prompt({
        ...request,
        fingerprint: getKeyFingerprint(request.publicKey),
      });
    } finally {
      this.#promptInFlight = false;
    }

    // The prompt may only narrow what was asked for, never widen it.
    const capabilities = allowed?.filter(cap =>
      request.capabilities.includes(cap)
    );
    if (!capabilities || capabilities.length === 0) {
      this.#deniedAt.set(request.publicKey, this.#now());
      return { approved: false, reason: 'denied' };
    }
    this.#deniedAt.delete(request.publicKey);

    const grant = await this.#update(grants => {
      const existing = grants.find(g => g.publicKey === request.publicKey);
      const merged: GrantType = {
        publicKey: request.publicKey,
        fingerprint: getKeyFingerprint(request.publicKey),
        displayName: request.displayName,
        capabilities: [
          ...new Set([...(existing?.capabilities ?? []), ...capabilities]),
        ],
        approvedAt: this.#now(),
        lastSeenAt: existing?.lastSeenAt ?? null,
      };
      const others = grants.filter(g => g.publicKey !== request.publicKey);
      return { grants: [...others, merged].slice(-MAX_GRANTS), value: merged };
    });
    return { approved: true, grant };
  }

  async markSeen(publicKey: string): Promise<void> {
    await this.#update(grants => ({
      grants: grants.map(grant =>
        grant.publicKey === publicKey
          ? { ...grant, lastSeenAt: this.#now() }
          : grant
      ),
      value: undefined,
    }));
  }

  // Returns true if a grant was removed. Callers must also close live
  // sessions for the key (ExternalClientServer.revoke).
  async revoke(publicKey: string): Promise<boolean> {
    return this.#update(grants => {
      const remaining = grants.filter(grant => grant.publicKey !== publicKey);
      return { grants: remaining, value: remaining.length !== grants.length };
    });
  }

  // Serializes read-modify-write cycles so concurrent sessions cannot lose
  // each other's updates.
  async #update<T>(
    change: (grants: ReadonlyArray<GrantType>) => {
      grants: ReadonlyArray<GrantType>;
      value: T;
    }
  ): Promise<T> {
    const previous = this.#writeQueue;
    const { promise: done, resolve } = explodePromise<void>();
    this.#writeQueue = done;
    try {
      await previous;
      const { grants, value } = change(await this.listGrants());
      await this.#storage.writeGrants(grants);
      return value;
    } finally {
      resolve();
    }
  }
}
