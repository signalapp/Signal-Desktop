// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { getConversationSelector } from '../selectors/conversations.dom.js';
import { getEditNicknameAndNoteModalProps } from '../selectors/globalModals.std.js';
import { strictAssert } from '../../util/assert.std.js';
import { EditNicknameAndNoteModal } from '../../components/EditNicknameAndNoteModal.dom.js';
import { getIntl } from '../selectors/user.std.js';
import { useGlobalModalActions } from '../ducks/globalModals.preload.js';
import type { NicknameAndNote } from '../ducks/conversations.preload.js';
import { useConversationsActions } from '../ducks/conversations.preload.js';

export const SmartEditNicknameAndNoteModal = memo(
  function SmartEditNicknameAndNoteModal(): JSX.Element {
    const props = useSelector(getEditNicknameAndNoteModalProps);
    strictAssert(props != null, 'EditNicknameAndNoteModal requires props');
    const { conversationId } = props;

    const i18n = useSelector(getIntl);
    const conversationSelector = useSelector(getConversationSelector);
    const conversation = conversationSelector(conversationId);
    strictAssert(
      conversation != null,
      'EditNicknameAndNoteModal requires conversation'
    );

    const { toggleEditNicknameAndNoteModal, toggleNotePreviewModal } =
      useGlobalModalActions();
    const { updateNicknameAndNote } = useConversationsActions();

    const handleSave = useCallback(
      (nicknameAndNote: NicknameAndNote) => {
        // Ensure we don't re-open the note preview modal if there's no note.
        if (nicknameAndNote.note == null) {
          toggleNotePreviewModal(null);
        }
        updateNicknameAndNote(conversationId, nicknameAndNote);
      },
      [conversationId, updateNicknameAndNote, toggleNotePreviewModal]
    );

    const handleClose = useCallback(() => {
      toggleEditNicknameAndNoteModal(null);
    }, [toggleEditNicknameAndNoteModal]);

    return (
      <EditNicknameAndNoteModal
        i18n={i18n}
        conversation={conversation}
        onSave={handleSave}
        onClose={handleClose}
      />
    );
  }
);
