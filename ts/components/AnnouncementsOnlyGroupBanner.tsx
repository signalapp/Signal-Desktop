// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState } from 'react';
import { noop } from 'lodash';
import type {
  ConversationType,
  ShowConversationType,
} from '../state/ducks/conversations.js';
import { I18n } from './I18n.js';
import type { LocalizerType, ThemeType } from '../types/Util.js';
import { Modal } from './Modal.js';
import { ConversationListItem } from './conversationList/ConversationListItem.js';

type PropsType = {
  groupAdmins: Array<ConversationType>;
  i18n: LocalizerType;
  showConversation: ShowConversationType;
  theme: ThemeType;
};

export function AnnouncementsOnlyGroupBanner({
  groupAdmins,
  i18n,
  showConversation,
  theme,
}: PropsType): JSX.Element {
  const [isShowingAdmins, setIsShowingAdmins] = useState(false);

  return (
    <>
      {isShowingAdmins && (
        <Modal
          modalName="AnnouncmentsOnlyGroupBanner"
          i18n={i18n}
          onClose={() => setIsShowingAdmins(false)}
          title={i18n('icu:AnnouncementsOnlyGroupBanner--modal')}
        >
          {groupAdmins.map(admin => (
            <ConversationListItem
              {...admin}
              draftPreview={undefined}
              i18n={i18n}
              lastMessage={undefined}
              lastUpdated={undefined}
              onClick={() => {
                showConversation({ conversationId: admin.id });
              }}
              onMouseDown={noop}
              theme={theme}
            />
          ))}
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
