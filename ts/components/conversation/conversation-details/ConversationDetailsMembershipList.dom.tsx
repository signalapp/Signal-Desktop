// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import type { LocalizerType, ThemeType } from '../../../types/Util.std.ts';

import { Avatar, AvatarSize } from '../../Avatar.dom.tsx';
import { Emojify } from '../Emojify.dom.tsx';

import {
  ConversationDetailsIcon,
  IconType,
} from './ConversationDetailsIcon.dom.tsx';
import type { ConversationType } from '../../../state/ducks/conversations.preload.ts';
import type { PreferredBadgeSelectorType } from '../../../state/selectors/badges.preload.ts';
import { PanelRow } from './PanelRow.dom.tsx';
import { PanelSection } from './PanelSection.dom.tsx';
import { GroupMemberLabel } from '../ContactName.dom.tsx';
import { AriaClickable } from '../../../axo/AriaClickable.dom.tsx';
import type { ContactModalStateType } from '../../../types/globalModals.std.ts';
import type { ContactNameColorType } from '../../../types/Colors.std.ts';

export type GroupV2Membership = {
  isAdmin: boolean;
  member: ConversationType;
  labelEmoji: string | undefined;
  labelString: string | undefined;
};

export type Props = {
  canAddLabel: boolean;
  canAddNewMembers: boolean;
  conversationId: string;
  getPreferredBadge: PreferredBadgeSelectorType;
  i18n: LocalizerType;
  isEditMemberLabelEnabled: boolean;
  isTerminated: boolean;
  maxShownMemberCount?: number;
  memberships: ReadonlyArray<GroupV2Membership>;
  memberColors: Map<string, ContactNameColorType>;
  showContactModal: (payload: ContactModalStateType) => void;
  showLabelEditor: () => void;
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

export function ConversationDetailsMembershipList({
  canAddNewMembers,
  canAddLabel,
  conversationId,
  getPreferredBadge,
  i18n,
  isEditMemberLabelEnabled,
  isTerminated,
  maxShownMemberCount = 5,
  memberColors,
  memberships,
  showContactModal,
  showLabelEditor,
  startAddingNewMembers,
  theme,
}: Props): React.JSX.Element {
  const [showAllMembers, setShowAllMembers] = React.useState<boolean>(false);
  const sortedMemberships = sortMemberships(memberships);

  const shouldHideRestMembers =
    sortedMemberships.length - maxShownMemberCount > 1;
  const membersToShow =
    shouldHideRestMembers && !showAllMembers
      ? maxShownMemberCount
      : sortedMemberships.length;
  const title = isTerminated
    ? i18n('icu:ConversationDetailsMembershipList--terminated-title', {
        number: sortedMemberships.length,
      })
    : i18n('icu:ConversationDetailsMembershipList--title', {
        number: sortedMemberships.length,
      });

  return (
    <PanelSection title={title}>
      {canAddNewMembers && !isTerminated && (
        <PanelRow
          icon={
            <div className="ConversationDetails-membership-list__add-members-icon" />
          }
          label={i18n('icu:ConversationDetailsMembershipList--add-members')}
          onClick={() => startAddingNewMembers?.()}
        />
      )}
      {sortedMemberships
        .slice(0, membersToShow)
        .map(({ isAdmin, member, labelEmoji, labelString }) => {
          const contactNameColor = memberColors.get(member.id);

          return (
            <PanelRow
              key={member.id}
              onClick={() =>
                showContactModal({ contactId: member.id, conversationId })
              }
              icon={
                <Avatar
                  conversationType="direct"
                  badge={getPreferredBadge(member.badges)}
                  i18n={i18n}
                  size={AvatarSize.THIRTY_SIX}
                  theme={theme}
                  {...member}
                />
              }
              label={
                <div>
                  <div>
                    <Emojify
                      text={member.isMe ? i18n('icu:you') : member.title}
                    />
                  </div>
                  {labelString && contactNameColor && (
                    <div className="ConversationDetails-membership-list__member-label">
                      <GroupMemberLabel
                        contactNameColor={contactNameColor}
                        contactLabel={{
                          labelEmoji,
                          labelString,
                        }}
                        context="list"
                      />
                    </div>
                  )}
                  {canAddLabel &&
                    isEditMemberLabelEnabled &&
                    member.isMe &&
                    (!labelString || !contactNameColor) && (
                      <AriaClickable.SubWidget>
                        <button
                          className="ConversationDetails-membership-list__member-label-button"
                          type="button"
                          onClick={event => {
                            showLabelEditor();
                            event.preventDefault();
                            event.stopPropagation();
                          }}
                        >
                          <div>
                            {i18n(
                              'icu:ConversationDetailsMembershipList--add-member-label'
                            )}
                          </div>
                          <div className="ConversationDetails-membership-list__member-label-button__chevron-icon" />
                        </button>
                      </AriaClickable.SubWidget>
                    )}
                </div>
              }
              right={isAdmin ? i18n('icu:GroupV2--admin') : ''}
            />
          );
        })}
      {!showAllMembers && shouldHideRestMembers && (
        <PanelRow
          className="ConversationDetails-membership-list--show-all"
          icon={
            <ConversationDetailsIcon
              ariaLabel={i18n(
                'icu:ConversationDetailsMembershipList--show-all'
              )}
              icon={IconType.down}
            />
          }
          onClick={() => setShowAllMembers(true)}
          label={i18n('icu:ConversationDetailsMembershipList--show-all')}
        />
      )}
    </PanelSection>
  );
}
