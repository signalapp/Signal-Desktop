// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { useSelector } from 'react-redux';

import { UnsupportedOSDialog } from '../../components/UnsupportedOSDialog';
import { getIntl } from '../selectors/user';
import { getExpirationTimestamp } from '../selectors/expiration';
import type { WidthBreakpoint } from '../../components/_util';
import { getName as getOSName } from '../../OS';

export type PropsType = Readonly<{
  type: 'warning' | 'error';
  containerWidthBreakpoint: WidthBreakpoint;
}>;

export function SmartUnsupportedOSDialog(ownProps: PropsType): JSX.Element {
  const i18n = useSelector(getIntl);
  const expirationTimestamp = useSelector(getExpirationTimestamp);
  const OS = getOSName();

  return (
    <UnsupportedOSDialog
      {...ownProps}
      i18n={i18n}
      expirationTimestamp={expirationTimestamp}
      OS={OS}
    />
  );
}
