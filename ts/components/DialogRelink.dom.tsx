// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX } from 'react';

import type { LocalizerType } from '../types/Util.std.ts';
import type { WidthBreakpoint } from './_util.std.ts';

import { LeftPaneDialog } from './LeftPaneDialog.dom.tsx';

export type PropsType = {
  containerWidthBreakpoint: WidthBreakpoint;
  i18n: LocalizerType;
  relinkDevice: () => void;
  reregister: () => void;
  weArePrimaryDevice: boolean;
};

export function DialogRelink({
  containerWidthBreakpoint,
  i18n,
  relinkDevice,
  reregister,
  weArePrimaryDevice,
}: PropsType): JSX.Element | null {
  if (weArePrimaryDevice) {
    return (
      <LeftPaneDialog
        containerWidthBreakpoint={containerWidthBreakpoint}
        type="warning"
        icon="relink"
        clickLabel={i18n('icu:unregisteredWarning')}
        onClick={reregister}
        title={i18n('icu:unregistered')}
        hasAction
      />
    );
  }

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
