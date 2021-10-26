// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { boolean, text } from '@storybook/addon-knobs';

import type { Props } from './PanelSection';
import { PanelSection } from './PanelSection';
import { PanelRow } from './PanelRow';

const story = storiesOf(
  'Components/Conversation/ConversationDetails/PanelSection',
  module
);

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  title: text('label', overrideProps.title || ''),
  centerTitle: boolean('centerTitle', overrideProps.centerTitle || false),
  actions: boolean('with action', overrideProps.actions !== undefined) ? (
    <button onClick={action('actions onClick')} type="button">
      action
    </button>
  ) : null,
});

story.add('Basic', () => {
  const props = createProps({
    title: 'panel section header',
  });

  return <PanelSection {...props} />;
});

story.add('Centered', () => {
  const props = createProps({
    title: 'this is a panel row',
    centerTitle: true,
  });

  return <PanelSection {...props} />;
});

story.add('With Actions', () => {
  const props = createProps({
    title: 'this is a panel row',
    actions: (
      <button onClick={action('actions onClick')} type="button">
        action
      </button>
    ),
  });

  return <PanelSection {...props} />;
});

story.add('With Content', () => {
  const props = createProps({
    title: 'this is a panel row',
  });

  return (
    <PanelSection {...props}>
      <PanelRow label="this is panel row one" />
      <PanelRow label="this is panel row two" />
      <PanelRow label="this is panel row three" />
      <PanelRow label="this is panel row four" />
    </PanelSection>
  );
});
