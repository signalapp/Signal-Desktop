// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX } from 'react';
import type { LocalizerType } from '../types/Util.std.ts';
import { AxoConfirmDialog } from '../axo/AxoConfirmDialog.dom.tsx';

export type PropsType = Readonly<{
  i18n: LocalizerType;
  onClose: () => void;
}>;

export function DonationStillProcessingModal(props: PropsType): JSX.Element {
  const { i18n } = props;
  return (
    <AxoConfirmDialog.Root
      open
      onOpenChange={props.onClose}
      title={i18n('icu:Donations__StillProcessing')}
      description={i18n('icu:Donations__StillProcessing__Description')}
    >
      <AxoConfirmDialog.Cancel>{i18n('icu:ok')}</AxoConfirmDialog.Cancel>
    </AxoConfirmDialog.Root>
  );
}
