// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import type { Meta } from '@storybook/react';
import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';
import type { PropsType } from './PhoneNumberDiscoveryNotification';
import { PhoneNumberDiscoveryNotification } from './PhoneNumberDiscoveryNotification';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/Conversation/PhoneNumberDiscoveryNotification',
} satisfies Meta<PropsType>;

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  i18n,
  conversationTitle: overrideProps.conversationTitle || 'John Fire',
  phoneNumber: '(555) 333-1111',
});

export function WithoutSharedGroup(): JSX.Element {
  return <PhoneNumberDiscoveryNotification {...createProps()} />;
}

export function WithSharedGroup(): JSX.Element {
  return (
    <PhoneNumberDiscoveryNotification
      {...createProps()}
      sharedGroup="Fun Times"
    />
  );
}
