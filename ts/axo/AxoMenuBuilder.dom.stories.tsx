// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode } from 'react';
import React, { useState } from 'react';
import type { Meta } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { AxoMenuBuilder } from './AxoMenuBuilder.dom.js';
import { AxoButton } from './AxoButton.dom.js';
import { tw } from './tw.dom.js';

export default {
  title: 'Axo/AxoMenuBuilder',
} satisfies Meta;

function Template(props: {
  renderer: AxoMenuBuilder.Renderer;
  children: ReactNode;
}) {
  const [showBookmarks, setShowBookmarks] = useState(true);
  const [showFullUrls, setShowFullUrls] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState('jamie');

  return (
    <AxoMenuBuilder.Root renderer={props.renderer}>
      <AxoMenuBuilder.Trigger>{props.children}</AxoMenuBuilder.Trigger>
      <AxoMenuBuilder.Content>
        <AxoMenuBuilder.Item
          symbol="arrow-[start]"
          onSelect={action('back')}
          keyboardShortcut="⌘["
        >
          Back
        </AxoMenuBuilder.Item>
        <AxoMenuBuilder.Item
          disabled
          symbol="arrow-[end]"
          onSelect={action('forward')}
          keyboardShortcut="⌘]"
        >
          Forward
        </AxoMenuBuilder.Item>
        <AxoMenuBuilder.Item onSelect={action('reload')} keyboardShortcut="⌘R">
          Reload
        </AxoMenuBuilder.Item>
        <AxoMenuBuilder.Sub>
          <AxoMenuBuilder.SubTrigger>More Tools</AxoMenuBuilder.SubTrigger>
          <AxoMenuBuilder.SubContent>
            <AxoMenuBuilder.Item
              onSelect={action('savePageAs')}
              keyboardShortcut="⌘S"
            >
              Save Page As...
            </AxoMenuBuilder.Item>
            <AxoMenuBuilder.Item onSelect={action('createShortcut')}>
              Create Shortcut...
            </AxoMenuBuilder.Item>
            <AxoMenuBuilder.Item onSelect={action('nameWindow')}>
              Name Window...
            </AxoMenuBuilder.Item>
            <AxoMenuBuilder.Separator />
            <AxoMenuBuilder.Item onSelect={action('developerTools')}>
              Developer Tools
            </AxoMenuBuilder.Item>
          </AxoMenuBuilder.SubContent>
        </AxoMenuBuilder.Sub>
        <AxoMenuBuilder.Separator />
        <AxoMenuBuilder.CheckboxItem
          checked={showBookmarks}
          onCheckedChange={setShowBookmarks}
          keyboardShortcut="⌘B"
        >
          Show Bookmarks
        </AxoMenuBuilder.CheckboxItem>
        <AxoMenuBuilder.CheckboxItem
          symbol="link"
          checked={showFullUrls}
          onCheckedChange={setShowFullUrls}
        >
          Show Full URLs
        </AxoMenuBuilder.CheckboxItem>
        <AxoMenuBuilder.Separator />
        <AxoMenuBuilder.Label>People</AxoMenuBuilder.Label>
        <AxoMenuBuilder.RadioGroup
          value={selectedPerson}
          onValueChange={setSelectedPerson}
        >
          <AxoMenuBuilder.RadioItem value="jamie">
            Jamie
          </AxoMenuBuilder.RadioItem>
          <AxoMenuBuilder.RadioItem value="tyler">
            Tyler
          </AxoMenuBuilder.RadioItem>
        </AxoMenuBuilder.RadioGroup>
      </AxoMenuBuilder.Content>
    </AxoMenuBuilder.Root>
  );
}

export function Basic(): JSX.Element {
  return (
    <div className={tw('flex h-96 w-full items-center justify-center gap-8')}>
      <Template renderer="AxoDropdownMenu">
        <AxoButton.Root variant="secondary" size="medium">
          Open Dropdown Menu
        </AxoButton.Root>
      </Template>
      <Template renderer="AxoContextMenu">
        <div className={tw('bg-fill-secondary p-12 text-color-label-primary')}>
          Right-Click
        </div>
      </Template>
    </div>
  );
}
