// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState, useEffect } from 'react';

import type { LocalizerType } from '../types/Util.std.js';
import { Alert } from '../components/Alert.dom.js';
import { ResolvedSendStatus } from '../types/Stories.std.js';
import { usePrevious } from './usePrevious.std.js';

export function useRetryStorySend(
  i18n: LocalizerType,
  sendStatus: ResolvedSendStatus | undefined
): {
  renderAlert: () => JSX.Element | null;
  setWasManuallyRetried: (value: boolean) => unknown;
  wasManuallyRetried: boolean;
} {
  const [hasSendFailedAlert, setHasSendFailedAlert] = useState(false);
  const [wasManuallyRetried, setWasManuallyRetried] = useState(false);

  const previousSendStatus = usePrevious(sendStatus, sendStatus);

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
    return hasSendFailedAlert ? (
      <Alert
        body={i18n('icu:Stories__failed-send')}
        i18n={i18n}
        onClose={() => setHasSendFailedAlert(false)}
      />
    ) : null;
  }

  return { renderAlert, setWasManuallyRetried, wasManuallyRetried };
}
