// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import moment from 'moment';
import type { FormatXMLElementFn } from 'intl-messageformat';

import type { LocalizerType } from '../types/Util';
import { missingCaseError } from '../util/missingCaseError';
import type { WidthBreakpoint } from './_util';
import { Intl } from './Intl';

import { LeftPaneDialog } from './LeftPaneDialog';

export type PropsType = {
  containerWidthBreakpoint: WidthBreakpoint;
  expirationTimestamp: number;
  i18n: LocalizerType;
  type: 'warning' | 'error';
  OS: string;
};

const SUPPORT_URL = 'https://support.signal.org/hc/articles/5109141421850';

export function UnsupportedOSDialog({
  containerWidthBreakpoint,
  expirationTimestamp,
  i18n,
  type,
  OS,
}: PropsType): JSX.Element | null {
  const learnMoreLink: FormatXMLElementFn<JSX.Element | string> = children => (
    <a key="signal-support" href={SUPPORT_URL} rel="noreferrer" target="_blank">
      {children}
    </a>
  );

  let body: JSX.Element;
  if (type === 'error') {
    body = (
      <Intl
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
      <Intl
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
