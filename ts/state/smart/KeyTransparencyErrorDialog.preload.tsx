// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo, useCallback, useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { ipcRenderer } from 'electron';
import lodash from 'lodash';
import { KeyTransparencyErrorDialog } from '../../components/KeyTransparencyErrorDialog.dom.js';
import { createSupportUrl } from '../../util/createSupportUrl.std.js';
import { openLinkInWebBrowser } from '../../util/openLinkInWebBrowser.dom.js';
import { drop } from '../../util/drop.std.js';
import { useGlobalModalActions } from '../ducks/globalModals.preload.js';
import { getIntl } from '../selectors/user.std.js';

const { noop } = lodash;

export const SmartKeyTransparencyErrorDialog = memo(
  function SmartKeyTransparencyErrorDialog(): React.JSX.Element | null {
    const i18n = useSelector(getIntl);
    const { hideKeyTransparencyErrorDialog } = useGlobalModalActions();
    const [request, setRequest] = useState<
      | undefined
      | Readonly<{
          shareDebugLog: boolean;
        }>
    >();

    const handleOpenChange = useCallback(
      (open: boolean) => {
        if (!open) {
          hideKeyTransparencyErrorDialog();
        }
      },
      [hideKeyTransparencyErrorDialog]
    );

    const handleSubmit = useCallback((shareDebugLog: boolean) => {
      setRequest({ shareDebugLog });
    }, []);

    useEffect(() => {
      if (request === undefined) {
        return noop;
      }

      let canceled = false;

      drop(
        (async () => {
          const query: Record<string, string> = {
            kt: '',
          };

          if (request.shareDebugLog) {
            try {
              const logData = await ipcRenderer.invoke('fetch-log');
              const logs: string = await ipcRenderer.invoke(
                'DebugLogs.getLogs',
                logData,
                window.navigator.userAgent
              );
              if (canceled) {
                return;
              }
              query.debugLog = await ipcRenderer.invoke(
                'DebugLogs.upload',
                logs
              );
              if (canceled) {
                return;
              }
            } catch {
              // Ignore
            }
          }

          const supportURL = createSupportUrl({
            locale: window.SignalContext.getI18nLocale(),
            query,
          });

          openLinkInWebBrowser(supportURL);

          setRequest(undefined);
          hideKeyTransparencyErrorDialog();
        })()
      );

      return () => {
        canceled = true;
      };
    }, [request, hideKeyTransparencyErrorDialog]);

    return (
      <KeyTransparencyErrorDialog
        i18n={i18n}
        open
        onOpenChange={handleOpenChange}
        onViewDebugLog={() => window.IPC.showDebugLog({ mode: 'close' })}
        onSubmit={handleSubmit}
        isSubmitting={request !== undefined}
      />
    );
  }
);
