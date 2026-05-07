// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { JSX } from 'react';
import type { LocalizerType } from '../types/I18N.std.ts';
import { AxoConfirmDialog } from '../axo/AxoConfirmDialog.dom.tsx';

export function DeleteMessagesConfirmationDialog({
  i18n,
  onDestroyMessages,
  onClose,
}: {
  i18n: LocalizerType;
  onDestroyMessages: () => void;
  onClose: () => void;
}): JSX.Element {
  const dialogBody = i18n(
    'icu:ConversationHeader__DeleteConversationConfirmation__description-with-sync'
  );

  return (
    <AxoConfirmDialog.Root
      open
      onOpenChange={onClose}
      title={i18n(
        'icu:ConversationHeader__DeleteConversationConfirmation__title'
      )}
      description={dialogBody}
    >
      <AxoConfirmDialog.Cancel />
      <AxoConfirmDialog.Action
        variant="destructive"
        onClick={onDestroyMessages}
      >
        {i18n('icu:delete')}
      </AxoConfirmDialog.Action>
    </AxoConfirmDialog.Root>
  );
}
