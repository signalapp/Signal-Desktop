// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo } from 'react';
import { useSelector } from 'react-redux';
import { DialogRelink } from '../../components/DialogRelink';
import { getIntl } from '../selectors/user';
import type { WidthBreakpoint } from '../../components/_util';
import { useNetworkActions } from '../ducks/network';

type SmartRelinkDialogProps = Readonly<{
  containerWidthBreakpoint: WidthBreakpoint;
}>;

export const SmartRelinkDialog = memo(function SmartRelinkDialog({
  containerWidthBreakpoint,
}: SmartRelinkDialogProps) {
  const i18n = useSelector(getIntl);
  const { relinkDevice } = useNetworkActions();
  return (
    <DialogRelink
      i18n={i18n}
      containerWidthBreakpoint={containerWidthBreakpoint}
      relinkDevice={relinkDevice}
    />
  );
});
