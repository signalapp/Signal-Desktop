// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { getIntl } from '../selectors/user.std.ts';
import { useGlobalModalActions } from '../ducks/globalModals.preload.ts';
import { useConversationsActions } from '../ducks/conversations.preload.ts';
import { useComposerActions } from '../ducks/composer.preload.ts';
import { getDiscardDraftDialogProps } from '../selectors/globalModals.std.ts';
import { strictAssert } from '../../util/assert.std.ts';
import { DiscardDraftDialog } from '../../components/DiscardDraftDialog.dom.tsx';

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
