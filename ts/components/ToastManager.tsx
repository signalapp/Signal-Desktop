// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { LocalizerType, ReplacementValuesType } from '../types/Util';
import { SECOND } from '../util/durations';
import { Toast } from './Toast';
import { ToastMessageBodyTooLong } from './ToastMessageBodyTooLong';
import { ToastType } from '../state/ducks/toast';
import { strictAssert } from '../util/assert';

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
  if (toast?.toastType === ToastType.Error) {
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

  if (toast?.toastType === ToastType.MessageBodyTooLong) {
    return <ToastMessageBodyTooLong i18n={i18n} onClose={hideToast} />;
  }

  if (toast?.toastType === ToastType.StoryReact) {
    return (
      <Toast onClose={hideToast} timeout={SHORT_TIMEOUT}>
        {i18n('Stories__toast--sending-reaction')}
      </Toast>
    );
  }

  if (toast?.toastType === ToastType.StoryReply) {
    return (
      <Toast onClose={hideToast} timeout={SHORT_TIMEOUT}>
        {i18n('Stories__toast--sending-reply')}
      </Toast>
    );
  }

  if (toast?.toastType === ToastType.StoryMuted) {
    return (
      <Toast onClose={hideToast} timeout={SHORT_TIMEOUT}>
        {i18n('Stories__toast--hasNoSound')}
      </Toast>
    );
  }

  if (toast?.toastType === ToastType.StoryVideoTooLong) {
    return (
      <Toast onClose={hideToast}>
        {i18n('StoryCreator__error--video-too-long')}
      </Toast>
    );
  }

  if (toast?.toastType === ToastType.StoryVideoUnsupported) {
    return (
      <Toast onClose={hideToast}>
        {i18n('StoryCreator__error--video-unsupported')}
      </Toast>
    );
  }

  if (toast?.toastType === ToastType.StoryVideoError) {
    return (
      <Toast onClose={hideToast}>
        {i18n('StoryCreator__error--video-error')}
      </Toast>
    );
  }

  if (toast?.toastType === ToastType.AddingUserToGroup) {
    return (
      <Toast onClose={hideToast} timeout={SHORT_TIMEOUT}>
        {i18n(
          'AddUserToAnotherGroupModal__toast--adding-user-to-group',
          toast.parameters
        )}
      </Toast>
    );
  }

  if (toast?.toastType === ToastType.UserAddedToGroup) {
    return (
      <Toast onClose={hideToast}>
        {i18n(
          'AddUserToAnotherGroupModal__toast--user-added-to-group',
          toast.parameters
        )}
      </Toast>
    );
  }

  strictAssert(
    toast === undefined,
    `Unhandled toast of type: ${toast?.toastType}`
  );

  return null;
};
