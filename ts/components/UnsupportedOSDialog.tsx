// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import moment from 'moment';

import type { LocalizerType } from '../types/Util';
import { UNSUPPORTED_OS_URL } from '../types/support';
import { missingCaseError } from '../util/missingCaseError';
import type { WidthBreakpoint } from './_util';
import { I18n } from './I18n';

import { LeftPaneDialog } from './LeftPaneDialog';

export type PropsType = {
  containerWidthBreakpoint: WidthBreakpoint;
  expirationTimestamp: number;
  i18n: LocalizerType;
  type: 'warning' | 'error';
  OS: string;
};

export function UnsupportedOSDialog({
  containerWidthBreakpoint,
  expirationTimestamp,
  i18n,
  type,
  OS,
}: PropsType): JSX.Element | null {
  const learnMoreLink = (parts: Array<string | JSX.Element>) => (
    <a
      key="signal-support"
      href={UNSUPPORTED_OS_URL}
      rel="noreferrer"
      target="_blank"
    >
      {parts}
    </a>
  );

  let body: JSX.Element;
  if (type === 'error') {
    body = (
      <I18n
        id="icu:UnsupportedOSErrorDialog__body"
        i18n={i18n}
        components={{
          OS,
          learnMoreLink,
        }}
      />
    );
  } else if (type === 'warning') {
    body = (
      <I18n
        id="icu:UnsupportedOSWarningDialog__body"
        i18n={i18n}
        components={{
          OS,
          expirationDate: moment(expirationTimestamp).format('ll'),
          learnMoreLink,
        }}
      />
    );
  } else {
    throw missingCaseError(type);
  }

  return (
    <LeftPaneDialog
      containerWidthBreakpoint={containerWidthBreakpoint}
      type={type}
    >
      <span>{body}</span>
    </LeftPaneDialog>
  );
}
