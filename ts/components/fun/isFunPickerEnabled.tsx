// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import * as RemoteConfig from '../../RemoteConfig.js';

export function isFunPickerEnabled(): boolean {
  return RemoteConfig.isEnabled('desktop.funPicker');
}
