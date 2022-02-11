// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { refreshRemoteConfig } from '../../RemoteConfig';
import type { WebAPIType } from '../../textsecure/WebAPI';
import type { UnwrapPromise } from '../../types/Util';

export async function updateRemoteConfig(
  newConfig: UnwrapPromise<ReturnType<WebAPIType['getConfig']>>
): Promise<void> {
  const fakeServer = {
    async getConfig() {
      return newConfig;
    },
  } as Partial<WebAPIType> as unknown as WebAPIType;

  await refreshRemoteConfig(fakeServer);
}
