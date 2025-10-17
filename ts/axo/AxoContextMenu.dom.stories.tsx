// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { useState } from 'react';
import type { Meta } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { AxoContextMenu } from './AxoContextMenu.dom.js';
import { tw } from './tw.dom.js';

export default {
  title: 'Axo/AxoContextMenu',
} satisfies Meta;

export function Basic(): JSX.Element {
  const [showBookmarks, setShowBookmarks] = useState(true);
  const [showFullUrls, setShowFullUrls] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState('jamie');
  return (
    <div className={tw('flex h-96 w-full items-center justify-center')}>
      <AxoContextMenu.Root>
        <AxoContextMenu.Trigger>
          <div
            className={tw('bg-fill-secondary p-12 text-color-label-primary')}
          >
            Right-Click
          </div>
        </AxoContextMenu.Trigger>
        <AxoContextMenu.Content>
          <AxoContextMenu.Item
            symbol="arrow-[start]"
            onSelect={action('back')}
            keyboardShortcut="⌘["
          >
            Back
          </AxoContextMenu.Item>
          <AxoContextMenu.Item
            disabled
            symbol="arrow-[end]"
            onSelect={action('forward')}
            keyboardShortcut="⌘]"
          >
            Forward
          </AxoContextMenu.Item>
          <AxoContextMenu.Item
            onSelect={action('reload')}
            keyboardShortcut="⌘R"
          >
            Reload
          </AxoContextMenu.Item>
          <AxoContextMenu.Sub>
            <AxoContextMenu.SubTrigger>More Tools</AxoContextMenu.SubTrigger>
            <AxoContextMenu.SubContent>
              <AxoContextMenu.Item
                onSelect={action('savePageAs')}
                keyboardShortcut="⌘S"
              >
                Save Page As...
              </AxoContextMenu.Item>
              <AxoContextMenu.Item onSelect={action('createShortcut')}>
                Create Shortcut...
              </AxoContextMenu.Item>
              <AxoContextMenu.Item onSelect={action('nameWindow')}>
                Name Window...
              </AxoContextMenu.Item>
              <AxoContextMenu.Separator />
              <AxoContextMenu.Item onSelect={action('developerTools')}>
                Developer Tools
              </AxoContextMenu.Item>
            </AxoContextMenu.SubContent>
          </AxoContextMenu.Sub>
          <AxoContextMenu.Separator />
          <AxoContextMenu.CheckboxItem
            checked={showBookmarks}
            onCheckedChange={setShowBookmarks}
            keyboardShortcut="⌘B"
          >
            Show Bookmarks
          </AxoContextMenu.CheckboxItem>
          <AxoContextMenu.CheckboxItem
            symbol="link"
            checked={showFullUrls}
            onCheckedChange={setShowFullUrls}
          >
            Show Full URLs
          </AxoContextMenu.CheckboxItem>
          <AxoContextMenu.Separator />
          <AxoContextMenu.Label>People</AxoContextMenu.Label>
          <AxoContextMenu.RadioGroup
            value={selectedPerson}
            onValueChange={setSelectedPerson}
          >
            <AxoContextMenu.RadioItem value="jamie">
              Jamie
            </AxoContextMenu.RadioItem>
            <AxoContextMenu.RadioItem value="tyler">
              Tyler
            </AxoContextMenu.RadioItem>
          </AxoContextMenu.RadioGroup>
        </AxoContextMenu.Content>
      </AxoContextMenu.Root>
    </div>
  );
}
