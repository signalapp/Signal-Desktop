// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import type { Props } from './ConversationDetailsIcon';
import { ConversationDetailsIcon, IconType } from './ConversationDetailsIcon';

const story = storiesOf(
  'Components/Conversation/ConversationDetails/ConversationDetailIcon',
  module
);

const createProps = (overrideProps: Partial<Props>): Props => ({
  ariaLabel: overrideProps.ariaLabel || '',
  icon: overrideProps.icon || IconType.timer,
  onClick: overrideProps.onClick,
});

story.add('All', () => {
  const icons = Object.values(IconType);

  return icons.map(icon => (
    <ConversationDetailsIcon {...createProps({ icon })} />
  ));
});

story.add('Clickable Icons', () => {
  const icons = [
    IconType.timer,
    IconType.trash,
    IconType.invites,
    IconType.block,
    IconType.leave,
    IconType.down,
  ];

  const onClick = action('onClick');

  return icons.map(icon => (
    <ConversationDetailsIcon {...createProps({ icon, onClick })} />
  ));
});
