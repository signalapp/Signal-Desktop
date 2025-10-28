// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../model-types.d.ts';
import { SignalService as Proto } from '../protobuf/index.std.js';
import { areWeAdmin } from './areWeAdmin.preload.js';
import {
  isDirectConversation,
  isGroupV1,
  isGroupV2,
} from './whatTypeOfConversation.dom.js';

export function canChangeTimer(
  attributes: ConversationAttributesType
): boolean {
  if (isDirectConversation(attributes)) {
    return true;
  }

  if (isGroupV1(attributes)) {
    return false;
  }

  if (!isGroupV2(attributes)) {
    return true;
  }

  const accessControlEnum = Proto.AccessControl.AccessRequired;
  const { accessControl } = attributes;
  const canAnyoneChangeTimer =
    accessControl &&
    (accessControl.attributes === accessControlEnum.ANY ||
      accessControl.attributes === accessControlEnum.MEMBER);
  if (canAnyoneChangeTimer) {
    return true;
  }

  return areWeAdmin(attributes);
}
