// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { boolean } from '@storybook/addon-knobs';

import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';
import type { Props } from './ScrollDownButton';
import { ScrollDownButton } from './ScrollDownButton';

const i18n = setupI18n('en', enMessages);

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  i18n,
  withNewMessages: boolean(
    'withNewMessages',
    overrideProps.withNewMessages || false
  ),
  scrollDown: action('scrollDown'),
  conversationId: 'fake-conversation-id',
});

const stories = storiesOf('Components/Conversation/ScrollDownButton', module);

stories.add('No New Messages', () => {
  const props = createProps();

  return <ScrollDownButton {...props} />;
});

stories.add('New Messages', () => {
  const props = createProps({ withNewMessages: true });

  return <ScrollDownButton {...props} />;
});
