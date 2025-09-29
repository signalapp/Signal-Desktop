// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { FC } from 'react';
import React, { memo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { getIntl } from '../selectors/user.js';
import { getConversationByIdSelector } from '../selectors/conversations.js';
import { LeftPaneConversationListItemContextMenu } from '../../components/leftPane/LeftPaneConversationListItemContextMenu.js';
import { strictAssert } from '../../util/assert.js';
import type { RenderConversationListItemContextMenuProps } from '../../components/conversationList/BaseConversationListItem.js';
import { useConversationsActions } from '../ducks/conversations.js';
import { getLocalDeleteWarningShown } from '../selectors/items.js';
import { useItemsActions } from '../ducks/items.js';

export const SmartLeftPaneConversationListItemContextMenu: FC<RenderConversationListItemContextMenuProps> =
  memo(function SmartLeftPaneConversationListItemContextMenu(props) {
    const i18n = useSelector(getIntl);
    const conversationByIdSelector = useSelector(getConversationByIdSelector);
    const localDeleteWarningShown = useSelector(getLocalDeleteWarningShown);
    const {
      onMarkUnread,
      markConversationRead,
      setPinned,
      onArchive,
      onMoveToInbox,
      deleteConversation,
      setMuteExpiration,
    } = useConversationsActions();
    const { putItem } = useItemsActions();

    const setLocalDeleteWarningShown = useCallback(() => {
      putItem('localDeleteWarningShown', true);
    }, [putItem]);

    const conversation = conversationByIdSelector(props.conversationId);
    strictAssert(conversation, 'Missing conversation');

    const handlePin = useCallback(
      (conversationId: string) => {
        setPinned(conversationId, true);
      },
      [setPinned]
    );

    const handleUnpin = useCallback(
      (conversationId: string) => {
        setPinned(conversationId, false);
      },
      [setPinned]
    );

    return (
      <LeftPaneConversationListItemContextMenu
        i18n={i18n}
        conversation={conversation}
        onMarkUnread={onMarkUnread}
        onMarkRead={markConversationRead}
        onPin={handlePin}
        onUnpin={handleUnpin}
        onUpdateMute={setMuteExpiration}
        onArchive={onArchive}
        onUnarchive={onMoveToInbox}
        onDelete={deleteConversation}
        localDeleteWarningShown={localDeleteWarningShown}
        setLocalDeleteWarningShown={setLocalDeleteWarningShown}
      >
        {props.children}
      </LeftPaneConversationListItemContextMenu>
    );
  });
