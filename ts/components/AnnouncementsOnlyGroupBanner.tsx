// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState } from 'react';
import { ConversationType } from '../state/ducks/conversations';
import { Intl } from './Intl';
import { LocalizerType } from '../types/Util';
import { Modal } from './Modal';
import { ConversationListItem } from './conversationList/ConversationListItem';

type PropsType = {
  groupAdmins: Array<ConversationType>;
  i18n: LocalizerType;
  openConversation: (conversationId: string) => unknown;
};

export const AnnouncementsOnlyGroupBanner = ({
  groupAdmins,
  i18n,
  openConversation,
}: PropsType): JSX.Element => {
  const [isShowingAdmins, setIsShowingAdmins] = useState(false);

  return (
    <>
      {isShowingAdmins && (
        <Modal
          i18n={i18n}
          onClose={() => setIsShowingAdmins(false)}
          title={i18n('AnnouncementsOnlyGroupBanner--modal')}
        >
          {groupAdmins.map(admin => (
            <ConversationListItem
              {...admin}
              i18n={i18n}
              onClick={() => {
                openConversation(admin.id);
              }}
              // Required by the component but unecessary for us
              style={{}}
              // We don't want these values to show
              draftPreview=""
              lastMessage={undefined}
              lastUpdated={undefined}
              typingContact={undefined}
            />
          ))}
        </Modal>
      )}
      <div className="AnnouncementsOnlyGroupBanner__banner">
        <Intl
          i18n={i18n}
          id="AnnouncementsOnlyGroupBanner--announcements-only"
          components={[
            <button
              className="AnnouncementsOnlyGroupBanner__banner--admins"
              type="button"
              onClick={() => setIsShowingAdmins(true)}
            >
              {i18n('AnnouncementsOnlyGroupBanner--admins')}
            </button>,
          ]}
        />
      </div>
    </>
  );
};
