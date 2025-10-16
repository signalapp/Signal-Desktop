// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { SignalService as Proto } from '../protobuf/index.std.js';

const ACCESS_ENUM = Proto.AccessControl.AccessRequired;

export function isAccessControlEnabled(
  accessControl: number | undefined
): boolean {
  return (
    accessControl === ACCESS_ENUM.ANY ||
    accessControl === ACCESS_ENUM.ADMINISTRATOR
  );
}
