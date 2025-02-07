// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import { getDefaultConversation } from '../../../test-both/helpers/getDefaultConversation';
import { getFakeBadges } from '../../../test-both/helpers/getFakeBadge';
import { setupI18n } from '../../../util/setupI18n';
import enMessages from '../../../../_locales/en/messages.json';
import { StorybookThemeContext } from '../../../../.storybook/StorybookThemeContext';
import type { ConversationType } from '../../../state/ducks/conversations';
import type { Props } from './ConversationDetailsHeader';
import { ConversationDetailsHeader } from './ConversationDetailsHeader';

const i18n = setupI18n('en', enMessages);

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
