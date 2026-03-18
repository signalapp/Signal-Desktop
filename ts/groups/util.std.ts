// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { SignalService as Proto } from '../protobuf/index.std.js';

import AccessRequired = Proto.AccessControl.AccessRequired;

// TODO(DESKTOP-9868)
export function isAccessControlEnabled(
  accessControl?: Proto.AccessControl.Params['attributes']
): accessControl is AccessRequired.ANY | AccessRequired.ADMINISTRATOR {
  return (
    accessControl === AccessRequired.ANY ||
    accessControl === AccessRequired.ADMINISTRATOR
  );
}
