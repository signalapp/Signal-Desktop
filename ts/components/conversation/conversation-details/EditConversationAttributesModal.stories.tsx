// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { ComponentProps } from 'react';

import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import { setup as setupI18n } from '../../../../js/modules/i18n';
import enMessages from '../../../../_locales/en/messages.json';
import { EditConversationAttributesModal } from './EditConversationAttributesModal';
import { RequestState } from './util';

const i18n = setupI18n('en', enMessages);

const story = storiesOf(
  'Components/Conversation/ConversationDetails/EditConversationAttributesModal',
  module
);

type PropsType = ComponentProps<typeof EditConversationAttributesModal>;

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  avatarPath: undefined,
  i18n,
  onClose: action('onClose'),
  makeRequest: action('onMakeRequest'),
  requestState: RequestState.Inactive,
  title: 'Bing Bong Group',
  ...overrideProps,
});

story.add('No avatar, empty title', () => (
  <EditConversationAttributesModal {...createProps({ title: '' })} />
));

story.add('Avatar and title', () => (
  <EditConversationAttributesModal
    {...createProps({
      avatarPath: '/fixtures/kitten-3-64-64.jpg',
    })}
  />
));

story.add('Request active', () => (
  <EditConversationAttributesModal
    {...createProps({ requestState: RequestState.Active })}
  />
));

story.add('Has error', () => (
  <EditConversationAttributesModal
    {...createProps({ requestState: RequestState.InactiveWithError })}
  />
));
