// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { _refreshRemoteConfig } from '../../RemoteConfig';
import type {
  WebAPIType,
  RemoteConfigResponseType,
} from '../../textsecure/WebAPI';

export async function updateRemoteConfig(
  newConfig: RemoteConfigResponseType['config']
): Promise<void> {
  const fakeServer = {
    async getConfig() {
      return { config: newConfig, serverTimestamp: Date.now() };
    },
  } as Partial<WebAPIType> as unknown as WebAPIType;

  await _refreshRemoteConfig(fakeServer);
}
