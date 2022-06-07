// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ComponentProps } from 'react';
import React from 'react';

import { action } from '@storybook/addon-actions';

import { setupI18n } from '../../../util/setupI18n';
import enMessages from '../../../../_locales/en/messages.json';
import { EditConversationAttributesModal } from './EditConversationAttributesModal';
import { RequestState } from './util';

const i18n = setupI18n('en', enMessages);

export default {
  title:
    'Components/Conversation/ConversationDetails/EditConversationAttributesModal',
};

type PropsType = ComponentProps<typeof EditConversationAttributesModal>;

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  avatarPath: undefined,
  conversationId: '123',
  i18n,
  initiallyFocusDescription: false,
  onClose: action('onClose'),
  makeRequest: action('onMakeRequest'),
  requestState: RequestState.Inactive,
  title: 'Bing Bong Group',
  deleteAvatarFromDisk: action('deleteAvatarFromDisk'),
  replaceAvatar: action('replaceAvatar'),
  saveAvatarToDisk: action('saveAvatarToDisk'),
  userAvatarData: [],
  ...overrideProps,
});

export const NoAvatarEmptyTitle = (): JSX.Element => (
  <EditConversationAttributesModal {...createProps({ title: '' })} />
);

NoAvatarEmptyTitle.story = {
  name: 'No avatar, empty title',
};

export const AvatarAndTitle = (): JSX.Element => (
  <EditConversationAttributesModal
    {...createProps({
      avatarPath: '/fixtures/kitten-3-64-64.jpg',
    })}
  />
);

AvatarAndTitle.story = {
  name: 'Avatar and title',
};

export const InitiallyFocusingDescription = (): JSX.Element => (
  <EditConversationAttributesModal
    {...createProps({ title: 'Has title', initiallyFocusDescription: true })}
  />
);

InitiallyFocusingDescription.story = {
  name: 'Initially focusing description',
};

export const RequestActive = (): JSX.Element => (
  <EditConversationAttributesModal
    {...createProps({ requestState: RequestState.Active })}
  />
);

RequestActive.story = {
  name: 'Request active',
};

export const HasError = (): JSX.Element => (
  <EditConversationAttributesModal
    {...createProps({ requestState: RequestState.InactiveWithError })}
  />
);

HasError.story = {
  name: 'Has error',
};
