// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState } from 'react';
import { action } from '@storybook/addon-actions';

import type { Meta } from '@storybook/react';
import type { PropsType } from './CrashReportDialog';
import { CrashReportDialog } from './CrashReportDialog';
import { setupI18n } from '../util/setupI18n';
import { sleep } from '../util/sleep';
import enMessages from '../../_locales/en/messages.json';

export default {
  title: 'Components/CrashReportDialog',
} satisfies Meta<PropsType>;

const i18n = setupI18n('en', enMessages);

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
