// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { LeftPaneDialog } from './LeftPaneDialog.dom.js';
import type { WidthBreakpoint } from './_util.std.js';
import type { LocalizerType } from '../types/I18N.std.js';
import { I18n } from './I18n.dom.js';

export type PropsType = {
  containerWidthBreakpoint: WidthBreakpoint;
  i18n: LocalizerType;
};

export const CRITICAL_IDLE_PRIMARY_DEVICE_SUPPORT_PAGE =
  'https://support.signal.org/hc/articles/8997185514138-Re-connect-your-primary-device-to-continue-using-Signal-Desktop';

export function CriticalIdlePrimaryDeviceDialog({
  containerWidthBreakpoint,
  i18n,
}: PropsType): JSX.Element {
  const learnMoreLink = (parts: Array<string | JSX.Element>) => (
    <a
      href={CRITICAL_IDLE_PRIMARY_DEVICE_SUPPORT_PAGE}
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
