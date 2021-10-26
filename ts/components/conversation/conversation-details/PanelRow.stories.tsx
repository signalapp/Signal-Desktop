// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { boolean, text } from '@storybook/addon-knobs';

import { ConversationDetailsIcon, IconType } from './ConversationDetailsIcon';
import type { Props } from './PanelRow';
import { PanelRow } from './PanelRow';

const story = storiesOf(
  'Components/Conversation/ConversationDetails/PanelRow',
  module
);

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  icon: boolean('with icon', overrideProps.icon !== undefined) ? (
    <ConversationDetailsIcon ariaLabel="timer" icon={IconType.timer} />
  ) : null,
  label: text('label', (overrideProps.label as string) || ''),
  info: text('info', overrideProps.info || ''),
  right: text('right', (overrideProps.right as string) || ''),
  actions: boolean('with action', overrideProps.actions !== undefined) ? (
    <ConversationDetailsIcon
      ariaLabel="trash"
      icon={IconType.trash}
      onClick={action('action onClick')}
    />
  ) : null,
  onClick: boolean('clickable', overrideProps.onClick !== undefined)
    ? overrideProps.onClick || action('onClick')
    : undefined,
});

story.add('Basic', () => {
  const props = createProps({
    label: 'this is a panel row',
  });

  return <PanelRow {...props} />;
});

story.add('Simple', () => {
  const props = createProps({
    label: 'this is a panel row',
    icon: 'with icon',
    right: 'side text',
  });

  return <PanelRow {...props} />;
});

story.add('Full', () => {
  const props = createProps({
    label: 'this is a panel row',
    icon: 'with icon',
    info: 'this is some info that exists below the main label',
    right: 'side text',
    actions: 'with action',
  });

  return <PanelRow {...props} />;
});

story.add('Button', () => {
  const props = createProps({
    label: 'this is a panel row',
    icon: 'with icon',
    right: 'side text',
    onClick: action('onClick'),
  });

  return <PanelRow {...props} />;
});
