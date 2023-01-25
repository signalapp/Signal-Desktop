// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { ConversationType } from '../../state/ducks/conversations';
import type { LocalizerType } from '../../types/Util';
import type { UUIDStringType } from '../../types/UUID';
import { Avatar, AvatarSize } from '../Avatar';
import { Emojify } from '../conversation/Emojify';
import { ListTile } from '../ListTile';

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
    <ListTile
      leading={
        <Avatar
          acceptedMessageRequest
          avatarPath={group.avatarPath}
          conversationType="group"
          i18n={i18n}
          isMe={false}
          title={group.title}
          sharedGroupNames={[]}
          size={AvatarSize.THIRTY_TWO}
          badge={undefined}
        />
      }
      title={<Emojify text={group.title} />}
      subtitle={<Emojify text={messageText} />}
      onClick={() => onSelectGroup(group.id)}
    />
  );
}
