// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import type { LocalizerType } from '../types/Util';
import type { WidthBreakpoint } from './_util';

import { LeftPaneDialog } from './LeftPaneDialog';
import { openLinkInWebBrowser } from '../util/openLinkInWebBrowser';

export type PropsType = {
  containerWidthBreakpoint: WidthBreakpoint;
  i18n: LocalizerType;
};

export function DialogExpiredBuild({
  containerWidthBreakpoint,
  i18n,
}: PropsType): JSX.Element | null {
  return (
    <LeftPaneDialog
      containerWidthBreakpoint={containerWidthBreakpoint}
      type="error"
      onClick={() => {
        openLinkInWebBrowser('https://signal.org/download/');
      }}
      clickLabel={i18n('icu:upgrade')}
      hasAction
    >
      {i18n('icu:expiredWarning')}{' '}
    </LeftPaneDialog>
  );
}
