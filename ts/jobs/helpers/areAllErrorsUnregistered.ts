// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../../model-types.d';
import {
  SendMessageProtoError,
  UnregisteredUserError,
} from '../../textsecure/Errors';
import { isGroup } from '../../util/whatTypeOfConversation';

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
