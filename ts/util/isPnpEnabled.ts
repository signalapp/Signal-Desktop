// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isStaging } from './version';

export function isPnpEnabled(version = window.getVersion()): boolean {
  return isStaging(version);
}
