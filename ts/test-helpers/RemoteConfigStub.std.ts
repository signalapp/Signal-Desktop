// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { _refreshRemoteConfig } from '../RemoteConfig.std.ts';
import type { RemoteConfigResponseType } from '../textsecure/WebAPI.preload.ts';
import { shouldNeverBeCalled } from '../util/shouldNeverBeCalled.std.ts';

export async function updateRemoteConfig(
  newConfig: Array<{ name: string; value: string }>
): Promise<void> {
  async function getConfig(): Promise<RemoteConfigResponseType> {
    const serverTimestamp = Date.now();
    return {
      config: new Map(newConfig.map(({ name, value }) => [name, value])),
      serverTimestamp,
      configHash: serverTimestamp.toString(),
    };
  }

  const storageMap = new Map<string, unknown>();
  const storage = {
    get: (key: string): unknown => storageMap.get(key),
    put: async (key: string, value: unknown): Promise<void> => {
      storageMap.set(key, value);
    },
    remove: async (key: string): Promise<void> => {
      storageMap.delete(key);
    },
  };

  await _refreshRemoteConfig({
    ourVersion: 'v1.0.0',
    getConfig,
    storage,
    showToast: shouldNeverBeCalled,
  });
}
