// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../model-types.d';
import type { ServiceIdString } from '../types/ServiceId';

export function getSendTarget({
  uuid,
  pni,
}: Pick<ConversationAttributesType, 'uuid' | 'pni'>):
  | ServiceIdString
  | undefined {
  return uuid || pni;
}
