// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useMemo } from 'react';
import { useSelector } from 'react-redux';
import type { GlobalModalsStateType } from '../ducks/globalModals';
import type { MessageAttributesType } from '../../model-types.d';
import type { StateType } from '../reducer';
import { EditHistoryMessagesModal } from '../../components/EditHistoryMessagesModal';
import { getIntl, getPlatform } from '../selectors/user';
import { getMessagePropsSelector } from '../selectors/message';
import { getPreferredBadgeSelector } from '../selectors/badges';
import { useConversationsActions } from '../ducks/conversations';
import { useGlobalModalActions } from '../ducks/globalModals';
import { useLightboxActions } from '../ducks/lightbox';
import { strictAssert } from '../../util/assert';

export function SmartEditHistoryMessagesModal(): JSX.Element {
  const i18n = useSelector(getIntl);
  const platform = useSelector(getPlatform);

  const { closeEditHistoryModal } = useGlobalModalActions();

  const { kickOffAttachmentDownload } = useConversationsActions();
  const { showLightbox } = useLightboxActions();

  const getPreferredBadge = useSelector(getPreferredBadgeSelector);

  const { editHistoryMessages: messagesAttributes } = useSelector<
    StateType,
    GlobalModalsStateType
  >(state => state.globalModals);

  const messagePropsSelector = useSelector(getMessagePropsSelector);

  strictAssert(messagesAttributes, 'messages not provided');

  const editHistoryMessages = useMemo(() => {
    return messagesAttributes.map(messageAttributes => ({
      ...messagePropsSelector(messageAttributes as MessageAttributesType),
      // Make sure the messages don't get an "edited" badge
      editHistory: undefined,
      // Do not show the same reactions in the message history UI
      reactions: undefined,
    }));
  }, [messagesAttributes, messagePropsSelector]);

  return (
    <EditHistoryMessagesModal
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
