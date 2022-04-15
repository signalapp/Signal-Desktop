// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ContactNameColorType } from './Colors';
import type { ConversationType } from '../state/ducks/conversations';

export type ReplyType = Pick<
  ConversationType,
  | 'acceptedMessageRequest'
  | 'avatarPath'
  | 'color'
  | 'isMe'
  | 'name'
  | 'profileName'
  | 'sharedGroupNames'
  | 'title'
> & {
  body?: string;
  contactNameColor?: ContactNameColorType;
  deletedForEveryone?: boolean;
  id: string;
  reactionEmoji?: string;
  timestamp: number;
};

export type ReplyStateType = {
  messageId: string;
  replies: Array<ReplyType>;
};
