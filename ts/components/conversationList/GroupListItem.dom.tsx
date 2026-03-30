// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { ConversationType } from '../../state/ducks/conversations.preload.ts';
import type { LocalizerType } from '../../types/Util.std.ts';
import type { AciString } from '../../types/ServiceId.std.ts';
import { Avatar, AvatarSize } from '../Avatar.dom.tsx';
import { ListTile } from '../ListTile.dom.tsx';
import { UserText } from '../UserText.dom.tsx';

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
}: Props): React.JSX.Element {
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
