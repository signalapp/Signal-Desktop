// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { Props } from './PanelRow';
import { PanelRow } from './PanelRow';
import { ConversationDetailsIcon, IconType } from './ConversationDetailsIcon';

export default {
  title: 'Components/Conversation/ConversationDetails/PanelRow',
  argTypes: {},
  args: {
    icon: <ConversationDetailsIcon ariaLabel="timer" icon={IconType.timer} />,
    label: '',
    info: '',
    right: '',
    actions: (
      <ConversationDetailsIcon
        ariaLabel="trash"
        icon={IconType.trash}
        onClick={action('action onClick')}
      />
    ),
    onClick: action('onClick'),
  },
} satisfies Meta<Props>;

export function Basic(args: Props): JSX.Element {
  return <PanelRow {...args} label="this is a panel row" />;
}

export function Simple(args: Props): JSX.Element {
  return (
    <PanelRow
      {...args}
      label="this is a panel row"
      icon="with icon"
      right="side text"
    />
  );
}

export function Full(args: Props): JSX.Element {
  return (
    <PanelRow
      {...args}
      label="this is a panel row"
      icon="with icon"
      info="this is some info that exists below the main label"
      right="side text"
      actions="with action"
    />
  );
}

export function Button(args: Props): JSX.Element {
  return (
    <PanelRow
      {...args}
      label="this is a panel row"
      icon="with icon"
      right="side text"
    />
  );
}
