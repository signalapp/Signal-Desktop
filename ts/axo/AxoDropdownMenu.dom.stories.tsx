// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode } from 'react';
import React, { useState } from 'react';
import type { Meta } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { AxoDropdownMenu } from './AxoDropdownMenu.dom.js';
import { AxoButton } from './AxoButton.dom.js';
import { tw } from './tw.dom.js';

export default {
  title: 'Axo/AxoDropdownMenu',
} satisfies Meta;

function Container(props: { children: ReactNode }) {
  return (
    <div className={tw('flex h-96 w-full items-center justify-center')}>
      {props.children}
    </div>
  );
}

export function Basic(): JSX.Element {
  const [showBookmarks, setShowBookmarks] = useState(true);
  const [showFullUrls, setShowFullUrls] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState('jamie');
  return (
    <Container>
      <AxoDropdownMenu.Root>
        <AxoDropdownMenu.Trigger>
          <AxoButton.Root variant="secondary" size="medium">
            Open Dropdown Menu
          </AxoButton.Root>
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
    </Container>
  );
}

export function WithHeader(): JSX.Element {
  return (
    <Container>
      <AxoDropdownMenu.Root>
        <AxoDropdownMenu.Trigger>
          <AxoButton.Root variant="secondary" size="medium">
            Open Dropdown Menu
          </AxoButton.Root>
        </AxoDropdownMenu.Trigger>
        <AxoDropdownMenu.Content>
          <AxoDropdownMenu.Header
            label="Notification profile"
            description="On"
          />
          <AxoDropdownMenu.Item onSelect={action('onSleep')}>
            Sleep
          </AxoDropdownMenu.Item>
          <AxoDropdownMenu.Item onSelect={action('onWork')}>
            Work
          </AxoDropdownMenu.Item>
          <AxoDropdownMenu.Sub>
            <AxoDropdownMenu.SubTrigger>Sub-menu</AxoDropdownMenu.SubTrigger>
            <AxoDropdownMenu.SubContent>
              <AxoDropdownMenu.Header
                label="Notification profile"
                description="On"
              />
              <AxoDropdownMenu.Item onSelect={action('onSleep')}>
                Sleep
              </AxoDropdownMenu.Item>
              <AxoDropdownMenu.Item onSelect={action('onWork')}>
                Work
              </AxoDropdownMenu.Item>
            </AxoDropdownMenu.SubContent>
          </AxoDropdownMenu.Sub>
        </AxoDropdownMenu.Content>
      </AxoDropdownMenu.Root>
    </Container>
  );
}

const LONG_TEXT =
  'Lorem ipsum dolor sit amet consectetur adipisicing elit. Cum nostrum, inventore quia tenetur sunt non ab fuga explicabo ullam tempore.';

export function StressTestLongText(): JSX.Element {
  const items = (
    <>
      <AxoDropdownMenu.Item onSelect={action('onSelect')}>
        <strong>Item:</strong> {LONG_TEXT}
      </AxoDropdownMenu.Item>
      <AxoDropdownMenu.Item
        symbol="megaphone"
        keyboardShortcut="⌘["
        onSelect={action('onSelect')}
      >
        <strong>Item:</strong> {LONG_TEXT}
      </AxoDropdownMenu.Item>
    </>
  );

  const checkboxItems = (
    <>
      <AxoDropdownMenu.CheckboxItem
        checked={false}
        onCheckedChange={action('onCheckedChange')}
      >
        <strong>CheckboxItem:</strong> {LONG_TEXT}
      </AxoDropdownMenu.CheckboxItem>
      <AxoDropdownMenu.CheckboxItem
        symbol="megaphone"
        keyboardShortcut="⌘["
        checked={false}
        onCheckedChange={action('onCheckedChange')}
      >
        <strong>CheckboxItem:</strong> {LONG_TEXT}
      </AxoDropdownMenu.CheckboxItem>
    </>
  );
  const content = (
    <>
      <AxoDropdownMenu.Header label={LONG_TEXT} description={LONG_TEXT} />
      {items}
      {checkboxItems}
      <AxoDropdownMenu.RadioGroup
        value="value"
        onValueChange={action('onValueChange')}
      >
        <AxoDropdownMenu.RadioItem value="value">
          <strong>RadioItem:</strong> {LONG_TEXT}
        </AxoDropdownMenu.RadioItem>
        <AxoDropdownMenu.RadioItem
          symbol="megaphone"
          keyboardShortcut="⌘["
          value="value"
        >
          <strong>RadioItem:</strong> {LONG_TEXT}
        </AxoDropdownMenu.RadioItem>
      </AxoDropdownMenu.RadioGroup>
      <AxoDropdownMenu.Separator />
      <AxoDropdownMenu.Group>
        <AxoDropdownMenu.Label>
          <strong>Label:</strong> {LONG_TEXT}
        </AxoDropdownMenu.Label>
        {items}
        {checkboxItems}
      </AxoDropdownMenu.Group>
    </>
  );

  return (
    <Container>
      <AxoDropdownMenu.Root>
        <AxoDropdownMenu.Trigger>
          <AxoButton.Root variant="secondary" size="medium">
            Open Dropdown Menu
          </AxoButton.Root>
        </AxoDropdownMenu.Trigger>
        <AxoDropdownMenu.Content>
          {content}
          <AxoDropdownMenu.Sub>
            <AxoDropdownMenu.SubTrigger>{LONG_TEXT}</AxoDropdownMenu.SubTrigger>
            <AxoDropdownMenu.SubContent>{content}</AxoDropdownMenu.SubContent>
          </AxoDropdownMenu.Sub>
        </AxoDropdownMenu.Content>
      </AxoDropdownMenu.Root>
    </Container>
  );
}
