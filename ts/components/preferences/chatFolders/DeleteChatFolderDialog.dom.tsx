// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import React from 'react';
import type { LocalizerType } from '../../../types/I18N.std.js';
import { ConfirmationDialog } from '../../ConfirmationDialog.dom.js';

export function DeleteChatFolderDialog(props: {
  i18n: LocalizerType;
  title: string;
  description: ReactNode;
  cancelText: string;
  deleteText: string;
  onConfirm: () => void;
  onClose: () => void;
}): JSX.Element {
  const { i18n } = props;
  return (
    <ConfirmationDialog
      i18n={i18n}
      dialogName="Preferences__DeleteChatFolderDialog"
      title={props.title}
      cancelText={props.cancelText}
      actions={[
        {
          text: props.deleteText,
          style: 'affirmative',
          action: props.onConfirm,
        },
      ]}
      onClose={props.onClose}
    >
      {props.description}
    </ConfirmationDialog>
  );
}
