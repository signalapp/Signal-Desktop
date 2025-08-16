// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import * as RemoteConfig from '../../RemoteConfig';

export function isFunPickerEnabled(): boolean {
  return RemoteConfig.isEnabled('desktop.funPicker');
}
