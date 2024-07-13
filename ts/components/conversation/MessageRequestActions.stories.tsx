// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import { MessageRequestActions } from './MessageRequestActions';
import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';
import {
  getDefaultConversation,
  getDefaultGroup,
} from '../../test-both/helpers/getDefaultConversation';

const i18n = setupI18n('en', enMessages);

type Args = {
  conversationType: 'direct' | 'group';
  isBlocked: boolean;
  isHidden: boolean;
  isReported: boolean;
};

export default {
  title: 'Components/Conversation/MessageRequestActions',
  argTypes: {
    conversationType: {
      control: {
        type: 'select',
        options: ['direct', 'group'],
      },
    },
  },
  args: {
    conversationType: 'direct',
  },
  decorators: [
    (Story: React.ComponentType): JSX.Element => {
      return (
        <div style={{ width: '480px' }}>
          <Story />
        </div>
      );
    },
  ],
} satisfies Meta<Args>;

function Example(args: Args): JSX.Element {
  const conversation =
    args.conversationType === 'group'
      ? getDefaultGroup()
      : getDefaultConversation();
  const addedBy =
    args.conversationType === 'group' ? getDefaultConversation() : conversation;
  return (
    <MessageRequestActions
      addedByName={addedBy}
      conversationType={conversation.type}
      conversationId={conversation.id}
      conversationName={conversation}
      i18n={i18n}
      isBlocked={args.isBlocked}
      isHidden={args.isHidden}
      isReported={args.isReported}
      acceptConversation={action('acceptConversation')}
      blockAndReportSpam={action('blockAndReportSpam')}
      blockConversation={action('blockConversation')}
      deleteConversation={action('deleteConversation')}
      reportSpam={action('reportSpam')}
    />
  );
}

export function Direct(args: Args): JSX.Element {
  return <Example {...args} />;
}

export function DirectBlocked(args: Args): JSX.Element {
  return <Example {...args} isBlocked />;
}

export function DirectReported(args: Args): JSX.Element {
  return <Example {...args} isReported />;
}

export function DirectBlockedAndReported(args: Args): JSX.Element {
  return <Example {...args} isBlocked isReported />;
}

export function Group(args: Args): JSX.Element {
  return <Example {...args} conversationType="group" />;
}

export function GroupBlocked(args: Args): JSX.Element {
  return <Example {...args} conversationType="group" isBlocked />;
}

export function GroupReported(args: Args): JSX.Element {
  return <Example {...args} conversationType="group" isReported />;
}

export function GroupBlockedAndReported(args: Args): JSX.Element {
  return <Example {...args} conversationType="group" isBlocked isReported />;
}
