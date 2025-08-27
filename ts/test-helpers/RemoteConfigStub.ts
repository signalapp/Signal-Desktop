// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { _refreshRemoteConfig } from '../RemoteConfig';
import type {
  WebAPIType,
  RemoteConfigResponseType,
} from '../textsecure/WebAPI';

export async function updateRemoteConfig(
  newConfig: Array<{ name: string; value: string }>
): Promise<void> {
  const fakeServer = {
    async getConfig(): Promise<RemoteConfigResponseType> {
      const serverTimestamp = Date.now();
      return {
        config: new Map(newConfig.map(({ name, value }) => [name, value])),
        serverTimestamp,
        configHash: serverTimestamp.toString(),
      };
    },
  } as Partial<WebAPIType> as unknown as WebAPIType;

  await _refreshRemoteConfig(fakeServer);
}
