// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { LocalizerType } from '../types/Util';
import { Toast } from './Toast';

export type ToastPropsType = {
  undo: () => unknown;
};

export type PropsType = {
  i18n: LocalizerType;
  onClose: () => unknown;
} & ToastPropsType;

export const ToastConversationArchived = ({
  i18n,
  onClose,
  undo,
}: PropsType): JSX.Element => {
  return (
    <Toast
      toastAction={{
        label: i18n('conversationArchivedUndo'),
        onClick: () => {
          undo();
          onClose();
        },
      }}
      onClose={onClose}
    >
      {i18n('conversationArchived')}
    </Toast>
  );
};
