// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { LocalizerType, ReplacementValuesType } from '../types/Util';
import { SECOND } from '../util/durations';
import { Toast } from './Toast';
import { ToastMessageBodyTooLong } from './ToastMessageBodyTooLong';
import { ToastType } from '../state/ducks/toast';
import { missingCaseError } from '../util/missingCaseError';

export type PropsType = {
  hideToast: () => unknown;
  i18n: LocalizerType;
  toast?: {
    toastType: ToastType;
    parameters?: ReplacementValuesType;
  };
};

const SHORT_TIMEOUT = 3 * SECOND;

export const ToastManager = ({
  hideToast,
  i18n,
  toast,
}: PropsType): JSX.Element | null => {
  if (toast === undefined) {
    return null;
  }

  const { toastType } = toast;
  if (toastType === ToastType.Error) {
    return (
      <Toast
        autoDismissDisabled
        onClose={hideToast}
        toastAction={{
          label: i18n('Toast--error--action'),
          onClick: () => window.showDebugLog(),
        }}
      >
        {i18n('Toast--error')}
      </Toast>
    );
  }

  if (toastType === ToastType.MessageBodyTooLong) {
    return <ToastMessageBodyTooLong i18n={i18n} onClose={hideToast} />;
  }

  if (toastType === ToastType.StoryReact) {
    return (
      <Toast onClose={hideToast} timeout={SHORT_TIMEOUT}>
        {i18n('Stories__toast--sending-reaction')}
      </Toast>
    );
  }

  if (toastType === ToastType.StoryReply) {
    return (
      <Toast onClose={hideToast} timeout={SHORT_TIMEOUT}>
        {i18n('Stories__toast--sending-reply')}
      </Toast>
    );
  }

  if (toastType === ToastType.StoryMuted) {
    return (
      <Toast onClose={hideToast} timeout={SHORT_TIMEOUT}>
        {i18n('Stories__toast--hasNoSound')}
      </Toast>
    );
  }

  if (toastType === ToastType.StoryVideoTooLong) {
    return (
      <Toast onClose={hideToast}>
        {i18n('StoryCreator__error--video-too-long')}
      </Toast>
    );
  }

  if (toastType === ToastType.StoryVideoUnsupported) {
    return (
      <Toast onClose={hideToast}>
        {i18n('StoryCreator__error--video-unsupported')}
      </Toast>
    );
  }

  if (toastType === ToastType.StoryVideoError) {
    return (
      <Toast onClose={hideToast}>
        {i18n('StoryCreator__error--video-error')}
      </Toast>
    );
  }

  if (toastType === ToastType.AddingUserToGroup) {
    return (
      <Toast onClose={hideToast} timeout={SHORT_TIMEOUT}>
        {i18n(
          'AddUserToAnotherGroupModal__toast--adding-user-to-group',
          toast.parameters
        )}
      </Toast>
    );
  }

  if (toastType === ToastType.UserAddedToGroup) {
    return (
      <Toast onClose={hideToast}>
        {i18n(
          'AddUserToAnotherGroupModal__toast--user-added-to-group',
          toast.parameters
        )}
      </Toast>
    );
  }

  if (toastType === ToastType.FailedToDeleteUsername) {
    return (
      <Toast onClose={hideToast}>
        {i18n('ProfileEditor--username--delete-general-error')}
      </Toast>
    );
  }

  if (toastType === ToastType.CopiedUsername) {
    return (
      <Toast onClose={hideToast} timeout={3 * SECOND}>
        {i18n('ProfileEditor--username--copied-username')}
      </Toast>
    );
  }

  if (toastType === ToastType.CopiedUsernameLink) {
    return (
      <Toast onClose={hideToast} timeout={3 * SECOND}>
        {i18n('ProfileEditor--username--copied-username-link')}
      </Toast>
    );
  }

  throw missingCaseError(toastType);
};
