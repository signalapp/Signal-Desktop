// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState } from 'react';
import { action } from '@storybook/addon-actions';

import type { Meta } from '@storybook/react';
import type { PropsType } from './CrashReportDialog.dom.js';
import { CrashReportDialog } from './CrashReportDialog.dom.js';
import { sleep } from '../util/sleep.std.js';

export default {
  title: 'Components/CrashReportDialog',
} satisfies Meta<PropsType>;

const { i18n } = window.SignalContext;

export function Basic(): JSX.Element {
  const [isPending, setIsPending] = useState(false);

  return (
    <CrashReportDialog
      i18n={i18n}
      isPending={isPending}
      writeCrashReportsToLog={async () => {
        setIsPending(true);
        action('writeCrashReportsToLog')();
        await sleep(5000);
        setIsPending(false);
      }}
      eraseCrashReports={action('eraseCrashReports')}
    />
  );
}
