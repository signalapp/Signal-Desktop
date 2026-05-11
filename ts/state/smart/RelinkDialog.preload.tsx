// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { memo } from 'react';

import { useSelector } from 'react-redux';
import { DialogRelink } from '../../components/DialogRelink.dom.tsx';
import { areWePrimaryDevice, getIntl } from '../selectors/user.std.ts';
import { useNetworkActions } from '../ducks/network.dom.ts';

import type { WidthBreakpoint } from '../../components/_util.std.ts';
import { renderClearingDataView } from '../../shims/renderClearingDataView.preload.tsx';

type SmartRelinkDialogProps = Readonly<{
  containerWidthBreakpoint: WidthBreakpoint;
}>;

export const SmartRelinkDialog = memo(function SmartRelinkDialog({
  containerWidthBreakpoint,
}: SmartRelinkDialogProps) {
  const i18n = useSelector(getIntl);
  const { relinkDevice, reregister } = useNetworkActions();
  const weArePrimaryDevice = useSelector(areWePrimaryDevice);

  return (
    <DialogRelink
      i18n={i18n}
      containerWidthBreakpoint={containerWidthBreakpoint}
      relinkDevice={relinkDevice}
      renderClearingDataView={renderClearingDataView}
      reregister={reregister}
      weArePrimaryDevice={weArePrimaryDevice}
    />
  );
});
