// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { getIntl } from '../selectors/user.std.js';
import { useGlobalModalActions } from '../ducks/globalModals.preload.js';
import { useConversationsActions } from '../ducks/conversations.preload.js';
import { useComposerActions } from '../ducks/composer.preload.js';
import { getDiscardDraftDialogProps } from '../selectors/globalModals.std.js';
import { strictAssert } from '../../util/assert.std.js';
import { DiscardDraftDialog } from '../../components/DiscardDraftDialog.dom.js';

export const SmartDiscardDraftDialog = memo(function SmartDiscardDraftDialog() {
  const discardDraftDialogProps = useSelector(getDiscardDraftDialogProps);
  strictAssert(
    discardDraftDialogProps != null,
    'Cannot render discard draft dialog without props'
  );
  const { conversationId, messageId } = discardDraftDialogProps;

  const i18n = useSelector(getIntl);
  const { toggleDiscardDraftDialog } = useGlobalModalActions();
  const { setMessageToEdit } = useConversationsActions();
  const { onClearDraft } = useComposerActions();

  const handleClose = useCallback(() => {
    toggleDiscardDraftDialog(null);
  }, [toggleDiscardDraftDialog]);

  const handleDiscard = useCallback(() => {
    toggleDiscardDraftDialog(null);
    onClearDraft(conversationId);
    setMessageToEdit(conversationId, messageId);
  }, [
    toggleDiscardDraftDialog,
    conversationId,
    messageId,
    setMessageToEdit,
    onClearDraft,
  ]);

  return (
    <DiscardDraftDialog
      i18n={i18n}
      onClose={handleClose}
      onDiscard={handleDiscard}
    />
  );
});
