// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { boolean } from '@storybook/addon-knobs';
import { storiesOf } from '@storybook/react';

import { setup as setupI18n } from '../../../js/modules/i18n';
import enMessages from '../../../_locales/en/messages.json';
import { Props, VerificationNotification } from './VerificationNotification';

const i18n = setupI18n('en', enMessages);

const story = storiesOf(
  'Components/Conversation/VerificationNotification',
  module
);

const contact = {
  title: 'Mr. Fire',
  phoneNumber: '(202) 555-0003',
  profileName: 'Mr. Fire',
};

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  i18n,
  type: overrideProps.type || 'markVerified',
  isLocal: boolean('isLocal', overrideProps.isLocal !== false),
  contact,
});

story.add('Mark as Verified', () => {
  const props = createProps({ type: 'markVerified' });

  return <VerificationNotification {...props} />;
});

story.add('Mark as Not Verified', () => {
  const props = createProps({ type: 'markNotVerified' });

  return <VerificationNotification {...props} />;
});

story.add('Mark as Verified Remotely', () => {
  const props = createProps({ type: 'markVerified', isLocal: false });

  return <VerificationNotification {...props} />;
});

story.add('Mark as Not Verified Remotely', () => {
  const props = createProps({ type: 'markNotVerified', isLocal: false });

  return <VerificationNotification {...props} />;
});
