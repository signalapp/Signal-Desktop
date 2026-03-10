// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { MouseEvent } from 'react';
import React, { useCallback, useState } from 'react';
import type { LocalizerType } from '../types/Util.std.js';
import type { ShowToastAction } from '../state/ducks/toast.preload.js';
import { ToastType } from '../types/Toast.dom.js';
import { AxoAlertDialog } from '../axo/AxoAlertDialog.dom.js';

export type DeleteMessagesModalProps = Readonly<{
  isMe: boolean;
  canDeleteForEveryone: boolean;
  needsAdminDelete: boolean;
  isDeletingOwnMessages: boolean;
  hasSeenAdminDeleteEducationDialog: boolean;
  i18n: LocalizerType;
  messageCount: number;
  onClose: () => void;
  onDeleteForMe: () => void;
  onDeleteForEveryone: () => void;
  onSeenAdminDeleteEducationDialog: () => void;
  showToast: ShowToastAction;
}>;

const MAX_DELETE_FOR_EVERYONE = 30;

enum Step {
  SELECT_DELETE_TYPE,
  CONFIRM_ADMIN_DELETE,
}

export default function DeleteMessagesModal({
  isMe,
  canDeleteForEveryone,
  needsAdminDelete,
  isDeletingOwnMessages,
  hasSeenAdminDeleteEducationDialog,
  i18n,
  messageCount,
  onClose,
  onDeleteForMe,
  onDeleteForEveryone,
  onSeenAdminDeleteEducationDialog,
  showToast,
}: DeleteMessagesModalProps): React.JSX.Element {
  const [step, setStep] = useState(Step.SELECT_DELETE_TYPE);

  const tooManyMessages = messageCount > MAX_DELETE_FOR_EVERYONE;

  const handleBackToSelectDeleteType = useCallback(() => {
    setStep(Step.SELECT_DELETE_TYPE);
  }, []);

  const handleSelectDeleteForMe = useCallback(() => {
    onDeleteForMe();
    onClose();
  }, [onDeleteForMe, onClose]);

  const handleConfirmDeleteForEveryone = useCallback(() => {
    onDeleteForEveryone();
    onClose();
  }, [onDeleteForEveryone, onClose]);

  const handleSelectDeleteForEveryone = useCallback(() => {
    if (tooManyMessages) {
      showToast({
        toastType: ToastType.TooManyMessagesToDeleteForEveryone,
        parameters: { count: MAX_DELETE_FOR_EVERYONE },
      });
      return;
    }
    if (
      needsAdminDelete &&
      !isDeletingOwnMessages &&
      !hasSeenAdminDeleteEducationDialog
    ) {
      setStep(Step.CONFIRM_ADMIN_DELETE);
      return;
    }
    handleConfirmDeleteForEveryone();
  }, [
    tooManyMessages,
    needsAdminDelete,
    isDeletingOwnMessages,
    hasSeenAdminDeleteEducationDialog,
    showToast,
    handleConfirmDeleteForEveryone,
  ]);

  return (
    <>
      <DeleteMessagesSelectDeleteTypeDialog
        isMe={isMe}
        canDeleteForEveryone={canDeleteForEveryone}
        i18n={i18n}
        messageCount={messageCount}
        tooManyMessages={tooManyMessages}
        open={step === Step.SELECT_DELETE_TYPE}
        onClose={onClose}
        onSelectDeleteForMe={handleSelectDeleteForMe}
        onSelectDeleteForEveryone={handleSelectDeleteForEveryone}
      />
      <DeleteMessagesConfirmAdminDeleteDialog
        i18n={i18n}
        messageCount={messageCount}
        open={step === Step.CONFIRM_ADMIN_DELETE}
        onOpenChange={handleBackToSelectDeleteType}
        onCancel={handleBackToSelectDeleteType}
        onConfirm={onDeleteForEveryone}
        onClose={onClose}
        onSeenAdminDeleteEducationDialog={onSeenAdminDeleteEducationDialog}
      />
    </>
  );
}

function DeleteMessagesSelectDeleteTypeDialog(props: {
  isMe: boolean;
  canDeleteForEveryone: boolean;
  i18n: LocalizerType;
  messageCount: number;
  tooManyMessages: boolean;
  open: boolean;
  onClose: () => void;
  onSelectDeleteForMe: () => void;
  onSelectDeleteForEveryone: () => void;
}) {
  const { i18n, onClose, onSelectDeleteForEveryone } = props;

  const handleOpenChange = useCallback(
    (value: boolean) => {
      if (!value) {
        onClose();
      }
    },
    [onClose]
  );

  const handleSelectDeleteForEveryone = useCallback(
    (event: MouseEvent) => {
      event.preventDefault();
      onSelectDeleteForEveryone();
    },
    [onSelectDeleteForEveryone]
  );

  return (
    <AxoAlertDialog.Root open={props.open} onOpenChange={handleOpenChange}>
      <AxoAlertDialog.Content escape="cancel-is-noop">
        <AxoAlertDialog.Body>
          <AxoAlertDialog.Title>
            {i18n('icu:DeleteMessagesModal--title-2', {
              count: props.messageCount,
            })}
          </AxoAlertDialog.Title>
          <AxoAlertDialog.Description>
            {props.isMe
              ? i18n(
                  'icu:DeleteMessagesModal--description--noteToSelf--deleteSync',
                  { count: props.messageCount }
                )
              : i18n('icu:DeleteMessagesModal--description', {
                  count: props.messageCount,
                })}
          </AxoAlertDialog.Description>
        </AxoAlertDialog.Body>
        <AxoAlertDialog.Footer>
          <AxoAlertDialog.Cancel>{i18n('icu:cancel')}</AxoAlertDialog.Cancel>
          <AxoAlertDialog.Action
            variant="subtle-destructive"
            onClick={props.onSelectDeleteForMe}
          >
            {props.isMe
              ? i18n('icu:DeleteMessagesModal--noteToSelf--deleteSync')
              : i18n('icu:DeleteMessagesModal--deleteForMe')}
          </AxoAlertDialog.Action>
          {props.canDeleteForEveryone && !props.isMe && (
            <AxoAlertDialog.Action
              variant="subtle-destructive"
              onClick={handleSelectDeleteForEveryone}
            >
              {i18n('icu:DeleteMessagesModal--deleteForEveryone')}
            </AxoAlertDialog.Action>
          )}
        </AxoAlertDialog.Footer>
      </AxoAlertDialog.Content>
    </AxoAlertDialog.Root>
  );
}

function DeleteMessagesConfirmAdminDeleteDialog(props: {
  i18n: LocalizerType;
  messageCount: number;
  open: boolean;
  onOpenChange: () => void;
  onCancel: () => void;
  onConfirm: () => void;
  onClose: () => void;
  onSeenAdminDeleteEducationDialog: () => void;
}) {
  const {
    i18n,
    messageCount,
    onCancel,
    onConfirm,
    onClose,
    onSeenAdminDeleteEducationDialog,
  } = props;

  const handleCancel = useCallback(() => {
    onCancel();
  }, [onCancel]);

  const handleConfirm = useCallback(() => {
    onSeenAdminDeleteEducationDialog();
    onConfirm();
    onClose();
  }, [onConfirm, onClose, onSeenAdminDeleteEducationDialog]);

  return (
    <AxoAlertDialog.Root open={props.open} onOpenChange={props.onOpenChange}>
      <AxoAlertDialog.Content escape="cancel-is-noop">
        <AxoAlertDialog.Body>
          <AxoAlertDialog.Title>
            {i18n('icu:DeleteMessagesModal--adminDeleteConfirmation--title')}
          </AxoAlertDialog.Title>
          <AxoAlertDialog.Description>
            {i18n(
              'icu:DeleteMessagesModal--adminDeleteConfirmation--description',
              { count: messageCount }
            )}
          </AxoAlertDialog.Description>
        </AxoAlertDialog.Body>
        <AxoAlertDialog.Footer>
          <AxoAlertDialog.Action variant="secondary" onClick={handleCancel}>
            {i18n('icu:cancel')}
          </AxoAlertDialog.Action>
          <AxoAlertDialog.Action
            variant="subtle-destructive"
            onClick={handleConfirm}
          >
            {i18n('icu:DeleteMessagesModal--deleteForEveryone')}
          </AxoAlertDialog.Action>
        </AxoAlertDialog.Footer>
      </AxoAlertDialog.Content>
    </AxoAlertDialog.Root>
  );
}
