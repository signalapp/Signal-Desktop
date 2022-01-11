// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState } from 'react';
import { action } from '@storybook/addon-actions';
import { storiesOf } from '@storybook/react';

import { CrashReportDialog } from './CrashReportDialog';
import { setupI18n } from '../util/setupI18n';
import { sleep } from '../util/sleep';
import enMessages from '../../_locales/en/messages.json';

const story = storiesOf('Components/CrashReportDialog', module);

const i18n = setupI18n('en', enMessages);

story.add('CrashReportDialog', () => {
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
});
