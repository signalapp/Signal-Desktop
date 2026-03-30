// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { CallQualitySurveyDialog } from '../../components/CallQualitySurveyDialog.dom.tsx';
import { useCallingActions } from '../ducks/calling.preload.ts';
import { useGlobalModalActions } from '../ducks/globalModals.preload.ts';
import { getCallQualitySurveyProps } from '../selectors/globalModals.std.ts';
import { getIntl } from '../selectors/user.std.ts';
import type { CallQualitySurvey } from '../../types/CallQualitySurvey.std.ts';
import { strictAssert } from '../../util/assert.std.ts';
import type { StateType } from '../reducer.preload.ts';

const getCallQualitySurveySubmission = (state: StateType) =>
  state.calling.callQualitySurveySubmission;

export const SmartCallQualitySurveyDialog = memo(
  function SmartCallQualitySurveyDialog(): React.JSX.Element | null {
    const i18n = useSelector(getIntl);
    const props = useSelector(getCallQualitySurveyProps);
    strictAssert(props, 'Expected callQualitySurveyProps to be set');

    const { callSummary, callType } = props;

    const submissionState = useSelector(getCallQualitySurveySubmission);
    const isSubmitting = submissionState.state.status === 'loading';

    const { hideCallQualitySurvey } = useGlobalModalActions();
    const { submitCallQualitySurvey } = useCallingActions();

    const handleOpenChange = useCallback(
      (open: boolean) => {
        if (!open) {
          hideCallQualitySurvey();
        }
      },
      [hideCallQualitySurvey]
    );

    const handleSubmit = useCallback(
      (form: CallQualitySurvey.Form) => {
        submitCallQualitySurvey({
          userSatisfied: form.userSatisfied,
          callQualityIssues: Array.from(form.callQualityIssues),
          additionalIssuesDescription: form.additionalIssuesDescription,
          shareDebugLog: form.shareDebugLog,
          callSummary,
          callType,
        });
      },
      [submitCallQualitySurvey, callSummary, callType]
    );

    const handleViewDiagnosticInfo = useCallback(() => {
      window.IPC.showCallDiagnostic();
    }, []);

    return (
      <CallQualitySurveyDialog
        i18n={i18n}
        open
        onOpenChange={handleOpenChange}
        onSubmit={handleSubmit}
        onViewDebugLog={() => window.IPC.showDebugLog({ mode: 'close' })}
        onViewDiagnosticInfo={handleViewDiagnosticInfo}
        isSubmitting={isSubmitting}
      />
    );
  }
);
