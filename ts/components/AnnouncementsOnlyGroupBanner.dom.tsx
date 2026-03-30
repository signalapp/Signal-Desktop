// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState } from 'react';
import type { ShowConversationType } from '../state/ducks/conversations.preload.ts';
import { I18n } from './I18n.dom.tsx';
import type { LocalizerType, ThemeType } from '../types/Util.std.ts';
import { Modal } from './Modal.dom.tsx';
import { Avatar, AvatarSize } from './Avatar.dom.tsx';
import { GroupMemberLabel } from './conversation/ContactName.dom.tsx';
import type { PreferredBadgeSelectorType } from '../state/selectors/badges.preload.ts';
import { tw } from '../axo/tw.dom.tsx';
import type { AdminMembershipType } from '../state/selectors/conversations.dom.ts';
import { UserText } from './UserText.dom.tsx';
import type { ContactNameColorType } from '../types/Colors.std.ts';

type PropsType = {
  getPreferredBadge: PreferredBadgeSelectorType;
  groupAdmins: Array<AdminMembershipType>;
  memberColors: Map<string, ContactNameColorType>;
  i18n: LocalizerType;
  showConversation: ShowConversationType;
  theme: ThemeType;
};

export function AnnouncementsOnlyGroupBanner({
  getPreferredBadge,
  groupAdmins,
  i18n,
  memberColors,
  showConversation,
  theme,
}: PropsType): React.JSX.Element {
  const [isShowingAdmins, setIsShowingAdmins] = useState(false);

  return (
    <>
      {isShowingAdmins && (
        <Modal
          i18n={i18n}
          hasXButton
          modalName="AnnouncmentsOnlyGroupBanner"
          onClose={() => setIsShowingAdmins(false)}
          title={i18n('icu:AnnouncementsOnlyGroupBanner--modal')}
        >
          {groupAdmins.map(admin => {
            const { member, labelEmoji, labelString } = admin;
            const contactNameColor = memberColors.get(member.id);

            return (
              <div>
                <button
                  type="button"
                  onClick={() => {
                    showConversation({ conversationId: member.id });
                  }}
                  className={tw('flex flex-row items-center p-2')}
                >
                  <div className={tw('pe-3')}>
                    <Avatar
                      conversationType="direct"
                      badge={getPreferredBadge(member.badges)}
                      i18n={i18n}
                      size={AvatarSize.THIRTY_SIX}
                      theme={theme}
                      {...member}
                    />
                  </div>
                  <div className={tw('flex flex-col items-start')}>
                    <div>
                      <UserText
                        text={member.isMe ? i18n('icu:you') : member.title}
                      />
                    </div>
                    {labelString && contactNameColor && (
                      <div className={tw('type-body-small')}>
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
                  </div>
                </button>
              </div>
            );
          })}
        </Modal>
      )}
      <div className="AnnouncementsOnlyGroupBanner__banner">
        <I18n
          i18n={i18n}
          id="icu:AnnouncementsOnlyGroupBanner--announcements-only"
          components={{
            admins: (
              <button
                className="AnnouncementsOnlyGroupBanner__banner--admins"
                type="button"
                onClick={() => setIsShowingAdmins(true)}
              >
                {i18n('icu:AnnouncementsOnlyGroupBanner--admins')}
              </button>
            ),
          }}
        />
      </div>
    </>
  );
}
