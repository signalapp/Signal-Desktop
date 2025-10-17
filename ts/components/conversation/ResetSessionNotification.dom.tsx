// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import type { LocalizerType } from '../../types/Util.std.js';
import { SystemMessage } from './SystemMessage.dom.js';

export type Props = {
  i18n: LocalizerType;
};

export function ResetSessionNotification({ i18n }: Props): JSX.Element {
  return (
    <SystemMessage contents={i18n('icu:sessionEnded')} icon="session-refresh" />
  );
}
