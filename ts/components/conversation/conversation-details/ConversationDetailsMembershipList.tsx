// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { LocalizerType } from '../../../types/Util';
import { Avatar } from '../../Avatar';

import { ConversationDetailsIcon } from './ConversationDetailsIcon';
import { ConversationType } from '../../../state/ducks/conversations';
import { GroupV2MemberType } from '../../../model-types.d';
import { PanelRow } from './PanelRow';
import { PanelSection } from './PanelSection';

export type GroupV2Membership = {
  isAdmin: boolean;
  metadata: GroupV2MemberType;
  member: ConversationType;
};

export type Props = {
  memberships: Array<GroupV2Membership>;
  showContactModal: (conversationId: string) => void;
  i18n: LocalizerType;
};

const MAX_MEMBER_COUNT = 5;

export const ConversationDetailsMembershipList: React.ComponentType<Props> = ({
  memberships,
  showContactModal,
  i18n,
}) => {
  const [showAllMembers, setShowAllMembers] = React.useState<boolean>(false);

  const shouldHideRestMembers = memberships.length - MAX_MEMBER_COUNT > 1;
  const membersToShow =
    shouldHideRestMembers && !showAllMembers
      ? MAX_MEMBER_COUNT
      : memberships.length;

  return (
    <PanelSection
      title={i18n('ConversationDetailsMembershipList--title', [
        memberships.length.toString(),
      ])}
    >
      {memberships.slice(0, membersToShow).map(({ isAdmin, member }) => (
        <PanelRow
          key={member.id}
          onClick={() => showContactModal(member.id)}
          icon={
            <Avatar
              conversationType="direct"
              i18n={i18n}
              size={32}
              {...member}
            />
          }
          label={member.title}
          right={isAdmin ? i18n('GroupV2--admin') : ''}
        />
      ))}
      {showAllMembers === false && shouldHideRestMembers && (
        <PanelRow
          className="module-conversation-details-membership-list--show-all"
          icon={
            <ConversationDetailsIcon
              ariaLabel={i18n('ConversationDetailsMembershipList--show-all')}
              icon="down"
            />
          }
          onClick={() => setShowAllMembers(true)}
          label={i18n('ConversationDetailsMembershipList--show-all')}
        />
      )}
    </PanelSection>
  );
};
