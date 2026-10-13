// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { useEffect, type ReactNode } from 'react';
import type { LocalizerType } from '../types/Util.std.ts';
import { SpinnerV2 } from './SpinnerV2.dom.tsx';
import { SECOND } from '../util/durations/index.std.ts';
import { AxoDialog } from '../axo/AxoDialog.dom.tsx';
import { tw } from '../axo/tw.dom.tsx';
import { useTimers } from '../axo/timers.dom.tsx';

export type DonationProgressModalProps = Readonly<{
  i18n: LocalizerType;
  onWaitedTooLong: () => void;
}>;

export function DonationProgressModal(
  props: DonationProgressModalProps
): ReactNode {
  const { i18n, onWaitedTooLong } = props;
  const timers = useTimers();

  useEffect(() => {
    return timers.add(SECOND * 30, onWaitedTooLong);
  }, [timers, onWaitedTooLong]);

  return (
    <AxoDialog.Root open>
      <AxoDialog.Content size="sm" escape="cancel-is-destructive">
        <AxoDialog.Body>
          <div className={tw('mb-2.5 flex justify-center')}>
            <SpinnerV2 size={58} strokeWidth={4} variant="brand" />
          </div>
          <div className={tw('text-center type-body-medium text-secondary')}>
            {i18n('icu:Donations__Processing')}
          </div>
        </AxoDialog.Body>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}
