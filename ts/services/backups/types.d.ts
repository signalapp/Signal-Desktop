// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AciString, PniString } from '../../types/ServiceId';

export type AboutMe = {
  aci: AciString;
  pni?: PniString;
};
