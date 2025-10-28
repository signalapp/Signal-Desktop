// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState } from 'react';
import lodash from 'lodash';
import type {
  ConversationType,
  ShowConversationType,
} from '../state/ducks/conversations.preload.js';
import { I18n } from './I18n.dom.js';
import type { LocalizerType, ThemeType } from '../types/Util.std.js';
import { Modal } from './Modal.dom.js';
import { ConversationListItem } from './conversationList/ConversationListItem.dom.js';

const { noop } = lodash;

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
