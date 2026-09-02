// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { Meta } from '@storybook/react';
import React from 'react';
import { action } from '@storybook/addon-actions';
import { AxoItem } from './AxoItem.dom.tsx';
import { AxoList } from './AxoList.dom.tsx';
import { tw } from '../tw.dom.tsx';

export default {
  title: 'Axo/Items/AxoList',
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta;

function ExampleItems() {
  return (
    <AxoItem.Group>
      <AxoItem.Root>
        <AxoItem.Leading>
          <AxoItem.Icon symbol="info-circle" />
        </AxoItem.Leading>
        <AxoItem.Content>
          <AxoItem.Body>
            <AxoItem.Label>First Item</AxoItem.Label>
            <AxoItem.Description>
              Description of the first item
            </AxoItem.Description>
            <AxoItem.HiddenTrigger label="Test" onClick={action('onClick')} />
          </AxoItem.Body>
        </AxoItem.Content>
      </AxoItem.Root>
      <AxoItem.Root>
        <AxoItem.Leading>
          <AxoItem.Icon symbol="info-circle" />
        </AxoItem.Leading>
        <AxoItem.Content>
          <AxoItem.Body>
            <AxoItem.Label>Second Item</AxoItem.Label>
            <AxoItem.Description>
              Description of the second item
            </AxoItem.Description>
            <AxoItem.HiddenTrigger label="Test" onClick={action('onClick')} />
          </AxoItem.Body>
        </AxoItem.Content>
      </AxoItem.Root>
      <AxoItem.Root>
        <AxoItem.Leading>
          <AxoItem.Icon symbol="info-circle" />
        </AxoItem.Leading>
        <AxoItem.Content>
          <AxoItem.Body>
            <AxoItem.Label>Third Item</AxoItem.Label>
            <AxoItem.Description>
              Description of the third item
            </AxoItem.Description>
            <AxoItem.HiddenTrigger label="Test" onClick={action('onClick')} />
          </AxoItem.Body>
        </AxoItem.Content>
      </AxoItem.Root>
    </AxoItem.Group>
  );
}

export function Basic(): React.JSX.Element {
  return (
    <div className={tw('bg-surface-secondary p-8')}>
      <AxoList.Root>
        <AxoList.Body>
          <ExampleItems />
        </AxoList.Body>
      </AxoList.Root>
    </div>
  );
}

export function WithTitle(): React.JSX.Element {
  return (
    <div className={tw('bg-surface-secondary p-8')}>
      <AxoList.Root>
        <AxoList.Header>
          <AxoList.Label>List Title</AxoList.Label>
        </AxoList.Header>
        <AxoList.Body>
          <ExampleItems />
        </AxoList.Body>
      </AxoList.Root>
    </div>
  );
}

export function WithDescription(): React.JSX.Element {
  return (
    <div className={tw('bg-surface-secondary p-8')}>
      <AxoList.Root>
        <AxoList.Header>
          <AxoList.Label>List Title</AxoList.Label>
          <AxoList.Description>
            Lorem ipsum dolor sit amet consectetur adipisicing elit.
          </AxoList.Description>
        </AxoList.Header>
        <AxoList.Body>
          <ExampleItems />
        </AxoList.Body>
      </AxoList.Root>
    </div>
  );
}

export function WithFooterDescription(): React.JSX.Element {
  return (
    <div className={tw('bg-surface-secondary p-8')}>
      <AxoList.Root>
        <AxoList.Header>
          <AxoList.Label>List Title</AxoList.Label>
        </AxoList.Header>
        <AxoList.Body>
          <ExampleItems />
        </AxoList.Body>
        <AxoList.Footer>
          <AxoList.FooterDescription>
            This is some helpful text that describes the section above.
          </AxoList.FooterDescription>
        </AxoList.Footer>
      </AxoList.Root>
    </div>
  );
}

export function MultipleLists(): React.JSX.Element {
  return (
    <div className={tw('bg-surface-secondary p-8')}>
      <AxoList.Root>
        <AxoList.Body>
          <ExampleItems />
        </AxoList.Body>
      </AxoList.Root>

      <AxoList.Root>
        <AxoList.Header>
          <AxoList.Label>Second Section</AxoList.Label>
        </AxoList.Header>
        <AxoList.Body>
          <ExampleItems />
        </AxoList.Body>
        <AxoList.Footer>
          <AxoList.FooterDescription>
            Help text for the second section.
          </AxoList.FooterDescription>
        </AxoList.Footer>
      </AxoList.Root>

      <AxoList.Root>
        <AxoList.Header>
          <AxoList.Label>Third Section</AxoList.Label>
        </AxoList.Header>
        <AxoList.Body>
          <ExampleItems />
        </AxoList.Body>
      </AxoList.Root>
    </div>
  );
}
