// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { useSelector } from 'react-redux';
import React, { memo } from 'react';
import { CrashReportDialog } from '../../components/CrashReportDialog';
import { getIntl } from '../selectors/user';
import { useCrashReportsActions } from '../ducks/crashReports';
import { getCrashReportsIsPending } from '../selectors/crashReports';

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
