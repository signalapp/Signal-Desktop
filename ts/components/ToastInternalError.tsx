// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { LocalizerType } from '../types/Util';
import { missingCaseError } from '../util/missingCaseError';
import { Toast } from './Toast';

export enum ToastInternalErrorKind {
  DecryptionError = 'DecryptionError',
  CDSMirroringError = 'CDSMirroringError',
}

export type ToastPropsType = {
  onShowDebugLog: () => unknown;
} & (
  | {
      kind: ToastInternalErrorKind.DecryptionError;
      deviceId: number;
      name: string;
    }
  | {
      kind: ToastInternalErrorKind.CDSMirroringError;
    }
);

export type PropsType = {
  i18n: LocalizerType;
  onClose: () => unknown;
} & ToastPropsType;

export function ToastInternalError(props: PropsType): JSX.Element {
  const { kind, i18n, onClose, onShowDebugLog } = props;

  let body: string;
  if (kind === ToastInternalErrorKind.DecryptionError) {
    const { deviceId, name } = props;

    body = i18n('icu:decryptionErrorToast', {
      name,
      deviceId,
    });
  } else if (kind === ToastInternalErrorKind.CDSMirroringError) {
    body = i18n('icu:cdsMirroringErrorToast');
  } else {
    throw missingCaseError(kind);
  }

  return (
    <Toast
      autoDismissDisabled
      className="internal-error-toast"
      onClose={onClose}
      style={{ maxWidth: '500px' }}
      toastAction={{
        label: i18n('icu:decryptionErrorToastAction'),
        onClick: onShowDebugLog,
      }}
    >
      {body}
    </Toast>
  );
}
