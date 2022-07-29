// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { LocalizerType } from '../types/Util';
import { SECOND } from '../util/durations';
import { Toast } from './Toast';
import { ToastMessageBodyTooLong } from './ToastMessageBodyTooLong';
import { ToastType } from '../state/ducks/toast';
import { strictAssert } from '../util/assert';

export type PropsType = {
  hideToast: () => unknown;
  i18n: LocalizerType;
  toastType?: ToastType;
};

export const ToastManager = ({
  hideToast,
  i18n,
  toastType,
}: PropsType): JSX.Element | null => {
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
      <Toast onClose={hideToast} timeout={3 * SECOND}>
        {i18n('Stories__toast--sending-reaction')}
      </Toast>
    );
  }

  if (toastType === ToastType.StoryReply) {
    return (
      <Toast onClose={hideToast} timeout={3 * SECOND}>
        {i18n('Stories__toast--sending-reply')}
      </Toast>
    );
  }

  if (toastType === ToastType.StoryMuted) {
    return (
      <Toast onClose={hideToast} timeout={3 * SECOND}>
        {i18n('Stories__toast--hasNoSound')}
      </Toast>
    );
  }

  strictAssert(
    toastType === undefined,
    `Unhandled toast of type: ${toastType}`
  );

  return null;
};
