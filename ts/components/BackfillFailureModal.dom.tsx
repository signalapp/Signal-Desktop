// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { JSX } from 'react';
import type { LocalizerType } from '../types/Util.std.ts';
import { missingCaseError } from '../util/missingCaseError.std.ts';
import { AxoConfirmDialog } from '../axo/AxoConfirmDialog.dom.tsx';

export enum BackfillFailureModalKind {
  Timeout = 'Timeout',
  NotFound = 'NotFound',
}

export type PropsType = Readonly<{
  i18n: LocalizerType;
  kind: BackfillFailureModalKind;
  onClose: () => void;
}>;

export function BackfillFailureModal(props: PropsType): JSX.Element {
  const { i18n, kind, onClose } = props;

  let body: string;
  if (kind === BackfillFailureModalKind.Timeout) {
    body = i18n('icu:BackfillFailureModal__body--timeout');
  } else if (kind === BackfillFailureModalKind.NotFound) {
    body = i18n('icu:BackfillFailureModal__body--not-found');
  } else {
    throw missingCaseError(kind);
  }

  return (
    <AxoConfirmDialog.Root
      open
      onOpenChange={onClose}
      title={i18n('icu:BackfillFailureModal__title')}
      description={body}
    >
      <AxoConfirmDialog.Cancel>{i18n('icu:ok')}</AxoConfirmDialog.Cancel>
    </AxoConfirmDialog.Root>
  );
}
