// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';
import type { PropsType } from './PhoneNumberDiscoveryNotification';
import { PhoneNumberDiscoveryNotification } from './PhoneNumberDiscoveryNotification';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/Conversation/PhoneNumberDiscoveryNotification',
};

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  i18n,
  conversationTitle: overrideProps.conversationTitle || 'Mr. Fire',
  phoneNumber: overrideProps.phoneNumber || '+1 (000) 123-4567',
  sharedGroup: overrideProps.sharedGroup,
});

export function Basic(): JSX.Element {
  return <PhoneNumberDiscoveryNotification {...createProps()} />;
}

export function WithSharedGroup(): JSX.Element {
  return (
    <PhoneNumberDiscoveryNotification
      {...createProps({
        sharedGroup: 'Animal Lovers',
      })}
    />
  );
}
