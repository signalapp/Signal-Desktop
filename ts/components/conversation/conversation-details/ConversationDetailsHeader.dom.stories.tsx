// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import { getDefaultConversation } from '../../../test-helpers/getDefaultConversation.std.js';
import { getFakeBadges } from '../../../test-helpers/getFakeBadge.std.js';
import { StorybookThemeContext } from '../../../../.storybook/StorybookThemeContext.std.js';
import type { ConversationType } from '../../../state/ducks/conversations.preload.js';
import type { Props } from './ConversationDetailsHeader.dom.js';
import { ConversationDetailsHeader } from './ConversationDetailsHeader.dom.js';

const { i18n } = window.SignalContext;

export default {
  title:
    'Components/Conversation/ConversationDetails/ConversationDetailsHeader',
  argTypes: {},
  args: {},
} satisfies Meta<Props>;

const createConversation = (): ConversationType =>
  getDefaultConversation({
    id: '',
    type: 'group',
    lastUpdated: 0,
    title: 'Some Conversation',
    groupDescription: 'This is a group description. https://www.signal.org',
  });

function Wrapper(overrideProps: Partial<Props>) {
  const theme = React.useContext(StorybookThemeContext);

  return (
    <ConversationDetailsHeader
      areWeASubscriber={false}
      conversation={createConversation()}
      i18n={i18n}
      canEdit={false}
      startEditing={action('startEditing')}
      membersCount={0}
      isGroup
      isMe={false}
      isSignalConversation={false}
      pendingAvatarDownload={false}
      startAvatarDownload={action('startAvatarDownload')}
      theme={theme}
      toggleAboutContactModal={action('toggleAboutContactModal')}
      {...overrideProps}
    />
  );
}

export function Basic(): JSX.Element {
  return <Wrapper />;
}
export function Editable(): JSX.Element {
  return <Wrapper canEdit />;
}

export function BasicNoDescription(): JSX.Element {
  return (
    <Wrapper
      conversation={getDefaultConversation({
        title: 'My Group',
        type: 'group',
      })}
    />
  );
}

export function EditableNoDescription(): JSX.Element {
  return (
    <Wrapper
      conversation={getDefaultConversation({
        title: 'My Group',
        type: 'group',
      })}
    />
  );
}

export function OneOnOne(): JSX.Element {
  return (
    <Wrapper
      isGroup={false}
      badges={getFakeBadges(3)}
      conversation={getDefaultConversation({
        title: 'Maya Johnson',
        type: 'direct',
      })}
    />
  );
}

export function NoteToSelf(): JSX.Element {
  return <Wrapper isMe />;
}
