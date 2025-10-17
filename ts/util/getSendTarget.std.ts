// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../model-types.d.ts';
import type { ServiceIdString } from '../types/ServiceId.std.js';

export function getSendTarget({
  serviceId,
  pni,
}: Pick<ConversationAttributesType, 'serviceId' | 'pni'>):
  | ServiceIdString
  | undefined {
  return serviceId || pni;
}
