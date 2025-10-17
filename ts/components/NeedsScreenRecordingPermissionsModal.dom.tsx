// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { LocalizerType } from '../types/Util.std.js';
import { Theme } from '../util/theme.std.js';
import { Modal } from './Modal.dom.js';
import { Button, ButtonVariant } from './Button.dom.js';
import { tw } from '../axo/tw.dom.js';

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

export function NeedsScreenRecordingPermissionsModal({
  i18n,
  openSystemPreferencesAction,
  toggleScreenRecordingPermissionsDialog,
}: PropsType): JSX.Element {
  const footer = (
    <>
      <Button
        onClick={toggleScreenRecordingPermissionsDialog}
        ref={focusRef}
        variant={ButtonVariant.Secondary}
      >
        {i18n('icu:calling__presenting--permission-cancel')}
      </Button>
      <Button
        onClick={() => {
          openSystemPreferencesAction();
          toggleScreenRecordingPermissionsDialog();
        }}
        variant={ButtonVariant.Primary}
      >
        {i18n('icu:calling__presenting--permission-open')}
      </Button>
    </>
  );
  return (
    <Modal
      modalName="NeedsScreenRecordingPermissionsModal"
      i18n={i18n}
      title={i18n('icu:calling__presenting--permission-title')}
      theme={Theme.Dark}
      onClose={toggleScreenRecordingPermissionsDialog}
      modalFooter={footer}
    >
      <p>{i18n('icu:calling__presenting--macos-permission-description')}</p>
      <ol className={tw('mt-2 list-decimal ps-4')}>
        <li>{i18n('icu:calling__presenting--permission-instruction-step1')}</li>
        <li>{i18n('icu:calling__presenting--permission-instruction-step2')}</li>
        <li>{i18n('icu:calling__presenting--permission-instruction-step3')}</li>
      </ol>
    </Modal>
  );
}
