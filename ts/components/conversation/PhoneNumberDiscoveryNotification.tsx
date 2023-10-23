// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import type { LocalizerType } from '../../types/Util';
import { SystemMessage } from './SystemMessage';
import { Emojify } from './Emojify';
import { getStringForPhoneNumberDiscovery } from '../../util/getStringForPhoneNumberDiscovery';

export type PropsDataType = {
  conversationTitle: string;
  phoneNumber: string;
  sharedGroup?: string;
};
export type PropsType = PropsDataType & {
  i18n: LocalizerType;
};

// Also known as a Session Switchover Event (SSE)
export function PhoneNumberDiscoveryNotification(
  props: PropsType
): JSX.Element {
  const { conversationTitle, i18n, sharedGroup, phoneNumber } = props;

  const message = getStringForPhoneNumberDiscovery({
    conversationTitle,
    i18n,
    phoneNumber,
    sharedGroup,
  });

  return <SystemMessage icon="info" contents={<Emojify text={message} />} />;
}
