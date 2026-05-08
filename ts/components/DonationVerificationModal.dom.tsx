// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { JSX, MouseEvent } from 'react';
import { useEffect, useState, useCallback } from 'react';
import type { LocalizerType } from '../types/Util.std.ts';
import { DAY } from '../util/durations/index.std.ts';
import { AxoConfirmDialog } from '../axo/AxoConfirmDialog.dom.tsx';
import { useTimers } from '../axo/timers.dom.tsx';

export type PropsType = Readonly<{
  // Test-only
  _timeout?: number;
  i18n: LocalizerType;
  onCancelDonation: () => void;
  onOpenBrowser: () => void;
  onTimedOut: () => void;
}>;

type Step = 'init' | 'opening' | 'reopening' | 'opened';

export function DonationVerificationModal(props: PropsType): JSX.Element {
  const { _timeout, i18n, onOpenBrowser, onTimedOut } = props;

  const [step, setStep] = useState<Step>('init');
  const expiresTimers = useTimers();
  const pendingTimers = useTimers();

  useEffect(() => {
    expiresTimers.add(_timeout ?? DAY, onTimedOut);
  }, [expiresTimers, _timeout, onTimedOut]);

  const handleClick = useCallback(
    (event: MouseEvent) => {
      event.preventDefault();
      setStep(prev => (prev === 'opened' ? 'reopening' : 'opening'));
      onOpenBrowser();

      pendingTimers.cancelAll();
      pendingTimers.add(3000, () => {
        setStep('opened');
      });
    },
    [pendingTimers, onOpenBrowser]
  );

  const hasOpened = step === 'opened' || step === 'reopening';
  const isOpening = step === 'opening' || step === 'reopening';

  return (
    <AxoConfirmDialog.Root
      open
      onOpenChange={props.onCancelDonation}
      title={
        hasOpened
          ? i18n('icu:Donations__3dsValidationNeeded--waiting')
          : i18n('icu:Donations__3dsValidationNeeded')
      }
      description={i18n('icu:Donations__3dsValidationNeeded__Description')}
      forceAlwaysBreakToSeparateLines
    >
      <AxoConfirmDialog.Cancel disabled={isOpening}>
        {i18n('icu:Donations__3dsValidationNeeded__CancelDonation')}
      </AxoConfirmDialog.Cancel>
      <AxoConfirmDialog.Action
        pending={isOpening}
        variant="primary"
        onClick={handleClick}
      >
        {hasOpened
          ? i18n('icu:Donations__3dsValidationNeeded__OpenBrowser--opened')
          : i18n('icu:Donations__3dsValidationNeeded__OpenBrowser')}
      </AxoConfirmDialog.Action>
    </AxoConfirmDialog.Root>
  );
}
