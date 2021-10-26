// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { boolean } from '@storybook/addon-knobs';
import { storiesOf } from '@storybook/react';

import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';
import type { Props } from './VerificationNotification';
import { VerificationNotification } from './VerificationNotification';

const i18n = setupI18n('en', enMessages);

const story = storiesOf(
  'Components/Conversation/VerificationNotification',
  module
);

const contact = { title: 'Mr. Fire' };

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  i18n,
  type: overrideProps.type || 'markVerified',
  isLocal: boolean('isLocal', overrideProps.isLocal !== false),
  contact: overrideProps.contact || contact,
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

story.add('Long name', () => {
  const longName = '🎆🍬🏈'.repeat(50);

  const props = createProps({
    type: 'markVerified',
    contact: { title: longName },
  });

  return <VerificationNotification {...props} />;
});
