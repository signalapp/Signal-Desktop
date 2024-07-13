// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { ActionSpec } from './ConfirmationDialog';
import { ConfirmationDialog } from './ConfirmationDialog';
import type { LocalizerType } from '../types/Util';
import type { ShowToastAction } from '../state/ducks/toast';
import { ToastType } from '../types/Toast';

export type DeleteMessagesModalProps = Readonly<{
  isMe: boolean;
  isDeleteSyncSendEnabled: boolean;
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
  isDeleteSyncSendEnabled,
  canDeleteForEveryone,
  i18n,
  messageCount,
  onClose,
  onDeleteForMe,
  onDeleteForEveryone,
  showToast,
}: DeleteMessagesModalProps): JSX.Element {
  const actions: Array<ActionSpec> = [];

  const syncNoteToSelfDelete = isMe && isDeleteSyncSendEnabled;

  let deleteForMeText = i18n('icu:DeleteMessagesModal--deleteForMe');
  if (syncNoteToSelfDelete) {
    deleteForMeText = i18n('icu:DeleteMessagesModal--noteToSelf--deleteSync');
  } else if (isMe) {
    deleteForMeText = i18n('icu:DeleteMessagesModal--deleteFromThisDevice');
  }

  actions.push({
    action: onDeleteForMe,
    style: 'negative',
    text: deleteForMeText,
  });

  if (canDeleteForEveryone && !syncNoteToSelfDelete) {
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

  let descriptionText = i18n('icu:DeleteMessagesModal--description', {
    count: messageCount,
  });
  if (syncNoteToSelfDelete) {
    descriptionText = i18n(
      'icu:DeleteMessagesModal--description--noteToSelf--deleteSync',
      { count: messageCount }
    );
  } else if (isMe) {
    descriptionText = i18n('icu:DeleteMessagesModal--description--noteToSelf', {
      count: messageCount,
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
      {descriptionText}
    </ConfirmationDialog>
  );
}
