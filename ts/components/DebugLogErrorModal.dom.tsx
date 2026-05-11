// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { JSX } from 'react';
import type { LocalizerType } from '../types/Util.std.ts';
import { AxoConfirmDialog } from '../axo/AxoConfirmDialog.dom.tsx';

export type PropsType = Readonly<{
  description?: string;
  i18n: LocalizerType;
  onClose: () => void;
  onSubmitDebugLog: () => void;
}>;

export function DebugLogErrorModal(props: PropsType): JSX.Element {
  const { i18n } = props;
  return (
    <AxoConfirmDialog.Root
      open
      onOpenChange={props.onClose}
      title={i18n('icu:DebugLogErrorModal__UnexpectedError')}
      description={props.description || i18n('icu:ErrorModal--description')}
    >
      <AxoConfirmDialog.Cancel>
        {i18n('icu:DebugLogErrorModal__SubmitDebugLog__Cancel')}
      </AxoConfirmDialog.Cancel>
      <AxoConfirmDialog.Action
        autoFocus
        variant="primary"
        onClick={props.onSubmitDebugLog}
      >
        {i18n('icu:DebugLogErrorModal__SubmitDebugLog')}
      </AxoConfirmDialog.Action>
    </AxoConfirmDialog.Root>
  );
}
