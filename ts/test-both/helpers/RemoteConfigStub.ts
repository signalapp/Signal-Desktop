// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { refreshRemoteConfig } from '../../RemoteConfig';
import type {
  WebAPIType,
  RemoteConfigResponseType,
} from '../../textsecure/WebAPI';
import { SECOND } from '../../util/durations';

export async function updateRemoteConfig(
  newConfig: RemoteConfigResponseType['config']
): Promise<void> {
  const fakeServer = {
    async getConfig() {
      return { config: newConfig, serverEpochTime: Date.now() / SECOND };
    },
  } as Partial<WebAPIType> as unknown as WebAPIType;

  await refreshRemoteConfig(fakeServer);
}
