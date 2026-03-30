// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../../model-types.d.ts';
import {
  SendMessageProtoError,
  UnregisteredUserError,
} from '../../textsecure/Errors.std.ts';
import { isGroup } from '../../util/whatTypeOfConversation.dom.ts';

export function areAllErrorsUnregistered(
  conversation: ConversationAttributesType,
  error: unknown
): error is SendMessageProtoError {
  return Boolean(
    isGroup(conversation) &&
    error instanceof SendMessageProtoError &&
    error.errors?.every(item => item instanceof UnregisteredUserError)
  );
}
