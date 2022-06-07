// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { action } from '@storybook/addon-actions';
import { boolean, text } from '@storybook/addon-knobs';

import type { Props } from './PanelSection';
import { PanelSection } from './PanelSection';
import { PanelRow } from './PanelRow';

export default {
  title: 'Components/Conversation/ConversationDetails/PanelSection',
};

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  title: text('label', overrideProps.title || ''),
  centerTitle: boolean('centerTitle', overrideProps.centerTitle || false),
  actions: boolean('with action', overrideProps.actions !== undefined) ? (
    <button onClick={action('actions onClick')} type="button">
      action
    </button>
  ) : null,
});

export const Basic = (): JSX.Element => {
  const props = createProps({
    title: 'panel section header',
  });

  return <PanelSection {...props} />;
};

export const Centered = (): JSX.Element => {
  const props = createProps({
    title: 'this is a panel row',
    centerTitle: true,
  });

  return <PanelSection {...props} />;
};

export const WithActions = (): JSX.Element => {
  const props = createProps({
    title: 'this is a panel row',
    actions: (
      <button onClick={action('actions onClick')} type="button">
        action
      </button>
    ),
  });

  return <PanelSection {...props} />;
};

export const WithContent = (): JSX.Element => {
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
};
