// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { LeftPaneDialog } from './LeftPaneDialog';
import type { WidthBreakpoint } from './_util';
import type { LocalizerType } from '../types/I18N';
import { I18n } from './I18n';

export type PropsType = {
  containerWidthBreakpoint: WidthBreakpoint;
  i18n: LocalizerType;
};

export function CriticalIdlePrimaryDeviceDialog({
  containerWidthBreakpoint,
  i18n,
}: PropsType): JSX.Element {
  const learnMoreLink = (parts: Array<string | JSX.Element>) => (
    <a
      key="signal-support"
      // TODO: DESKTOP-8377
      href="https://support.signal.org/"
      rel="noreferrer"
      target="_blank"
    >
      {parts}
    </a>
  );
  return (
    <LeftPaneDialog
      containerWidthBreakpoint={containerWidthBreakpoint}
      type="warning"
      title={i18n('icu:CriticalIdlePrimaryDevice__title')}
    >
      <I18n
        id="icu:CriticalIdlePrimaryDevice__body"
        i18n={i18n}
        components={{
          learnMoreLink,
        }}
      />
    </LeftPaneDialog>
  );
}
