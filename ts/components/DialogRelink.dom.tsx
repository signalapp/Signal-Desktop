// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import type { LocalizerType } from '../types/Util.std.js';
import type { WidthBreakpoint } from './_util.std.js';

import { LeftPaneDialog } from './LeftPaneDialog.dom.js';

export type PropsType = {
  containerWidthBreakpoint: WidthBreakpoint;
  i18n: LocalizerType;
  relinkDevice: () => void;
};

export function DialogRelink({
  containerWidthBreakpoint,
  i18n,
  relinkDevice,
}: PropsType): JSX.Element | null {
  return (
    <LeftPaneDialog
      containerWidthBreakpoint={containerWidthBreakpoint}
      type="warning"
      icon="relink"
      clickLabel={i18n('icu:unlinkedWarning')}
      onClick={relinkDevice}
      title={i18n('icu:unlinked')}
      hasAction
    />
  );
}
