// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type {
  ConversationType,
  ShowConversationType,
} from '../../../state/ducks/conversations.preload.js';
import type { LocalizerType } from '../../../types/Util.std.js';
import { Avatar, AvatarSize } from '../../Avatar.dom.js';
import {
  ConversationDetailsIcon,
  IconType,
} from './ConversationDetailsIcon.dom.js';
import { PanelRow } from './PanelRow.dom.js';
import { PanelSection } from './PanelSection.dom.js';

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
  const [showAllGroups, setShowAllGroups] = React.useState(false);

  const maxShownGroupCount = 5;
  const isMoreThanMaxShown = groupsInCommon.length - maxShownGroupCount > 1;
  const groupsToShow = showAllGroups
    ? groupsInCommon.length
    : maxShownGroupCount;

  return (
    <PanelSection
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
      <PanelRow
        icon={<div className="ConversationDetails-groups__add-to-group-icon" />}
        label={i18n('icu:ConversationDetailsGroups--add-to-group')}
        onClick={() => toggleAddUserToAnotherGroupModal(contactId)}
      />
      {groupsInCommon.slice(0, groupsToShow).map(group => (
        <PanelRow
          key={group.id}
          onClick={() =>
            showConversation({
              conversationId: group.id,
              switchToAssociatedView: true,
            })
          }
          icon={
            <Avatar
              conversationType="group"
              badge={undefined}
              i18n={i18n}
              size={AvatarSize.THIRTY_TWO}
              {...group}
            />
          }
          label={group.title}
        />
      ))}
      {!showAllGroups && isMoreThanMaxShown && (
        <PanelRow
          icon={
            <ConversationDetailsIcon
              ariaLabel={i18n('icu:ConversationDetailsGroups--show-all')}
              icon={IconType.down}
            />
          }
          onClick={() => setShowAllGroups(true)}
          label={i18n('icu:ConversationDetailsGroups--show-all')}
        />
      )}
    </PanelSection>
  );
}
