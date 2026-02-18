// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import type { Meta } from '@storybook/react';
import type { PropsType } from './PhoneNumberDiscoveryNotification.dom.js';
import { PhoneNumberDiscoveryNotification } from './PhoneNumberDiscoveryNotification.dom.js';
import type { GetSharedGroupNamesType } from '../../util/sharedGroupNames.dom.js';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/Conversation/PhoneNumberDiscoveryNotification',
} satisfies Meta<PropsType>;

const createMockGetSharedGroupNames =
  (sharedGroupNames: ReadonlyArray<string>): GetSharedGroupNamesType =>
  (_state, _conversationId) =>
    sharedGroupNames;

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  conversationId: 'fake-conversation-id',
  conversationTitle: overrideProps.conversationTitle || 'John Fire',
  getSharedGroupNames: createMockGetSharedGroupNames([]),
  i18n,
  phoneNumber: '(555) 333-1111',
});

export function WithoutSharedGroup(): React.JSX.Element {
  return <PhoneNumberDiscoveryNotification {...createProps()} />;
}

export function WithSharedGroup(): React.JSX.Element {
  return (
    <PhoneNumberDiscoveryNotification
      {...createProps()}
      getSharedGroupNames={createMockGetSharedGroupNames(['Fun Times'])}
    />
  );
}
