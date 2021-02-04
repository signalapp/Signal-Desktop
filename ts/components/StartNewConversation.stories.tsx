// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { text } from '@storybook/addon-knobs';
import { Props, StartNewConversation } from './StartNewConversation';

import { setup as setupI18n } from '../../js/modules/i18n';
import enMessages from '../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  i18n,
  onClick: action('onClick'),
  phoneNumber: text('phoneNumber', overrideProps.phoneNumber || ''),
});

const stories = storiesOf('Components/StartNewConversation', module);

stories.add('Full Phone Number', () => {
  const props = createProps({
    phoneNumber: '(202) 555-0011',
  });

  return <StartNewConversation {...props} />;
});

stories.add('Partial Phone Number', () => {
  const props = createProps({
    phoneNumber: '202',
  });

  return <StartNewConversation {...props} />;
});
