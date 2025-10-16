// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React from 'react';
import type { LocalizerType } from '../types/I18N.std.js';
import { ConfirmationDialog } from './ConfirmationDialog.dom.js';
import { LocalDeleteWarningModal } from './LocalDeleteWarningModal.dom.js';

export function DeleteMessagesConfirmationDialog({
  i18n,
  localDeleteWarningShown,
  onDestroyMessages,
  onClose,
  setLocalDeleteWarningShown,
}: {
  i18n: LocalizerType;
  localDeleteWarningShown: boolean;
  onDestroyMessages: () => void;
  onClose: () => void;
  setLocalDeleteWarningShown: () => void;
}): JSX.Element {
  if (!localDeleteWarningShown) {
    return (
      <LocalDeleteWarningModal
        i18n={i18n}
        onClose={setLocalDeleteWarningShown}
      />
    );
  }

  const dialogBody = i18n(
    'icu:ConversationHeader__DeleteConversationConfirmation__description-with-sync'
  );

  return (
    <ConfirmationDialog
      dialogName="ConversationHeader.destroyMessages"
      title={i18n(
        'icu:ConversationHeader__DeleteConversationConfirmation__title'
      )}
      actions={[
        {
          action: onDestroyMessages,
          style: 'negative',
          text: i18n('icu:delete'),
        },
      ]}
      i18n={i18n}
      onClose={onClose}
    >
      {dialogBody}
    </ConfirmationDialog>
  );
}
