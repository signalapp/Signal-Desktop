// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { NotePreviewModal } from '../../components/NotePreviewModal.dom.tsx';
import { strictAssert } from '../../util/assert.std.ts';
import { getConversationSelector } from '../selectors/conversations.dom.ts';
import { getNotePreviewModalProps } from '../selectors/globalModals.std.ts';
import { getIntl } from '../selectors/user.std.ts';
import { useGlobalModalActions } from '../ducks/globalModals.preload.ts';

export const SmartNotePreviewModal = memo(function SmartNotePreviewModal() {
  const i18n = useSelector(getIntl);
  const props = useSelector(getNotePreviewModalProps);
  strictAssert(props != null, 'props is required');
  const { conversationId } = props;
  const conversationSelector = useSelector(getConversationSelector);
  const conversation = conversationSelector(conversationId);
  strictAssert(conversation != null, 'conversation is required');

  const { toggleNotePreviewModal, toggleEditNicknameAndNoteModal } =
    useGlobalModalActions();

  const handleClose = useCallback(() => {
    toggleNotePreviewModal(null);
  }, [toggleNotePreviewModal]);

  const handleEdit = useCallback(() => {
    toggleEditNicknameAndNoteModal({ conversationId });
  }, [toggleEditNicknameAndNoteModal, conversationId]);

  return (
    <NotePreviewModal
      conversation={conversation}
      i18n={i18n}
      onClose={handleClose}
      onEdit={handleEdit}
    />
  );
});
