// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX } from 'react';
import type { LocalizerType } from '../types/Util.std.ts';
import { AxoConfirmDialog } from '../axo/AxoConfirmDialog.dom.tsx';

export type PropsType = Readonly<{
  i18n: LocalizerType;
  onCancelDonation: () => void;
  onRetryDonation: () => void;
}>;

export function DonationInterruptedModal(props: PropsType): JSX.Element {
  const { i18n } = props;
  return (
    <AxoConfirmDialog.Root
      open
      onOpenChange={props.onCancelDonation}
      title={i18n('icu:Donations__DonationInterrupted')}
      description={i18n('icu:Donations__DonationInterrupted__Description')}
    >
      <AxoConfirmDialog.Cancel />
      <AxoConfirmDialog.Action
        variant="primary"
        onClick={props.onRetryDonation}
      >
        {i18n('icu:Donations__DonationInterrupted__RetryButton')}
      </AxoConfirmDialog.Action>
    </AxoConfirmDialog.Root>
  );
}
