// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { CallSummary } from '@signalapp/ringrtc';
import { DAY, SECOND } from './durations/index.std.js';
import { isFeaturedEnabledNoRedux } from './isFeatureEnabled.dom.js';
import { isMockEnvironment } from '../environment.std.js';
import {
  COUNTRY_CODE_FALLBACK,
  getCountryCodeValue,
  getValue,
} from '../RemoteConfig.dom.js';
import { getCountryCode } from '../types/PhoneNumber.std.js';
import { createLogger } from '../logging/log.std.js';

const log = createLogger('callQualitySurvey');

const FAILURE_END_REASONS: ReadonlySet<string> = new Set([
  'internalFailure',
  'signalingFailure',
  'connectionFailure',
  'iceFailedAfterConnected',
]);

const SURVEY_COOLDOWN = DAY;
const TEST_SHORT_CALL_THRESHOLD = 30 * SECOND;
const DEFAULT_PPM = 10000; // 1% default

export function isCallFailure(callEndReasonText: string): boolean {
  return FAILURE_END_REASONS.has(callEndReasonText);
}

export function isCallQualitySurveyEnabled(): boolean {
  return isFeaturedEnabledNoRedux({
    betaKey: 'desktop.callQualitySurvey.beta',
    prodKey: 'desktop.callQualitySurvey.prod',
  });
}

export function shouldShowCallQualitySurvey({
  callSummary,
  lastSurveyTime,
  lastFailureSurveyTime,
  e164,
  cqsTestMode,
}: {
  callSummary: CallSummary;
  lastSurveyTime: number | null;
  lastFailureSurveyTime: number | null;
  e164: string | undefined;
  cqsTestMode?: boolean;
}): boolean {
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
    cqsTestMode ||
    lastFailureSurveyTime == null ||
    now - lastFailureSurveyTime > SURVEY_COOLDOWN;
  if (isFailure && canShowFailureSurvey) {
    return true;
  }

  const canShowGeneralSurvey =
    cqsTestMode ||
    lastSurveyTime == null ||
    now - lastSurveyTime > SURVEY_COOLDOWN;
  if (!canShowGeneralSurvey) {
    return false;
  }

  const callDuration = callSummary.endTime - callSummary.startTime;

  if (cqsTestMode && callDuration < TEST_SHORT_CALL_THRESHOLD) {
    return true;
  }

  return Math.random() < getCallQualitySurveyPPM(e164) / 1_000_000;
}

function getCallQualitySurveyPPM(e164: string | undefined): number {
  const configValue = getValue('desktop.callQualitySurveyPPM');
  if (typeof configValue !== 'string') {
    return DEFAULT_PPM;
  }

  const countryCode = e164 != null ? getCountryCode(e164) : null;
  const ppm = getCountryCodeValue(
    countryCode ?? COUNTRY_CODE_FALLBACK,
    configValue,
    'callQualitySurveyPPM'
  );

  if (ppm == null) {
    log.error('getCallQualitySurveyPPM: Could not get PPM from remote config');
    return DEFAULT_PPM;
  }

  return ppm;
}
