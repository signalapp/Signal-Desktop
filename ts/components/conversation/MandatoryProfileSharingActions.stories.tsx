// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { Props } from './MandatoryProfileSharingActions.dom.js';
import { MandatoryProfileSharingActions } from './MandatoryProfileSharingActions.dom.js';
import {
  getDefaultConversation,
  getDefaultGroup,
} from '../../test-helpers/getDefaultConversation.std.js';

const { i18n } = window.SignalContext;

type Args = {
  conversationType: 'direct' | 'group';
};

export default {
  title: 'Components/Conversation/MandatoryProfileSharingActions',
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
} satisfies Meta<Args>;

function Example(args: Args) {
  const conversation =
    args.conversationType === 'group'
      ? getDefaultGroup()
      : getDefaultConversation();
  const addedBy =
    args.conversationType === 'group' ? getDefaultConversation() : conversation;
  return (
    <div style={{ width: '480px' }}>
      <MandatoryProfileSharingActions
        addedByName={addedBy}
        conversationType={conversation.type}
        conversationId={conversation.id}
        conversationName={conversation}
        i18n={i18n}
        isBlocked={conversation.isBlocked ?? false}
        isReported={conversation.isReported ?? false}
        acceptConversation={action('acceptConversation')}
        blockAndReportSpam={action('blockAndReportSpam')}
        blockConversation={action('blockConversation')}
        deleteConversation={action('deleteConversation')}
        reportSpam={action('reportSpam')}
      />
    </div>
  );
}

export function Direct(args: Props): JSX.Element {
  return <Example {...args} conversationType="direct" />;
}

export function Group(args: Props): JSX.Element {
  return <Example {...args} conversationType="group" />;
}
