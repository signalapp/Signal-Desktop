// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { memo, useCallback, useState, type JSX } from 'react';
import { useSelector } from 'react-redux';
import { ipcRenderer } from 'electron';
import { KeyTransparencyErrorDialog } from '../../components/KeyTransparencyErrorDialog.dom.tsx';
import { createSupportUrl } from '../../util/createSupportUrl.std.ts';
import { openLinkInWebBrowser } from '../../util/openLinkInWebBrowser.dom.ts';
import { useGlobalModalActions } from '../ducks/globalModals.preload.ts';
import { getIntl } from '../selectors/user.std.ts';

async function uploadDebugLogs(): Promise<string | null> {
  try {
    const logData = await ipcRenderer.invoke('fetch-log');
    const logs: string = await ipcRenderer.invoke(
      'DebugLogs.getLogs',
      logData,
      window.navigator.userAgent
    );
    const debugLogUrl = await ipcRenderer.invoke('DebugLogs.upload', logs);
    return debugLogUrl;
  } catch {
    // Ignore
    return null;
  }
}

export const SmartKeyTransparencyErrorDialog = memo(
  function SmartKeyTransparencyErrorDialog(): JSX.Element | null {
    const i18n = useSelector(getIntl);
    const { hideKeyTransparencyErrorDialog } = useGlobalModalActions();
    const [submitting, setSubmitting] = useState(false);

    const handleOpenChange = useCallback(
      (open: boolean) => {
        if (!open) {
          hideKeyTransparencyErrorDialog();
        }
      },
      [hideKeyTransparencyErrorDialog]
    );

    const handleSubmit = useCallback(
      async (shareDebugLog: boolean) => {
        setSubmitting(true);

        let debugLogUrl: string | null = null;
        if (shareDebugLog) {
          debugLogUrl = await uploadDebugLogs();
        }

        const supportURL = createSupportUrl({
          locale: window.SignalContext.getI18nLocale(),
          query: debugLogUrl ? { kt: debugLogUrl } : undefined,
        });

        openLinkInWebBrowser(supportURL);
        setSubmitting(false);
        hideKeyTransparencyErrorDialog();
      },
      [hideKeyTransparencyErrorDialog]
    );

    return (
      <KeyTransparencyErrorDialog
        i18n={i18n}
        open
        onOpenChange={handleOpenChange}
        onViewDebugLog={() => window.IPC.showDebugLog({ mode: 'close' })}
        onSubmit={handleSubmit}
        isSubmitting={submitting}
      />
    );
  }
);
