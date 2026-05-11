// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX } from 'react';
import type { LocalizerType } from '../types/Util.std.ts';
import { tw } from '../axo/tw.dom.tsx';
import { AxoAlertDialog } from '../axo/AxoAlertDialog.dom.tsx';

type PropsType = {
  i18n: LocalizerType;
  openSystemPreferencesAction: () => unknown;
  toggleScreenRecordingPermissionsDialog: () => unknown;
};

export function NeedsScreenRecordingPermissionsModal({
  i18n,
  openSystemPreferencesAction,
  toggleScreenRecordingPermissionsDialog,
}: PropsType): JSX.Element {
  return (
    <AxoAlertDialog.Root
      open
      onOpenChange={toggleScreenRecordingPermissionsDialog}
    >
      <AxoAlertDialog.Content escape="cancel-is-noop">
        <AxoAlertDialog.Body>
          <AxoAlertDialog.Title>
            {i18n('icu:calling__presenting--permission-title')}
          </AxoAlertDialog.Title>
          <AxoAlertDialog.Description>
            <p className={tw('mb-2')}>
              {i18n('icu:calling__presenting--macos-permission-description')}
            </p>
            <ol className={tw('flex list-inside list-decimal flex-col gap-1')}>
              <li>
                {i18n('icu:calling__presenting--permission-instruction-step1')}
              </li>
              <li>
                {i18n('icu:calling__presenting--permission-instruction-step2')}
              </li>
              <li>
                {i18n('icu:calling__presenting--permission-instruction-step3')}
              </li>
            </ol>
          </AxoAlertDialog.Description>
        </AxoAlertDialog.Body>
        <AxoAlertDialog.Footer>
          <AxoAlertDialog.Cancel>
            {i18n('icu:calling__presenting--permission-cancel')}
          </AxoAlertDialog.Cancel>
          <AxoAlertDialog.Action
            variant="primary"
            onClick={() => {
              openSystemPreferencesAction();
              toggleScreenRecordingPermissionsDialog();
            }}
          >
            {i18n('icu:calling__presenting--permission-open')}
          </AxoAlertDialog.Action>
        </AxoAlertDialog.Footer>
      </AxoAlertDialog.Content>
    </AxoAlertDialog.Root>
  );
}
