// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ComponentProps } from 'react';
import React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import { setupI18n } from '../../../util/setupI18n';
import enMessages from '../../../../_locales/en/messages.json';
import { EditConversationAttributesModal } from './EditConversationAttributesModal';
import { RequestState } from './util';

const i18n = setupI18n('en', enMessages);

export default {
  title:
    'Components/Conversation/ConversationDetails/EditConversationAttributesModal',
} satisfies Meta<PropsType>;

type PropsType = ComponentProps<typeof EditConversationAttributesModal>;

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  avatarUrl: undefined,
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

export function NoAvatarEmptyTitle(): JSX.Element {
  return <EditConversationAttributesModal {...createProps({ title: '' })} />;
}

export function AvatarAndTitle(): JSX.Element {
  return (
    <EditConversationAttributesModal
      {...createProps({
        avatarUrl: '/fixtures/kitten-3-64-64.jpg',
      })}
    />
  );
}

export function InitiallyFocusingDescription(): JSX.Element {
  return (
    <EditConversationAttributesModal
      {...createProps({ title: 'Has title', initiallyFocusDescription: true })}
    />
  );
}

export function RequestActive(): JSX.Element {
  return (
    <EditConversationAttributesModal
      {...createProps({ requestState: RequestState.Active })}
    />
  );
}

export function HasError(): JSX.Element {
  return (
    <EditConversationAttributesModal
      {...createProps({ requestState: RequestState.InactiveWithError })}
    />
  );
}
