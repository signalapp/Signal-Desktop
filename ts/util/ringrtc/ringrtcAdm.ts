// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as RemoteConfig from '../../RemoteConfig';
import OS from '../os/osMain';
import { isProduction } from '../version';

export function getUseRingrtcAdm(): boolean {
  const localUseRingrtcAdm = window.storage.get('useRingrtcAdm');
  if (localUseRingrtcAdm !== undefined) {
    return localUseRingrtcAdm;
  }

  if (
    isProduction(window.getVersion()) ||
    OS.isLinux() ||
    !RemoteConfig.isEnabled('desktop.internalUser')
  ) {
    return false;
  }

  return RemoteConfig.isEnabled('desktop.calling.ringrtcAdm');
}

export async function setUseRingrtcAdm(value: boolean): Promise<void> {
  await window.storage.put('useRingrtcAdm', value);
}

export async function removeUseRingrtcAdm(): Promise<void> {
  await window.storage.remove('useRingrtcAdm');
}
