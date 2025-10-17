// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo } from 'react';
import { useSelector } from 'react-redux';
import { UniversalTimerNotification } from '../../components/conversation/UniversalTimerNotification.dom.js';
import { getIntl } from '../selectors/user.std.js';
import { getUniversalExpireTimer } from '../selectors/items.dom.js';

export const SmartUniversalTimerNotification = memo(
  function SmartUniversalTimerNotification() {
    const i18n = useSelector(getIntl);
    const expireTimer = useSelector(getUniversalExpireTimer);
    return <UniversalTimerNotification i18n={i18n} expireTimer={expireTimer} />;
  }
);
