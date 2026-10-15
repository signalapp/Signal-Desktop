// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX } from 'react';
import { AxoConfirmDialog } from '../axo/AxoConfirmDialog.dom.tsx';

export type ErrorModalDataProps = Readonly<{
  title: string;
  description: string;
}>;

export type PropsType = Readonly<
  ErrorModalDataProps & {
    onClose: () => void;
  }
>;

export function ErrorModal(props: PropsType): JSX.Element {
  return (
    <AxoConfirmDialog.Root
      open
      onOpenChange={props.onClose}
      title={props.title}
      description={props.description}
    >
      <AxoConfirmDialog.Ok />
    </AxoConfirmDialog.Root>
  );
}
