// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { LocalizerType } from '../types/Util';
import { Theme } from '../util/theme';
import { Modal } from './Modal';
import { Button, ButtonVariant } from './Button';

type PropsType = {
  i18n: LocalizerType;
  openSystemPreferencesAction: () => unknown;
  toggleScreenRecordingPermissionsDialog: () => unknown;
};

function focusRef(el: HTMLElement | null) {
  if (el) {
    el.focus();
  }
}

export const NeedsScreenRecordingPermissionsModal = ({
  i18n,
  openSystemPreferencesAction,
  toggleScreenRecordingPermissionsDialog,
}: PropsType): JSX.Element => {
  return (
    <Modal
      i18n={i18n}
      title={i18n('calling__presenting--permission-title')}
      theme={Theme.Dark}
      onClose={toggleScreenRecordingPermissionsDialog}
    >
      <p>{i18n('calling__presenting--macos-permission-description')}</p>
      <ol style={{ paddingLeft: 16 }}>
        <li>{i18n('calling__presenting--permission-instruction-step1')}</li>
        <li>{i18n('calling__presenting--permission-instruction-step2')}</li>
        <li>{i18n('calling__presenting--permission-instruction-step3')}</li>
      </ol>
      <Modal.ButtonFooter>
        <Button
          onClick={toggleScreenRecordingPermissionsDialog}
          ref={focusRef}
          variant={ButtonVariant.Secondary}
        >
          {i18n('calling__presenting--permission-cancel')}
        </Button>
        <Button
          onClick={() => {
            openSystemPreferencesAction();
            toggleScreenRecordingPermissionsDialog();
          }}
          variant={ButtonVariant.Primary}
        >
          {i18n('calling__presenting--permission-open')}
        </Button>
      </Modal.ButtonFooter>
    </Modal>
  );
};
