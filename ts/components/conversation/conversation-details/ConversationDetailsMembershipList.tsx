// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import type { LocalizerType, ThemeType } from '../../../types/Util';

import { Avatar } from '../../Avatar';
import { Emojify } from '../Emojify';

import { ConversationDetailsIcon, IconType } from './ConversationDetailsIcon';
import type { ConversationType } from '../../../state/ducks/conversations';
import type { PreferredBadgeSelectorType } from '../../../state/selectors/badges';
import { PanelRow } from './PanelRow';
import { PanelSection } from './PanelSection';

export type GroupV2Membership = {
  isAdmin: boolean;
  member: ConversationType;
};

export type Props = {
  canAddNewMembers: boolean;
  conversationId: string;
  getPreferredBadge: PreferredBadgeSelectorType;
  i18n: LocalizerType;
  maxShownMemberCount?: number;
  memberships: Array<GroupV2Membership>;
  showContactModal: (contactId: string, conversationId?: string) => void;
  startAddingNewMembers?: () => void;
  theme: ThemeType;
};

const collator = new Intl.Collator(undefined, { sensitivity: 'base' });
function sortConversationTitles(
  left: GroupV2Membership,
  right: GroupV2Membership
) {
  const leftTitle = left.member.title;
  const rightTitle = right.member.title;
  return collator.compare(leftTitle, rightTitle);
}

function sortMemberships(
  memberships: ReadonlyArray<GroupV2Membership>
): Array<GroupV2Membership> {
  let you: undefined | GroupV2Membership;
  const admins: Array<GroupV2Membership> = [];
  const nonAdmins: Array<GroupV2Membership> = [];
  memberships.forEach(membershipInfo => {
    const { isAdmin, member } = membershipInfo;
    if (member.isMe) {
      you = membershipInfo;
    } else if (isAdmin) {
      admins.push(membershipInfo);
    } else {
      nonAdmins.push(membershipInfo);
    }
  });
  admins.sort(sortConversationTitles);
  nonAdmins.sort(sortConversationTitles);

  const sortedMemberships = [];
  if (you) {
    sortedMemberships.push(you);
  }
  sortedMemberships.push(...admins);
  sortedMemberships.push(...nonAdmins);

  return sortedMemberships;
}

export const ConversationDetailsMembershipList: React.ComponentType<Props> = ({
  canAddNewMembers,
  conversationId,
  getPreferredBadge,
  i18n,
  maxShownMemberCount = 5,
  memberships,
  showContactModal,
  startAddingNewMembers,
  theme,
}) => {
  const [showAllMembers, setShowAllMembers] = React.useState<boolean>(false);
  const sortedMemberships = sortMemberships(memberships);

  const shouldHideRestMembers =
    sortedMemberships.length - maxShownMemberCount > 1;
  const membersToShow =
    shouldHideRestMembers && !showAllMembers
      ? maxShownMemberCount
      : sortedMemberships.length;

  return (
    <PanelSection
      title={i18n('ConversationDetailsMembershipList--title', [
        sortedMemberships.length.toString(),
      ])}
    >
      {canAddNewMembers && (
        <PanelRow
          icon={
            <div className="ConversationDetails-membership-list__add-members-icon" />
          }
          label={i18n('ConversationDetailsMembershipList--add-members')}
          onClick={() => startAddingNewMembers?.()}
        />
      )}
      {sortedMemberships.slice(0, membersToShow).map(({ isAdmin, member }) => (
        <PanelRow
          key={member.id}
          onClick={() => showContactModal(member.id, conversationId)}
          icon={
            <Avatar
              conversationType="direct"
              badge={getPreferredBadge(member.badges)}
              i18n={i18n}
              size={32}
              theme={theme}
              {...member}
            />
          }
          label={<Emojify text={member.isMe ? i18n('you') : member.title} />}
          right={isAdmin ? i18n('GroupV2--admin') : ''}
        />
      ))}
      {showAllMembers === false && shouldHideRestMembers && (
        <PanelRow
          className="ConversationDetails-membership-list--show-all"
          icon={
            <ConversationDetailsIcon
              ariaLabel={i18n('ConversationDetailsMembershipList--show-all')}
              icon={IconType.down}
            />
          }
          onClick={() => setShowAllMembers(true)}
          label={i18n('ConversationDetailsMembershipList--show-all')}
        />
      )}
    </PanelSection>
  );
};
