// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX } from 'react';
import type { LocalizerType } from '../types/Util.std.ts';
import { AxoConfirmDialog } from '../axo/AxoConfirmDialog.dom.tsx';

export type ErrorModalDataProps = Readonly<{
  title: string;
  description: string;
}>;

export type PropsType = Readonly<
  ErrorModalDataProps & {
    i18n: LocalizerType;
    onClose: () => void;
  }
>;

export function ErrorModal(props: PropsType): JSX.Element {
  const { i18n } = props;
  return (
    <AxoConfirmDialog.Root
      open
      onOpenChange={props.onClose}
      title={props.title}
      description={props.description}
    >
      <AxoConfirmDialog.Cancel>{i18n('icu:ok')}</AxoConfirmDialog.Cancel>
    </AxoConfirmDialog.Root>
  );
}
