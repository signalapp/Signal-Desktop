// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo, useMemo } from 'react';
import { useSelector } from 'react-redux';
import type { ReadonlyMessageAttributesType } from '../../model-types.d';
import { EditHistoryMessagesModal } from '../../components/EditHistoryMessagesModal';
import { getIntl, getPlatform } from '../selectors/user';
import { getMessagePropsSelector } from '../selectors/message';
import { getPreferredBadgeSelector } from '../selectors/badges';
import { useConversationsActions } from '../ducks/conversations';
import { useGlobalModalActions } from '../ducks/globalModals';
import { useLightboxActions } from '../ducks/lightbox';
import { strictAssert } from '../../util/assert';
import { getEditHistoryMessages } from '../selectors/globalModals';

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
