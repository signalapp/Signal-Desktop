// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { SystemMessage } from './SystemMessage';
import type { LocalizerType } from '../../types/Util';

export const LinkNotification = ({
  i18n,
}: Readonly<{ i18n: LocalizerType }>): JSX.Element => (
  <SystemMessage icon="unsynced" contents={i18n('messageHistoryUnsynced')} />
);
