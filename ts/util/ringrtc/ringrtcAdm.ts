// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as RemoteConfig from '../../RemoteConfig';
import { isProduction } from '../version';

export function getUseRingrtcAdm(): boolean {
  const localUseRingrtcAdm = window.storage.get('useRingrtcAdm');
  if (localUseRingrtcAdm !== undefined) {
    return localUseRingrtcAdm;
  }

  if (!RemoteConfig.isEnabled('desktop.internalUser')) {
    if (isProduction(window.getVersion())) {
      return RemoteConfig.isEnabled('desktop.calling.ringrtcAdmFull.2');
    }
    return RemoteConfig.isEnabled('desktop.calling.ringrtcAdmPreStable');
  }

  return RemoteConfig.isEnabled('desktop.calling.ringrtcAdmInternal');
}

export async function setUseRingrtcAdm(value: boolean): Promise<void> {
  await window.storage.put('useRingrtcAdm', value);
}

export async function removeUseRingrtcAdm(): Promise<void> {
  await window.storage.remove('useRingrtcAdm');
}
