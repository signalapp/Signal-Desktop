// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { JSX } from 'react';
import type { LocalizerType } from '../types/Util.std.ts';
import { AxoConfirmDialog } from '../axo/AxoConfirmDialog.dom.tsx';

export type TapToViewNotAvailableModalData = {
  type: TapToViewNotAvailableType;
  parameters: {
    name: string;
  };
};

export type TapToViewNotAvailableModalProps = Readonly<
  TapToViewNotAvailableModalData & {
    i18n: LocalizerType;
    onClose: () => void;
  }
>;

export enum TapToViewNotAvailableType {
  Error = 'Error',
  Expired = 'Expired',
}

export function TapToViewNotAvailableModal(
  props: TapToViewNotAvailableModalProps
): JSX.Element {
  const { i18n, parameters, type } = props;
  return (
    <AxoConfirmDialog.Root
      open
      onOpenChange={props.onClose}
      // @ts-expect-error ConfirmationDialog migration: Needs title
      title={null}
      description={
        type === TapToViewNotAvailableType.Expired
          ? i18n('icu:TapToViewNotAvailableModal__body--expired', parameters)
          : i18n('icu:TapToViewNotAvailableModal__body--error', parameters)
      }
    >
      <AxoConfirmDialog.Cancel>{i18n('icu:ok')}</AxoConfirmDialog.Cancel>
    </AxoConfirmDialog.Root>
  );
}
