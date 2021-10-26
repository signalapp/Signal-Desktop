// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import type { LocalizerType } from '../types/Util';
import type { WidthBreakpoint } from './_util';

import { LeftPaneDialog } from './LeftPaneDialog';
import { openLinkInWebBrowser } from '../util/openLinkInWebBrowser';

type PropsType = {
  containerWidthBreakpoint: WidthBreakpoint;
  hasExpired: boolean;
  i18n: LocalizerType;
};

export const DialogExpiredBuild = ({
  containerWidthBreakpoint,
  hasExpired,
  i18n,
}: PropsType): JSX.Element | null => {
  if (!hasExpired) {
    return null;
  }

  return (
    <LeftPaneDialog
      containerWidthBreakpoint={containerWidthBreakpoint}
      type="error"
      onClick={() => {
        openLinkInWebBrowser('https://signal.org/download/');
      }}
      clickLabel={i18n('upgrade')}
      hasAction
    >
      {i18n('expiredWarning')}{' '}
    </LeftPaneDialog>
  );
};
