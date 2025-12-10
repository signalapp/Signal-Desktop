// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { CallSummary } from '@signalapp/ringrtc';
import { DAY, MINUTE } from './durations/index.std.js';
import { isFeaturedEnabledNoRedux } from './isFeatureEnabled.dom.js';
import { isMockEnvironment } from '../environment.std.js';

const FAILURE_END_REASONS: ReadonlySet<string> = new Set([
  'internalFailure',
  'signalingFailure',
  'connectionFailure',
  'iceFailedAfterConnected',
]);

const SURVEY_COOLDOWN = DAY;
const SHORT_CALL_THRESHOLD = MINUTE;
const LONG_CALL_THRESHOLD = 25 * MINUTE;
const RANDOM_SAMPLE_RATE = 0.01; // 1%

export function isCallFailure(callEndReasonText: string): boolean {
  return FAILURE_END_REASONS.has(callEndReasonText);
}

export function isCallQualitySurveyEnabled(): boolean {
  return isFeaturedEnabledNoRedux({
    betaKey: 'desktop.callQualitySurvey.beta',
    prodKey: 'desktop.callQualitySurvey.prod',
  });
}

export function shouldShowCallQualitySurvey(
  callSummary: CallSummary,
  lastSurveyTime: number | null,
  lastFailureSurveyTime: number | null,
  bypassCooldown?: boolean
): boolean {
  if (
    isMockEnvironment() ||
    !isCallQualitySurveyEnabled() ||
    !callSummary.isSurveyCandidate
  ) {
    return false;
  }

  const now = Date.now();
  const isFailure = isCallFailure(callSummary.callEndReasonText);

  const canShowFailureSurvey =
    bypassCooldown ||
    lastFailureSurveyTime == null ||
    now - lastFailureSurveyTime > SURVEY_COOLDOWN;
  if (isFailure && canShowFailureSurvey) {
    return true;
  }

  const canShowGeneralSurvey =
    bypassCooldown ||
    lastSurveyTime == null ||
    now - lastSurveyTime > SURVEY_COOLDOWN;
  if (!canShowGeneralSurvey) {
    return false;
  }

  const callDuration = callSummary.endTime - callSummary.startTime;

  if (callDuration < SHORT_CALL_THRESHOLD) {
    return true;
  }

  if (callDuration > LONG_CALL_THRESHOLD) {
    return true;
  }

  return Math.random() < RANDOM_SAMPLE_RATE;
}
