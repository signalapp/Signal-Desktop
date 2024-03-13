// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo } from 'react';
import { useSelector } from 'react-redux';
import { DialogNetworkStatus } from '../../components/DialogNetworkStatus';
import { getIntl } from '../selectors/user';
import type { WidthBreakpoint } from '../../components/_util';
import {
  getNetworkIsOnline,
  getNetworkIsOutage,
  getNetworkSocketStatus,
} from '../selectors/network';
import { useUserActions } from '../ducks/user';

type SmartNetworkStatusProps = Readonly<{
  containerWidthBreakpoint: WidthBreakpoint;
}>;

export const SmartNetworkStatus = memo(function SmartNetworkStatus({
  containerWidthBreakpoint,
}: SmartNetworkStatusProps) {
  const i18n = useSelector(getIntl);
  const isOnline = useSelector(getNetworkIsOnline);
  const isOutage = useSelector(getNetworkIsOutage);
  const socketStatus = useSelector(getNetworkSocketStatus);
  const { manualReconnect } = useUserActions();
  return (
    <DialogNetworkStatus
      containerWidthBreakpoint={containerWidthBreakpoint}
      i18n={i18n}
      isOnline={isOnline}
      isOutage={isOutage}
      socketStatus={socketStatus}
      manualReconnect={manualReconnect}
    />
  );
});
