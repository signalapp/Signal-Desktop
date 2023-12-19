// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { LocalizerType } from '../types/Util';
import { ConfirmationDialog } from './ConfirmationDialog';

type PropsType = {
  i18n: LocalizerType;
  onSendAnyway: () => void;
  onCancel: () => void;
};

export function SendEditWarningModal({
  i18n,
  onSendAnyway,
  onCancel,
}: PropsType): JSX.Element | null {
  return (
    <ConfirmationDialog
      actions={[
        {
          action: onSendAnyway,
          autoClose: true,
          style: 'affirmative',
          text: i18n('icu:sendAnyway'),
        },
      ]}
      dialogName="SendEditWarningModal"
      i18n={i18n}
      onCancel={onCancel}
      onClose={onCancel}
      title={i18n('icu:SendEdit--dialog--title2')}
    >
      {i18n('icu:SendEdit--dialog--body2')}
    </ConfirmationDialog>
  );
}
