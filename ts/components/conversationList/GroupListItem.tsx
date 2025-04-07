// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { ConversationType } from '../../state/ducks/conversations';
import type { LocalizerType } from '../../types/Util';
import type { AciString } from '../../types/ServiceId';
import { Avatar, AvatarSize } from '../Avatar';
import { ListTile } from '../ListTile';
import { UserText } from '../UserText';

export enum DisabledReason {
  AlreadyMember = 'already-member',
  Pending = 'pending',
}

export type GroupListItemConversationType = Pick<
  ConversationType,
  | 'avatarPlaceholderGradient'
  | 'id'
  | 'title'
  | 'avatarUrl'
  | 'hasAvatar'
  | 'color'
> & {
  disabledReason: DisabledReason | undefined;
  membersCount: number;
  memberships: ReadonlyArray<{
    aci: AciString;
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
      messageText = i18n('icu:GroupListItem__message-already-member');
      break;
    case DisabledReason.Pending:
      messageText = i18n('icu:GroupListItem__message-pending');
      break;
    default:
      messageText = i18n('icu:GroupListItem__message-default', {
        count: group.membersCount,
      });
  }

  return (
    <ListTile
      leading={
        <Avatar
          avatarPlaceholderGradient={group.avatarPlaceholderGradient}
          avatarUrl={group.avatarUrl}
          color={group.color}
          conversationType="group"
          hasAvatar={group.hasAvatar}
          i18n={i18n}
          title={group.title}
          sharedGroupNames={[]}
          size={AvatarSize.THIRTY_TWO}
          badge={undefined}
        />
      }
      title={<UserText text={group.title} />}
      subtitle={<UserText text={messageText} />}
      onClick={() => {
        if (!group.disabledReason) {
          onSelectGroup(group.id);
        }
      }}
    />
  );
}
