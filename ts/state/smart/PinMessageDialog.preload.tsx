// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { getIntl } from '../selectors/user.std.ts';
import { useConversationsActions } from '../ducks/conversations.preload.ts';
import { PinMessageDialog } from '../../components/conversation/pinned-messages/PinMessageDialog.dom.tsx';
import { useItemsActions } from '../ducks/items.preload.ts';
import { getSeenPinMessageDisappearingMessagesWarningCount } from '../selectors/items.dom.ts';
import { getPinMessageDialogData } from '../selectors/globalModals.std.ts';
import { useGlobalModalActions } from '../ducks/globalModals.preload.ts';

export type PinMessageDialogData = Readonly<{
  messageId: string;
  hasMaxPinnedMessages: boolean;
  isPinningDisappearingMessage: boolean;
}>;

export const SmartPinMessageDialog = memo(function SmartPinMessageDialog() {
  const i18n = useSelector(getIntl);
  const pinMessageDialogData = useSelector(getPinMessageDialogData);
  const { hidePinMessageDialog } = useGlobalModalActions();
  const { onPinnedMessageAdd } = useConversationsActions();

  const seenPinMessageDisappearingMessagesWarningCount = useSelector(
    getSeenPinMessageDisappearingMessagesWarningCount
  );
  const { putItem } = useItemsActions();

  const handleClose = useCallback(() => {
    hidePinMessageDialog();
  }, [hidePinMessageDialog]);

  const handleSeenPinMessageDisappearingMessagesWarning = useCallback(() => {
    putItem(
      'seenPinMessageDisappearingMessagesWarningCount',
      seenPinMessageDisappearingMessagesWarningCount + 1
    );
  }, [putItem, seenPinMessageDisappearingMessagesWarningCount]);

  if (pinMessageDialogData == null) {
    return null;
  }

  return (
    <PinMessageDialog
      i18n={i18n}
      open
      onOpenChange={handleClose}
      messageId={pinMessageDialogData.messageId}
      hasMaxPinnedMessages={pinMessageDialogData.hasMaxPinnedMessages}
      isPinningDisappearingMessage={
        pinMessageDialogData.isPinningDisappearingMessage
      }
      seenPinMessageDisappearingMessagesWarningCount={
        seenPinMessageDisappearingMessagesWarningCount
      }
      onSeenPinMessageDisappearingMessagesWarning={
        handleSeenPinMessageDisappearingMessagesWarning
      }
      onPinnedMessageAdd={onPinnedMessageAdd}
    />
  );
});
