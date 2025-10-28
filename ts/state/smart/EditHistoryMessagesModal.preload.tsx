// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo, useMemo } from 'react';
import { useSelector } from 'react-redux';
import type { ReadonlyMessageAttributesType } from '../../model-types.d.ts';
import { EditHistoryMessagesModal } from '../../components/EditHistoryMessagesModal.dom.js';
import { getIntl, getPlatform } from '../selectors/user.std.js';
import { getMessagePropsSelector } from '../selectors/message.preload.js';
import { getPreferredBadgeSelector } from '../selectors/badges.preload.js';
import { useConversationsActions } from '../ducks/conversations.preload.js';
import { useGlobalModalActions } from '../ducks/globalModals.preload.js';
import { useLightboxActions } from '../ducks/lightbox.preload.js';
import { strictAssert } from '../../util/assert.std.js';
import { getEditHistoryMessages } from '../selectors/globalModals.std.js';

export const SmartEditHistoryMessagesModal = memo(
  function SmartEditHistoryMessagesModal(): JSX.Element {
    const i18n = useSelector(getIntl);
    const platform = useSelector(getPlatform);

    const { closeEditHistoryModal } = useGlobalModalActions();
    const { cancelAttachmentDownload, kickOffAttachmentDownload } =
      useConversationsActions();
    const { showLightbox } = useLightboxActions();

    const getPreferredBadge = useSelector(getPreferredBadgeSelector);
    const messagesAttributes = useSelector(getEditHistoryMessages);
    const messagePropsSelector = useSelector(getMessagePropsSelector);

    strictAssert(messagesAttributes, 'messages not provided');

    const editHistoryMessages = useMemo(() => {
      return messagesAttributes.map(messageAttributes => ({
        ...messagePropsSelector(
          messageAttributes as ReadonlyMessageAttributesType
        ),
        // Make sure the messages don't get an "edited" badge
        isEditedMessage: false,
        // Do not show the same reactions in the message history UI
        reactions: undefined,
        // Make sure that the timestamp is the correct timestamp from attributes
        // not the one that the selector derives.
        timestamp: messageAttributes.timestamp,
      }));
    }, [messagesAttributes, messagePropsSelector]);

    return (
      <EditHistoryMessagesModal
        cancelAttachmentDownload={cancelAttachmentDownload}
        closeEditHistoryModal={closeEditHistoryModal}
        editHistoryMessages={editHistoryMessages}
        getPreferredBadge={getPreferredBadge}
        i18n={i18n}
        platform={platform}
        kickOffAttachmentDownload={kickOffAttachmentDownload}
        showLightbox={showLightbox}
      />
    );
  }
);
