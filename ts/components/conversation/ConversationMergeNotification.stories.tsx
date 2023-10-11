// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import type { Meta } from '@storybook/react';
import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';
import type { PropsType } from './ConversationMergeNotification';
import { ConversationMergeNotification } from './ConversationMergeNotification';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/Conversation/ConversationMergeNotification',
} satisfies Meta<PropsType>;

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  i18n,
  conversationTitle: overrideProps.conversationTitle || 'John Fire',
  obsoleteConversationNumber:
    overrideProps.obsoleteConversationNumber || '(555) 333-1111',
  obsoleteConversationTitle:
    overrideProps.obsoleteConversationTitle || 'John Obsolete',
});

export function Basic(): JSX.Element {
  return <ConversationMergeNotification {...createProps()} />;
}

export function WithNoObsoleteNumber(): JSX.Element {
  return (
    <ConversationMergeNotification
      {...createProps()}
      obsoleteConversationNumber={undefined}
    />
  );
}

export function WithNoObsoleteTitle(): JSX.Element {
  return (
    <ConversationMergeNotification
      {...createProps()}
      obsoleteConversationTitle={undefined}
    />
  );
}
