// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState } from 'react';
import { action } from '@storybook/addon-actions';

import { CrashReportDialog } from './CrashReportDialog';
import { setupI18n } from '../util/setupI18n';
import { sleep } from '../util/sleep';
import enMessages from '../../_locales/en/messages.json';

export default {
  title: 'Components/CrashReportDialog',
};

const i18n = setupI18n('en', enMessages);

export const _CrashReportDialog = (): JSX.Element => {
  const [isPending, setIsPending] = useState(false);

  return (
    <CrashReportDialog
      i18n={i18n}
      isPending={isPending}
      uploadCrashReports={async () => {
        setIsPending(true);
        action('uploadCrashReports')();
        await sleep(5000);
        setIsPending(false);
      }}
      eraseCrashReports={action('eraseCrashReports')}
    />
  );
};

_CrashReportDialog.story = {
  name: 'CrashReportDialog',
};
