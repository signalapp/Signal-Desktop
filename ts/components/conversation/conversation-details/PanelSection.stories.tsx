// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { Props } from './PanelSection';
import { PanelSection } from './PanelSection';
import { PanelRow } from './PanelRow';

export default {
  title: 'Components/Conversation/ConversationDetails/PanelSection',
  argTypes: {},
  args: {
    title: 'this is a panel row',
    centerTitle: false,
    actions: null,
  },
} satisfies Meta<Props>;

export function Basic(args: Props): JSX.Element {
  return <PanelSection {...args} />;
}

export function Centered(args: Props): JSX.Element {
  return <PanelSection {...args} centerTitle />;
}

export function WithActions(args: Props): JSX.Element {
  return (
    <PanelSection
      {...args}
      actions={
        <button onClick={action('actions onClick')} type="button">
          action
        </button>
      }
    />
  );
}

export function WithContent(args: Props): JSX.Element {
  return (
    <PanelSection {...args}>
      <PanelRow label="this is panel row one" />
      <PanelRow label="this is panel row two" />
      <PanelRow label="this is panel row three" />
      <PanelRow label="this is panel row four" />
    </PanelSection>
  );
}
