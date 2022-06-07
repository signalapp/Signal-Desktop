// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { action } from '@storybook/addon-actions';
import { number, text } from '@storybook/addon-knobs';

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
};

const createConversation = (): ConversationType =>
  getDefaultConversation({
    id: '',
    type: 'group',
    lastUpdated: 0,
    title: text('conversation title', 'Some Conversation'),
    groupDescription: text(
      'description',
      'This is a group description. https://www.signal.org'
    ),
  });

const Wrapper = (overrideProps: Partial<Props>) => {
  const theme = React.useContext(StorybookThemeContext);

  return (
    <ConversationDetailsHeader
      areWeASubscriber={false}
      conversation={createConversation()}
      i18n={i18n}
      canEdit={false}
      startEditing={action('startEditing')}
      memberships={new Array(number('conversation members length', 0))}
      isGroup
      isMe={false}
      theme={theme}
      {...overrideProps}
    />
  );
};

export const Basic = (): JSX.Element => <Wrapper />;
export const Editable = (): JSX.Element => <Wrapper canEdit />;

export const BasicNoDescription = (): JSX.Element => (
  <Wrapper
    conversation={getDefaultConversation({
      title: 'My Group',
      type: 'group',
    })}
  />
);

BasicNoDescription.story = {
  name: 'Basic no-description',
};

export const EditableNoDescription = (): JSX.Element => (
  <Wrapper
    conversation={getDefaultConversation({
      title: 'My Group',
      type: 'group',
    })}
  />
);

EditableNoDescription.story = {
  name: 'Editable no-description',
};

export const _11 = (): JSX.Element => (
  <Wrapper isGroup={false} badges={getFakeBadges(3)} />
);

_11.story = {
  name: '1:1',
};

export const NoteToSelf = (): JSX.Element => <Wrapper isMe />;

NoteToSelf.story = {
  name: 'Note to self',
};
