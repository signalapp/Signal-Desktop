// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { JSX } from 'react';
import type { LocalizerType } from '../types/Util.std.ts';
import { AxoAlertDialog } from '../axo/AxoAlertDialog.dom.tsx';

export type PropsType = Readonly<{
  i18n: LocalizerType;
  isPending: boolean;
  onErase: () => void;
  onSend: () => void;
}>;

export function CrashReportDialog(props: Readonly<PropsType>): JSX.Element {
  const { i18n } = props;
  return (
    <AxoAlertDialog.Root open>
      <AxoAlertDialog.Content escape="cancel-is-destructive">
        <AxoAlertDialog.Body>
          <AxoAlertDialog.Title>
            {i18n('icu:CrashReportDialog__title')}
          </AxoAlertDialog.Title>
          <AxoAlertDialog.Description>
            {i18n('icu:CrashReportDialog__body')}
          </AxoAlertDialog.Description>
        </AxoAlertDialog.Body>
        <AxoAlertDialog.Footer>
          <AxoAlertDialog.Action
            disabled={props.isPending}
            variant="secondary"
            onClick={props.onErase}
          >
            {i18n('icu:CrashReportDialog__erase')}
          </AxoAlertDialog.Action>
          <AxoAlertDialog.Action
            autoFocus
            disabled={props.isPending}
            variant="primary"
            onClick={props.onSend}
          >
            {i18n('icu:CrashReportDialog__submit')}
          </AxoAlertDialog.Action>
        </AxoAlertDialog.Footer>
      </AxoAlertDialog.Content>
    </AxoAlertDialog.Root>
  );
}
