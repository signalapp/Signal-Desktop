// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useState, type JSX } from 'react';
import type { LocalizerType, ThemeType } from '../../../types/Util.std.ts';
import { Avatar, AvatarSize } from '../../Avatar.dom.tsx';
import type { ConversationType } from '../../../state/ducks/conversations.preload.ts';
import type { PreferredBadgeSelectorType } from '../../../state/selectors/badges.preload.ts';
import { GroupMemberLabel } from '../ContactName.dom.tsx';
import { AriaClickable } from '../../../axo/AriaClickable.dom.tsx';
import type { ContactModalStateType } from '../../../types/globalModals.std.ts';
import type { ContactNameColorType } from '../../../types/Colors.std.ts';
import type { Emoji } from '../../../axo/emoji.std.ts';
import { UserText } from '../../UserText.dom.tsx';
import { isInSystemContacts } from '../../../util/isInSystemContacts.std.ts';
import { InContactsIcon } from '../../InContactsIcon.dom.tsx';
import { AxoIconButton } from '../../../axo/AxoIconButton.dom.tsx';
import { GroupMembersSearchDialog } from './GroupMembersSearchDialog.dom.tsx';
import { AxoContactList } from '../../../axo/items/AxoContactList.dom.tsx';
import { tw } from '../../../axo/tw.dom.tsx';

export type GroupV2Membership = {
  isAdmin: boolean;
  member: ConversationType;
  labelEmoji: Emoji.Variant | undefined;
  labelString: string | undefined;
};

export type Props = {
  canAddLabel: boolean;
  canAddNewMembers: boolean;
  canInviteViaGroupLink: boolean;
  groupLink: string | null;
  conversationId: string;
  getPreferredBadge: PreferredBadgeSelectorType;
  hasOtherModalOpen: boolean;
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
  canInviteViaGroupLink,
  groupLink,
  conversationId,
  getPreferredBadge,
  hasOtherModalOpen,
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
}: Props): JSX.Element {
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [showAllMembers, setShowAllMembers] = useState<boolean>(false);
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

  const handleOpenSearchDialog = useCallback(() => {
    setSearchDialogOpen(true);
  }, []);

  const handleSearchDialogSelectMember = useCallback(
    (member: GroupV2Membership) => {
      setSearchDialogOpen(false);
      showContactModal({
        contactId: member.member.id,
        conversationId,
      });
    },
    [showContactModal, conversationId]
  );

  const handleSearchDialogSelectAddMember = useCallback(() => {
    startAddingNewMembers?.();
  }, [startAddingNewMembers]);

  return (
    <>
      <AxoContactList.Root
        title={
          <div className={tw('flex items-center')}>
            <div className={tw('flex-1')}>{title}</div>
            <AxoIconButton.Root
              variant="implied-secondary"
              size="md"
              symbol="search"
              label={i18n(
                'icu:ConversationDetailsMembershipList__Search__AccessibilityLabel'
              )}
              onClick={handleOpenSearchDialog}
            />
          </div>
        }
      >
        {canAddNewMembers && !isTerminated && (
          <AxoContactList.ActionItem
            symbol="plus"
            title={i18n('icu:ConversationDetailsMembershipList--add-members')}
            onClick={() => startAddingNewMembers?.()}
          />
        )}
        {sortedMemberships
          .slice(0, membersToShow)
          .map(({ isAdmin, member, labelEmoji, labelString }) => {
            const contactNameColor = memberColors.get(member.id);

            return (
              <AxoContactList.Item
                key={member.id}
                onClick={() =>
                  showContactModal({ contactId: member.id, conversationId })
                }
                avatar={
                  <Avatar
                    conversationType="direct"
                    badge={getPreferredBadge(member.badges)}
                    i18n={i18n}
                    size={AvatarSize.THIRTY_SIX}
                    theme={theme}
                    {...member}
                  />
                }
                title={
                  <div>
                    <div>
                      <UserText
                        text={member.isMe ? i18n('icu:you') : member.title}
                      />
                      &nbsp;
                      {isInSystemContacts(member) && !member.isMe ? (
                        <AriaClickable.SubWidget>
                          <InContactsIcon i18n={i18n} />
                        </AriaClickable.SubWidget>
                      ) : null}
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
                value={isAdmin ? i18n('icu:GroupV2--admin') : null}
              />
            );
          })}
        {!showAllMembers && shouldHideRestMembers && (
          <AxoContactList.ActionItem
            symbol="chevron-down"
            title={i18n('icu:ConversationDetailsMembershipList--show-all')}
            onClick={() => setShowAllMembers(true)}
          />
        )}
      </AxoContactList.Root>
      <GroupMembersSearchDialog
        i18n={i18n}
        open={searchDialogOpen && !hasOtherModalOpen}
        onOpenChange={setSearchDialogOpen}
        canInviteViaGroupLink={canInviteViaGroupLink}
        canAddNewMembers={canAddNewMembers}
        groupLink={groupLink}
        members={memberships}
        onSelectMember={handleSearchDialogSelectMember}
        onSelectAddMember={handleSearchDialogSelectAddMember}
      />
    </>
  );
}
