// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { ConversationType } from '../../state/ducks/conversations';
import type { LocalizerType } from '../../types/Util';
import type { UUIDStringType } from '../../types/UUID';
import { AvatarSize } from '../Avatar';
import { BaseConversationListItem } from './BaseConversationListItem';

export enum DisabledReason {
  AlreadyMember = 'already-member',
  Pending = 'pending',
}

export type GroupListItemConversationType = Pick<
  ConversationType,
  'id' | 'title' | 'avatarPath'
> & {
  disabledReason: DisabledReason | undefined;
  membersCount: number;
  memberships: ReadonlyArray<{
    uuid: UUIDStringType;
    isAdmin: boolean;
  }>;
};

export type Props = {
  i18n: LocalizerType;
  onSelectGroup: (id: string) => void;
  group: GroupListItemConversationType;
};

export function GroupListItem({
  group,
  i18n,
  onSelectGroup,
}: Props): JSX.Element {
  let messageText: string;
  switch (group.disabledReason) {
    case DisabledReason.AlreadyMember:
      messageText = i18n('GroupListItem__message-already-member');
      break;
    case DisabledReason.Pending:
      messageText = i18n('GroupListItem__message-pending');
      break;
    default:
      messageText = i18n('GroupListItem__message-default', {
        count: group.membersCount,
      });
  }
  return (
    <BaseConversationListItem
      disabled={group.disabledReason !== undefined}
      conversationType="group"
      title={group.title}
      avatarSize={AvatarSize.THIRTY_TWO}
      avatarPath={group.avatarPath}
      acceptedMessageRequest
      isMe={false}
      sharedGroupNames={[]}
      headerName={group.title}
      i18n={i18n}
      isSelected={false}
      onClick={() => onSelectGroup(group.id)}
      messageText={messageText}
    />
  );
}
