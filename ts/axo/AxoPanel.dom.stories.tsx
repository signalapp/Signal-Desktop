// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { Meta } from '@storybook/react';
import type { ReactNode } from 'react';
import { AxoPanel } from './AxoPanel.dom.tsx';
import { action } from '@storybook/addon-actions';

export default {
  title: 'Axo/AxoPanel',
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta;

export function Basic(): ReactNode {
  return (
    <AxoPanel.Root>
      <AxoPanel.Header>
        <AxoPanel.Label>Label</AxoPanel.Label>
      </AxoPanel.Header>
      <AxoPanel.Content>
        Lorem ipsum dolor sit amet consectetur adipisicing elit. Qui velit
        voluptates necessitatibus eaque tenetur molestias eum labore animi enim
        recusandae. Mollitia sit officiis possimus nemo debitis omnis
        reprehenderit provident quo!
      </AxoPanel.Content>
    </AxoPanel.Root>
  );
}

export function Back(): ReactNode {
  return (
    <AxoPanel.Root>
      <AxoPanel.Header>
        <AxoPanel.Label>Label</AxoPanel.Label>
        <AxoPanel.Back onClick={action('onBack')} />
      </AxoPanel.Header>
      <AxoPanel.Content>
        Lorem ipsum dolor sit amet consectetur adipisicing elit. Qui velit
        voluptates necessitatibus eaque tenetur molestias eum labore animi enim
        recusandae. Mollitia sit officiis possimus nemo debitis omnis
        reprehenderit provident quo!
      </AxoPanel.Content>
    </AxoPanel.Root>
  );
}
