// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useState, useEffect, type JSX } from 'react';
import type { LocalizerType } from '../types/Util.std.ts';
import { ResolvedSendStatus } from '../types/Stories.std.ts';
import { usePreviousDeprecated } from './usePrevious.std.ts';
import { AxoConfirmDialog } from '../axo/AxoConfirmDialog.dom.tsx';

export function useRetryStorySend(
  i18n: LocalizerType,
  sendStatus: ResolvedSendStatus | undefined
): {
  hasAlert: boolean;
  renderAlert: () => JSX.Element | null;
  setWasManuallyRetried: (value: boolean) => unknown;
  wasManuallyRetried: boolean;
} {
  const [hasSendFailedAlert, setHasSendFailedAlert] = useState(false);
  const [wasManuallyRetried, setWasManuallyRetried] = useState(false);

  const previousSendStatus = usePreviousDeprecated(sendStatus, sendStatus);

  useEffect(() => {
    if (!wasManuallyRetried) {
      return;
    }

    if (previousSendStatus === sendStatus) {
      return;
    }

    if (
      sendStatus === ResolvedSendStatus.Failed ||
      sendStatus === ResolvedSendStatus.PartiallySent
    ) {
      setHasSendFailedAlert(true);
    }
  }, [previousSendStatus, sendStatus, wasManuallyRetried]);

  function renderAlert(): JSX.Element | null {
    return (
      <AxoConfirmDialog.Root
        open={hasSendFailedAlert}
        onOpenChange={() => setHasSendFailedAlert(false)}
        // @ts-expect-error ConfirmationDialog migration: Needs title
        title={null}
        description={i18n('icu:Stories__failed-send')}
      >
        <AxoConfirmDialog.Cancel>{i18n('icu:ok')}</AxoConfirmDialog.Cancel>
      </AxoConfirmDialog.Root>
    );
  }

  return {
    hasAlert: hasSendFailedAlert,
    renderAlert,
    setWasManuallyRetried,
    wasManuallyRetried,
  };
}
