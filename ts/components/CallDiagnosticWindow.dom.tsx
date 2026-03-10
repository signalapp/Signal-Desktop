// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useMemo } from 'react';

import type { LocalizerType } from '../types/Util.std.js';
import { tw } from '../axo/tw.dom.js';
import { AxoButton } from '../axo/AxoButton.dom.js';
import { useEscapeHandling } from '../hooks/useEscapeHandling.dom.js';

export type PropsType = {
  closeWindow: () => unknown;
  i18n: LocalizerType;
  diagnosticData: string;
};

export function CallDiagnosticWindow({
  closeWindow,
  i18n,
  diagnosticData,
}: PropsType): React.JSX.Element {
  useEscapeHandling(closeWindow);

  const formattedData = useMemo(() => {
    try {
      const parsed = JSON.parse(diagnosticData);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { rawStats, rawStatsText, ...rest } = parsed;
      const pretty = {
        ...rest,
        rawStats: JSON.parse(rawStatsText),
      };
      return JSON.stringify(pretty, null, 2);
    } catch {
      return diagnosticData;
    }
  }, [diagnosticData]);

  return (
    <div
      className={tw(
        'flex h-screen flex-col bg-background-primary p-4 text-label-primary'
      )}
    >
      <div className={tw('mb-4')}>
        <h1 className={tw('type-title-medium font-semibold')}>
          {i18n('icu:CallDiagnosticWindow__title')}
        </h1>
      </div>
      <div
        className={tw(
          'min-h-0 flex-1 overflow-auto border border-border-secondary bg-background-secondary p-4'
        )}
      >
        <pre
          className={tw(
            'font-mono type-body-small whitespace-pre-wrap text-label-primary'
          )}
        >
          {formattedData}
        </pre>
      </div>
      <div className={tw('mt-4 flex justify-end')}>
        <AxoButton.Root onClick={closeWindow} variant="primary" size="md">
          {i18n('icu:close')}
        </AxoButton.Root>
      </div>
    </div>
  );
}
