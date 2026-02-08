// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState } from 'react';
import type { ShowConversationType } from '../state/ducks/conversations.preload.js';
import { I18n } from './I18n.dom.js';
import type { LocalizerType, ThemeType } from '../types/Util.std.js';
import { Modal } from './Modal.dom.js';
import { Avatar, AvatarSize } from './Avatar.dom.js';
import { GroupMemberLabel } from './conversation/ContactName.dom.js';
import type { PreferredBadgeSelectorType } from '../state/selectors/badges.preload.js';
import { tw } from '../axo/tw.dom.js';
import type { AdminMembershipType } from '../state/selectors/conversations.dom.js';
import { UserText } from './UserText.dom.js';

type PropsType = {
  getPreferredBadge: PreferredBadgeSelectorType;
  groupAdmins: Array<AdminMembershipType>;
  memberColors: Map<string, string>;
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
                      <div>
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
