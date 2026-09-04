// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useState, type JSX } from 'react';
import type {
  ConversationType,
  ShowConversationType,
} from '../../../state/ducks/conversations.preload.ts';
import type { LocalizerType } from '../../../types/Util.std.ts';
import { Avatar, AvatarSize } from '../../Avatar.dom.tsx';
import { AxoContactList } from '../../../axo/items/AxoContactList.dom.tsx';

type Props = {
  contactId: string;
  i18n: LocalizerType;
  groupsInCommon: ReadonlyArray<ConversationType>;
  toggleAddUserToAnotherGroupModal: (contactId?: string) => void;
  showConversation: ShowConversationType;
};

export function ConversationDetailsGroups({
  contactId,
  i18n,
  groupsInCommon,
  toggleAddUserToAnotherGroupModal,
  showConversation,
}: Props): JSX.Element {
  const [showAllGroups, setShowAllGroups] = useState(false);

  const maxShownGroupCount = 5;
  const isMoreThanMaxShown = groupsInCommon.length - maxShownGroupCount > 1;
  const groupsToShow = showAllGroups
    ? groupsInCommon.length
    : maxShownGroupCount;

  return (
    <AxoContactList.Root
      title={
        groupsInCommon.length > 0
          ? i18n('icu:ConversationDetailsGroups--title', {
              count: groupsInCommon.length,
            })
          : i18n(
              'icu:ConversationDetailsGroups--title--with-zero-groups-in-common'
            )
      }
    >
      <AxoContactList.ActionItem
        symbol="plus"
        title={i18n('icu:ConversationDetailsGroups--add-to-group')}
        onClick={() => toggleAddUserToAnotherGroupModal(contactId)}
      />
      {groupsInCommon.slice(0, groupsToShow).map(group => (
        <AxoContactList.Item
          key={group.id}
          onClick={() =>
            showConversation({
              conversationId: group.id,
              switchToAssociatedView: true,
            })
          }
          avatar={
            <Avatar
              conversationType="group"
              badge={undefined}
              i18n={i18n}
              size={AvatarSize.THIRTY_TWO}
              {...group}
            />
          }
          title={group.title}
        />
      ))}
      {!showAllGroups && isMoreThanMaxShown && (
        <AxoContactList.ActionItem
          symbol="chevron-down"
          title={i18n('icu:ConversationDetailsGroups--show-all')}
          onClick={() => setShowAllGroups(true)}
        />
      )}
    </AxoContactList.Root>
  );
}
