// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { MessageType } from './Interface';
import { deserializeDatabaseSendStates } from '../messages/MessageSendState';

export type MessageRowWithJoinedSends = Readonly<{
  json: string;
  sendConversationIdsJoined?: string;
  sendStatusesJoined?: string;
  sendUpdatedAtsJoined?: string;
}>;

export function rowToMessage(
  row: Readonly<MessageRowWithJoinedSends>
): MessageType {
  const result = JSON.parse(row.json);
  // There should only be sends for outgoing messages, so this check should be redundant,
  //   but is here as a safety measure.
  if (result.type === 'outgoing') {
    result.sendStateByConversationId = deserializeDatabaseSendStates(row);
  }
  return result;
}
