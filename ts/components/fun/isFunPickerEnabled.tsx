// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import * as RemoteConfig from '../../RemoteConfig';
import { isBeta, isProduction } from '../../util/version';

export function isFunPickerEnabled(): boolean {
  const version = window.getVersion?.();

  if (version != null) {
    if (isProduction(version)) {
      return RemoteConfig.isEnabled('desktop.funPicker.prod');
    }

    if (isBeta(version)) {
      return RemoteConfig.isEnabled('desktop.funPicker.beta');
    }
  }

  return RemoteConfig.isEnabled('desktop.funPicker');
}
