// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import type { LocalizerType } from '../../types/Util.std.js';
import { SystemMessage } from './SystemMessage.dom.js';
import { Emojify } from './Emojify.dom.js';
import { getStringForPhoneNumberDiscovery } from '../../util/getStringForPhoneNumberDiscovery.std.js';
import {
  useSharedGroupNamesOnMount,
  type GetSharedGroupNamesType,
} from '../../util/sharedGroupNames.dom.js';

export type PropsDataType = {
  conversationId: string;
  conversationTitle: string;
  phoneNumber: string;
};
export type PropsType = PropsDataType & {
  getSharedGroupNames: GetSharedGroupNamesType;
  i18n: LocalizerType;
};

// Also known as a Session Switchover Event (SSE)
export function PhoneNumberDiscoveryNotification(
  props: PropsType
): React.JSX.Element {
  const {
    conversationId,
    conversationTitle,
    getSharedGroupNames,
    i18n,
    phoneNumber,
  } = props;

  const sharedGroupNames = useSharedGroupNamesOnMount(
    conversationId,
    getSharedGroupNames
  );
  const sharedGroup = sharedGroupNames[0];

  const message = getStringForPhoneNumberDiscovery({
    conversationTitle,
    i18n,
    phoneNumber,
    sharedGroup,
  });

  return <SystemMessage icon="info" contents={<Emojify text={message} />} />;
}
