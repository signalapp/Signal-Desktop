// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ProtocolAddress } from '@signalapp/libsignal-client';
import assert from 'assert';
import isPlainObject from 'is-plain-obj';
import crypto from 'node:crypto';
import util from 'node:util';
import type { JsonValue } from 'type-fest';

import { DAY_IN_SECONDS } from './constants';
import { type RegistrationId, ServiceIdKind } from './types';
import { Device } from './data/device';

export function unreachable(input: never): never {
  throw new TypeError(`Expected case to be unreachable, found ${input}`);
}

export function isValidAccessKey(
  accessKey: Uint8Array | null,
  target: Device,
): boolean {
  if (accessKey == null) {
    return false;
  }

  if (target.accessKey == null) {
    return false;
  }

  // timingSafeEqual throws when the lengths differ
  if (accessKey.length !== target.accessKey.length) {
    return false;
  }

  return crypto.timingSafeEqual(accessKey, target.accessKey);
}

type PromiseQueueEntry<T> = Readonly<{
  value: T;
  cancel: () => void;
  resolvePush?: () => void;
}>;
type ResolveEntry<T> = { resolve: (value: T) => void; cancel: () => void };

export type PromiseQueueConfig = Readonly<{
  timeout?: number;
  name: string;
}>;

export function generateRandomE164(): string {
  // Generate random number
  let number = '+141549';
  for (let i = 0; i < 5; i++) {
    number += Math.floor(Math.random() * 10).toString();
  }
  return number;
}

export type ParseAuthHeaderResult =
  | {
      username: string;
      password: string;
      error?: undefined;
    }
  | {
      username?: undefined;
      password?: undefined;
      error: string;
    };

function splitOnce(input: string, splitter: string): [string, string] | null {
  const index = input.indexOf(splitter);
  if (index === -1) {
    return null;
  }
  return [input.slice(0, index), input.slice(index + 1)];
}

export function parseAuthHeader(
  header?: string,
  options?: { allowEmptyPassword?: boolean },
): ParseAuthHeaderResult {
  if (!header) {
    return { error: 'Missing Authorization header' };
  }

  const [basic, base64] = header.split(/\s+/g, 2);
  if (basic?.toLowerCase() !== 'basic') {
    return { error: `Unsupported authorization type ${basic}` };
  }

  let decoded: string;
  try {
    assert(base64 != null, 'Missing base64 for basic authorization');
    decoded = Buffer.from(base64, 'base64').toString();
  } catch (error) {
    assert(error instanceof Error);
    return { error: error.message };
  }

  const parts = splitOnce(decoded, ':');
  if (parts == null) {
    return { error: 'Invalid basic auth' };
  }
  const [username, password] = parts;

  if (!username) {
    return { error: 'Missing username' };
  }

  if (!password && !options?.allowEmptyPassword) {
    return { error: 'Missing password' };
  }

  return { username, password };
}

export class PromiseQueue<T> {
  private readonly defaultTimeout: number | undefined;
  private readonly entries: Array<PromiseQueueEntry<T>> = [];
  private readonly resolvers: Array<ResolveEntry<T>> = [];
  private readonly name;

  constructor(config: PromiseQueueConfig) {
    this.defaultTimeout = config.timeout;
    this.name = config.name;
  }

  public get size(): number {
    return this.entries.length;
  }

  public stop(): void {
    while (this.entries.length > 0) {
      const entry = this.entries[0];
      if (entry) {
        entry.cancel();
        this.entries.shift();
      } else {
        break;
      }
    }

    while (this.resolvers.length > 0) {
      const entry = this.resolvers.shift();
      if (entry) {
        entry.cancel();
      } else {
        break;
      }
    }
  }

  public pushAndWait(
    value: T,
    timeout: number | undefined = this.defaultTimeout,
  ): { promise: Promise<void>; cancel: () => void } {
    // We were waiting for `.shift()` already
    const resolveEntry = this.resolvers.shift();
    if (resolveEntry) {
      resolveEntry.resolve(value);
      return { promise: Promise.resolve(), cancel: () => undefined };
    }

    // Not waiting for `.shift()` - queue.
    const { promise, resolve, reject } = Promise.withResolvers<void>();
    let timer: NodeJS.Timeout | undefined;

    const cancel = () => {
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }

      const index = this.entries.indexOf(entry);
      if (index === -1) {
        return;
      }
      this.entries.splice(index, 1);

      reject(new Error(`PromiseQueue(${this.name}) pushAndWait timeout`));
    };

    if (timeout !== undefined) {
      timer = setTimeout(cancel, timeout);
    }

    const entry = {
      value,
      cancel,
      resolvePush() {
        if (timer !== undefined) {
          clearTimeout(timer);
        }
        timer = undefined;

        resolve();
      },
    };

    this.entries.push(entry);

    return { promise, cancel };
  }

  public push(value: T): void {
    // We were waiting for `.shift()` already
    const resolveEntry = this.resolvers.shift();
    if (resolveEntry) {
      resolveEntry.resolve(value);
      return;
    }

    this.entries.push({ value, cancel: () => undefined });
  }

  public async shift(
    timeout: number | undefined = this.defaultTimeout,
  ): Promise<T> {
    // `.pushAndWait()` was called before us
    const entry = this.entries.shift();
    if (entry) {
      if (entry.resolvePush) {
        entry.resolvePush();
      }
      return entry.value;
    }

    return new Promise((resolve, reject) => {
      let timer: NodeJS.Timeout | undefined;

      const resolveEntry = (value: T) => {
        if (timer !== undefined) {
          clearTimeout(timer);
        }
        timer = undefined;

        resolve(value);
      };

      const cancel = () => {
        const index = this.resolvers.indexOf(entry);
        if (index === -1) {
          throw new Error(
            `PromiseQueue(${this.name}) resolvers bookkeeping error`,
          );
        }
        this.resolvers.splice(index, 1);

        reject(new Error(`PromiseQueue(${this.name}) shift timeout`));
      };

      if (timeout !== undefined) {
        timer = setTimeout(cancel, timeout);
      }

      const entry = {
        cancel,
        resolve: resolveEntry,
      };

      this.resolvers.push(entry);
    });
  }
}

export function addressToString(address: ProtocolAddress): string {
  return `${address.name()}.${address.deviceId()}`;
}

export function getTodayInSeconds(): number {
  const now = Date.now() / 1000;

  return now - (now % DAY_IN_SECONDS);
}

export function daysToSeconds(days: number): number {
  return days * DAY_IN_SECONDS;
}

export function generateRegistrationId(): RegistrationId {
  return Math.max(1, (Math.random() * 0x4000) | 0) as RegistrationId;
}

export function generateDevicePassword(): string {
  return crypto.randomBytes(10).toString('hex');
}

export function toBase64(buf: Uint8Array<ArrayBuffer>): string {
  return Buffer.from(buf).toString('base64');
}

export function toURLSafeBase64(buf: Uint8Array<ArrayBuffer>): string {
  return toBase64(buf)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

export function fromBase64(base64: string): Buffer<ArrayBuffer> {
  return Buffer.from(base64, 'base64');
}

export function fromOptionalBase64(
  base64: string | null | undefined,
): Buffer<ArrayBuffer> | undefined {
  return base64 ? fromBase64(base64) : undefined;
}

export function fromURLSafeBase64(base64: string): Buffer<ArrayBuffer> {
  const source = base64.replace(/-/g, '+').replace(/_/g, '/');

  // Note that `Buffer.from()` ignores padding anyway so we don't need to
  // restore it.
  return fromBase64(source);
}

export function assertJsonValue(root: unknown): asserts root is JsonValue {
  const issues: Array<string> = [];

  function visit(node: unknown, path: ReadonlyArray<PropertyKey>) {
    if (
      node === null ||
      typeof node === 'boolean' ||
      (typeof node === 'number' && Number.isFinite(node)) ||
      typeof node === 'string'
    ) {
      return;
    } else if (Array.isArray(node)) {
      node.forEach((item, index) => {
        visit(item, path.concat(index));
      });
      return;
    } else if (isPlainObject(node)) {
      Object.entries(node).forEach(([key, item]) => {
        // ignore undefined properties
        if (typeof item !== 'undefined') {
          visit(item, path.concat(key));
        }
      });
    } else {
      issues.push(`${path.join('.')}: ${util.inspect(node)}`);
    }
  }

  visit(root, ['value']);

  if (issues.length > 0) {
    throw new TypeError(`Invalid JsonValue:\n${issues.join('\n')}`);
  }
}

export function booleanFromQuery(
  value: string | ReadonlyArray<string> | undefined,
  defaultValue: boolean,
): boolean {
  const single = typeof value === 'string' ? value : value?.[0];
  if (single === undefined) {
    return defaultValue;
  }

  return single.toLowerCase() === 'true';
}

export async function getDevicesKeysResult(
  serviceIdKind: ServiceIdKind,
  devices: ReadonlyArray<Device>,
): Promise<JsonValue> {
  const [primary] = devices;
  assert(primary !== undefined, 'Empty device list');

  const identityKey = await primary.getIdentityKey(serviceIdKind);

  return {
    identityKey: Buffer.from(identityKey.serialize()).toString('base64'),
    devices: await Promise.all(
      devices.map(async (device) => {
        const { signedPreKey, preKey, pqPreKey } =
          await device.popSingleUseKey(serviceIdKind);
        return {
          deviceId: device.deviceId,
          registrationId: device.getCheckedRegistrationId(serviceIdKind),
          signedPreKey: {
            keyId: signedPreKey.keyId,
            publicKey: Buffer.from(signedPreKey.publicKey.serialize()).toString(
              'base64',
            ),
            signature: signedPreKey.signature.toString('base64'),
          },
          pqPreKey: {
            keyId: pqPreKey.keyId,
            publicKey: Buffer.from(pqPreKey.publicKey.serialize()).toString(
              'base64',
            ),
            signature: pqPreKey.signature.toString('base64'),
          },
          preKey: preKey
            ? {
                keyId: preKey.keyId,
                publicKey: Buffer.from(preKey.publicKey.serialize()).toString(
                  'base64',
                ),
              }
            : null,
        };
      }),
    ),
  };
}
