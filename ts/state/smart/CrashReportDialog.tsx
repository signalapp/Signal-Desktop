// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { useSelector } from 'react-redux';
import React, { memo } from 'react';
import { CrashReportDialog } from '../../components/CrashReportDialog.dom.js';
import { getIntl } from '../selectors/user.std.js';
import { useCrashReportsActions } from '../ducks/crashReports.preload.js';
import { getCrashReportsIsPending } from '../selectors/crashReports.std.js';

export const SmartCrashReportDialog = memo(function SmartCrashReportDialog() {
  const i18n = useSelector(getIntl);
  const isPending = useSelector(getCrashReportsIsPending);
  const { writeCrashReportsToLog, eraseCrashReports } =
    useCrashReportsActions();
  return (
    <CrashReportDialog
      i18n={i18n}
      isPending={isPending}
      writeCrashReportsToLog={writeCrashReportsToLog}
      eraseCrashReports={eraseCrashReports}
    />
  );
});
