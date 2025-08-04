// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { useState } from 'react';
import type { Meta } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { AxoDropdownMenu } from './AxoDropdownMenu';
import { AxoButton } from './AxoButton';

export default {
  title: 'Axo/AxoDropdownMenu',
} satisfies Meta;

export function Basic(): JSX.Element {
  const [showBookmarks, setShowBookmarks] = useState(true);
  const [showFullUrls, setShowFullUrls] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState('jamie');
  return (
    <div className="flex h-96 w-full items-center justify-center">
      <AxoDropdownMenu.Root>
        <AxoDropdownMenu.Trigger>
          <AxoButton variant="secondary" size="medium">
            Open Dropdown Menu
          </AxoButton>
        </AxoDropdownMenu.Trigger>
        <AxoDropdownMenu.Content>
          <AxoDropdownMenu.Item
            symbol="arrow-[start]"
            onSelect={action('back')}
            keyboardShortcut="⌘["
          >
            Back
          </AxoDropdownMenu.Item>
          <AxoDropdownMenu.Item
            disabled
            symbol="arrow-[end]"
            onSelect={action('forward')}
            keyboardShortcut="⌘]"
          >
            Forward
          </AxoDropdownMenu.Item>
          <AxoDropdownMenu.Item
            onSelect={action('reload')}
            keyboardShortcut="⌘R"
          >
            Reload
          </AxoDropdownMenu.Item>
          <AxoDropdownMenu.Sub>
            <AxoDropdownMenu.SubTrigger>More Tools</AxoDropdownMenu.SubTrigger>
            <AxoDropdownMenu.SubContent>
              <AxoDropdownMenu.Item
                onSelect={action('savePageAs')}
                keyboardShortcut="⌘S"
              >
                Save Page As...
              </AxoDropdownMenu.Item>
              <AxoDropdownMenu.Item onSelect={action('createShortcut')}>
                Create Shortcut...
              </AxoDropdownMenu.Item>
              <AxoDropdownMenu.Item onSelect={action('nameWindow')}>
                Name Window...
              </AxoDropdownMenu.Item>
              <AxoDropdownMenu.Separator />
              <AxoDropdownMenu.Item onSelect={action('developerTools')}>
                Developer Tools
              </AxoDropdownMenu.Item>
            </AxoDropdownMenu.SubContent>
          </AxoDropdownMenu.Sub>
          <AxoDropdownMenu.Separator />
          <AxoDropdownMenu.CheckboxItem
            checked={showBookmarks}
            onCheckedChange={setShowBookmarks}
            keyboardShortcut="⌘B"
          >
            Show Bookmarks
          </AxoDropdownMenu.CheckboxItem>
          <AxoDropdownMenu.CheckboxItem
            symbol="link"
            checked={showFullUrls}
            onCheckedChange={setShowFullUrls}
          >
            Show Full URLs
          </AxoDropdownMenu.CheckboxItem>
          <AxoDropdownMenu.Separator />
          <AxoDropdownMenu.Label>People</AxoDropdownMenu.Label>
          <AxoDropdownMenu.RadioGroup
            value={selectedPerson}
            onValueChange={setSelectedPerson}
          >
            <AxoDropdownMenu.RadioItem value="jamie">
              Jamie
            </AxoDropdownMenu.RadioItem>
            <AxoDropdownMenu.RadioItem value="tyler">
              Tyler
            </AxoDropdownMenu.RadioItem>
          </AxoDropdownMenu.RadioGroup>
        </AxoDropdownMenu.Content>
      </AxoDropdownMenu.Root>
    </div>
  );
}
