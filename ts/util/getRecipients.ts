// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { compact, uniq } from 'lodash';

import type { ConversationAttributesType } from '../model-types.d';

import { getConversationMembers } from './getConversationMembers';
import { getSendTarget } from './getSendTarget';
import { isDirectConversation, isMe } from './whatTypeOfConversation';
import { isNotNil } from './isNotNil';

export function getRecipients(
  conversationAttributes: ConversationAttributesType,
  {
    includePendingMembers,
    extraConversationsForSend,
  }: {
    includePendingMembers?: boolean;
    extraConversationsForSend?: Array<string>;
  } = {}
): Array<string> {
  if (isDirectConversation(conversationAttributes)) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return [getSendTarget(conversationAttributes)!];
  }

  const members = getConversationMembers(conversationAttributes, {
    includePendingMembers,
  });

  // There are cases where we need to send to someone we just removed from the group, to
  //   let them know that we removed them. In that case, we need to send to more than
  //   are currently in the group.
  const extraConversations = extraConversationsForSend
    ? extraConversationsForSend
        .map(id => window.ConversationController.get(id)?.attributes)
        .filter(isNotNil)
    : [];

  const uniqueMembers = extraConversations.length
    ? uniq([...members, ...extraConversations])
    : members;

  // Eliminate ourself
  return compact(
    uniqueMembers.map(memberAttrs =>
      isMe(memberAttrs) ? null : getSendTarget(memberAttrs)
    )
  );
}
