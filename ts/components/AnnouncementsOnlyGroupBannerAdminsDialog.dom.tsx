// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { useCallback, type ReactNode } from 'react';
import { tw } from '../axo/tw.dom.tsx';
import { Avatar, AvatarSize } from './Avatar.dom.tsx';
import type { AdminMembershipType } from '../state/selectors/conversations.dom.ts';
import type { ContactNameColorType } from '../types/Colors.std.ts';
import type { ShowConversationType } from '../state/ducks/conversations.preload.ts';
import type { PreferredBadgeSelectorType } from '../state/selectors/badges.preload.ts';
import type { LocalizerType, ThemeType } from '../types/Util.std.ts';
import type { BadgeType } from '../badges/types.std.ts';
import { UserText } from './UserText.dom.tsx';
import { GroupMemberLabel } from './conversation/ContactName.dom.tsx';
import { AxoDialog } from '../axo/AxoDialog.dom.tsx';

export type AnnouncementsOnlyGroupBannerAdminsDialogProps = Readonly<{
  i18n: LocalizerType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupAdmins: ReadonlyArray<AdminMembershipType>;
  memberColors: ReadonlyMap<string, ContactNameColorType>;
  showConversation: ShowConversationType;
  getPreferredBadge: PreferredBadgeSelectorType;
  theme: ThemeType;
}>;

export function AnnouncementsOnlyGroupBannerAdminsDialog(
  props: AnnouncementsOnlyGroupBannerAdminsDialogProps
): ReactNode {
  const { i18n } = props;
  return (
    <AxoDialog.Root open={props.open} onOpenChange={props.onOpenChange}>
      <AxoDialog.Content size="sm" escape="cancel-is-noop">
        <AxoDialog.Header>
          <AxoDialog.Title>
            {i18n('icu:AnnouncementsOnlyGroupBanner--modal')}
          </AxoDialog.Title>
          <AxoDialog.Close />
        </AxoDialog.Header>
        <AxoDialog.Body>
          {props.groupAdmins.map(admin => {
            const contactNameColor = props.memberColors.get(admin.member.id);

            return (
              <GroupAdminItem
                key={admin.member.id}
                i18n={i18n}
                groupAdmin={admin}
                contactNameColor={contactNameColor}
                badge={props.getPreferredBadge(admin.member.badges)}
                theme={props.theme}
                onShowConversation={props.showConversation}
              />
            );
          })}
        </AxoDialog.Body>
        <AxoDialog.Footer />
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}

function GroupAdminItem(props: {
  i18n: LocalizerType;
  groupAdmin: AdminMembershipType;
  contactNameColor: ContactNameColorType | undefined;
  badge: BadgeType | undefined;
  theme: ThemeType;
  onShowConversation: ShowConversationType;
}) {
  const { i18n, groupAdmin, onShowConversation } = props;
  const { member, labelEmoji, labelString } = groupAdmin;
  const { id: conversationId } = member;

  const handleClick = useCallback(() => {
    onShowConversation({ conversationId });
  }, [onShowConversation, conversationId]);

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        className={tw('flex flex-row items-center p-2')}
      >
        <div className={tw('pe-3')}>
          <Avatar
            conversationType="direct"
            badge={props.badge}
            i18n={i18n}
            size={AvatarSize.THIRTY_SIX}
            theme={props.theme}
            {...member}
          />
        </div>
        <div className={tw('flex flex-col items-start')}>
          <div>
            <UserText text={member.isMe ? i18n('icu:you') : member.title} />
          </div>
          {labelString != null && props.contactNameColor != null && (
            <div className={tw('type-body-small')}>
              <GroupMemberLabel
                contactNameColor={props.contactNameColor}
                contactLabel={{
                  labelEmoji,
                  labelString,
                }}
                context="list"
              />
            </div>
          )}
        </div>
      </button>
    </div>
  );
}
