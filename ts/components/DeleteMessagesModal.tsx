// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { ActionSpec } from './ConfirmationDialog';
import { ConfirmationDialog } from './ConfirmationDialog';
import type { LocalizerType } from '../types/Util';
import type { ShowToastAction } from '../state/ducks/toast';
import { ToastType } from '../types/Toast';

type DeleteMessagesModalProps = Readonly<{
  isMe: boolean;
  canDeleteForEveryone: boolean;
  i18n: LocalizerType;
  messageCount: number;
  onClose: () => void;
  onDeleteForMe: () => void;
  onDeleteForEveryone: () => void;
  showToast: ShowToastAction;
}>;

const MAX_DELETE_FOR_EVERYONE = 30;

export default function DeleteMessagesModal({
  isMe,
  canDeleteForEveryone,
  i18n,
  messageCount,
  onClose,
  onDeleteForMe,
  onDeleteForEveryone,
  showToast,
}: DeleteMessagesModalProps): JSX.Element {
  const actions: Array<ActionSpec> = [];

  actions.push({
    action: onDeleteForMe,
    style: 'negative',
    text: isMe
      ? i18n('icu:DeleteMessagesModal--deleteFromThisDevice')
      : i18n('icu:DeleteMessagesModal--deleteForMe'),
  });

  if (canDeleteForEveryone || isMe) {
    const tooManyMessages = messageCount > MAX_DELETE_FOR_EVERYONE;
    actions.push({
      'aria-disabled': tooManyMessages,
      autoClose: !tooManyMessages,
      action: () => {
        if (tooManyMessages) {
          showToast({
            toastType: ToastType.TooManyMessagesToDeleteForEveryone,
            parameters: { count: MAX_DELETE_FOR_EVERYONE },
          });
        } else {
          onDeleteForEveryone();
        }
      },
      style: 'negative',
      text: isMe
        ? i18n('icu:DeleteMessagesModal--deleteFromAllDevices')
        : i18n('icu:DeleteMessagesModal--deleteForEveryone'),
    });
  }

  return (
    <ConfirmationDialog
      actions={actions}
      dialogName="ConfirmDeleteForMeModal"
      i18n={i18n}
      onClose={onClose}
      title={i18n('icu:DeleteMessagesModal--title', {
        count: messageCount,
      })}
      moduleClassName="DeleteMessagesModal"
    >
      {isMe
        ? i18n('icu:DeleteMessagesModal--description--noteToSelf', {
            count: messageCount,
          })
        : i18n('icu:DeleteMessagesModal--description', {
            count: messageCount,
          })}
    </ConfirmationDialog>
  );
}
