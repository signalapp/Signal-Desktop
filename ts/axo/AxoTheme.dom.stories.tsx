// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode } from 'react';
import React, { useState } from 'react';
import type { Meta } from '@storybook/react';
import { AxoTheme } from './AxoTheme.dom.tsx';
import { tw } from './tw.dom.tsx';
import { AxoButton } from './AxoButton.dom.tsx';
import { AxoDropdownMenu } from './AxoDropdownMenu.dom.tsx';
import { AxoDialog } from './AxoDialog.dom.tsx';
import { AxoContextMenu } from './AxoContextMenu.dom.tsx';
import { AxoTooltip } from './AxoTooltip.dom.tsx';
import { AxoAlertDialog } from './AxoAlertDialog.dom.tsx';
import { AxoSelect } from './AxoSelect.dom.tsx';

export default {
  title: 'Axo/AxoTheme',
} satisfies Meta;

function AxoTooltipTest() {
  return (
    <AxoTooltip.Root label="Lorem ipsum">
      <AxoButton.Root variant="secondary" size="md">
        AxoTooltip
      </AxoButton.Root>
    </AxoTooltip.Root>
  );
}

function AxoDropdownMenuTest() {
  return (
    <AxoDropdownMenu.Root>
      <AxoDropdownMenu.Trigger>
        <AxoButton.Root variant="secondary" size="md">
          AxoDropdownMenu
        </AxoButton.Root>
      </AxoDropdownMenu.Trigger>
      <AxoDropdownMenu.Content>
        <AxoDropdownMenu.Item onSelect={() => null}>Item</AxoDropdownMenu.Item>
        <AxoDropdownMenu.Sub>
          <AxoDropdownMenu.SubTrigger>Submenu</AxoDropdownMenu.SubTrigger>
          <AxoDropdownMenu.SubContent>
            <AxoDropdownMenu.Item onSelect={() => null}>
              Item
            </AxoDropdownMenu.Item>
          </AxoDropdownMenu.SubContent>
        </AxoDropdownMenu.Sub>
      </AxoDropdownMenu.Content>
    </AxoDropdownMenu.Root>
  );
}

function AxoContextMenuTest() {
  return (
    <AxoContextMenu.Root>
      <AxoContextMenu.Trigger>
        <AxoButton.Root variant="secondary" size="md">
          AxoContextMenu
        </AxoButton.Root>
      </AxoContextMenu.Trigger>
      <AxoContextMenu.Content>
        <AxoContextMenu.Item onSelect={() => null}>Item</AxoContextMenu.Item>
        <AxoContextMenu.Sub>
          <AxoContextMenu.SubTrigger>Submenu</AxoContextMenu.SubTrigger>
          <AxoContextMenu.SubContent>
            <AxoContextMenu.Item onSelect={() => null}>
              Item
            </AxoContextMenu.Item>
          </AxoContextMenu.SubContent>
        </AxoContextMenu.Sub>
      </AxoContextMenu.Content>
    </AxoContextMenu.Root>
  );
}

function AxoSelectTest() {
  const [value, setValue] = useState<string | null>(null);
  return (
    <AxoSelect.Root value={value} onValueChange={setValue}>
      <AxoSelect.Trigger placeholder="AxoSelect" />
      <AxoSelect.Content>
        <AxoSelect.Item value="1">
          <AxoSelect.ItemText>Item 1</AxoSelect.ItemText>
        </AxoSelect.Item>
        <AxoSelect.Item value="2">
          <AxoSelect.ItemText>Item 2</AxoSelect.ItemText>
        </AxoSelect.Item>
      </AxoSelect.Content>
    </AxoSelect.Root>
  );
}

function AxoDialogTest() {
  return (
    <AxoDialog.Root>
      <AxoDialog.Trigger>
        <AxoButton.Root variant="primary" size="md">
          AxoDialog
        </AxoButton.Root>
      </AxoDialog.Trigger>
      <AxoDialog.Content size="md" escape="cancel-is-noop">
        <AxoDialog.Header>
          <AxoDialog.Title>AxoDialog</AxoDialog.Title>
          <AxoDialog.Close aria-label="Close" />
        </AxoDialog.Header>
        <AxoDialog.Body>
          <p>Lorem ipsum, dolor sit amet consectetur adipisicing elit.</p>
        </AxoDialog.Body>
        <AxoDialog.Footer>
          <AxoDialog.Actions>
            <AxoDialog.Action variant="secondary" onClick={() => null}>
              Cancel
            </AxoDialog.Action>
            <AxoDialog.Action variant="primary" onClick={() => null}>
              OK
            </AxoDialog.Action>
          </AxoDialog.Actions>
        </AxoDialog.Footer>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}

function AxoAlertDialogTest() {
  return (
    <AxoAlertDialog.Root>
      <AxoAlertDialog.Trigger>
        <AxoButton.Root variant="primary" size="md">
          AxoAlertDialog
        </AxoButton.Root>
      </AxoAlertDialog.Trigger>
      <AxoAlertDialog.Content escape="cancel-is-noop">
        <AxoAlertDialog.Body>
          <AxoAlertDialog.Title>AxoAlertDialog</AxoAlertDialog.Title>
          <AxoAlertDialog.Description>
            Lorem ipsum, dolor sit amet consectetur adipisicing elit.
          </AxoAlertDialog.Description>
        </AxoAlertDialog.Body>
        <AxoAlertDialog.Footer>
          <AxoAlertDialog.Cancel>Cancel</AxoAlertDialog.Cancel>
          <AxoAlertDialog.Action variant="primary" onClick={() => null}>
            OK
          </AxoAlertDialog.Action>
        </AxoAlertDialog.Footer>
      </AxoAlertDialog.Content>
    </AxoAlertDialog.Root>
  );
}

function TestCases() {
  return (
    <div className={tw('flex gap-2')}>
      <AxoTooltipTest />
      <AxoDropdownMenuTest />
      <AxoContextMenuTest />
      <AxoSelectTest />
      <AxoDialogTest />
      <AxoAlertDialogTest />
    </div>
  );
}

function Label(props: { children: ReactNode }) {
  return (
    <h2 className={tw('type-title-small text-label-primary')}>
      {props.children}
    </h2>
  );
}

function Section(props: { children: ReactNode }) {
  return (
    <section className={tw('flex flex-col gap-2 bg-background-primary p-4')}>
      {props.children}
    </section>
  );
}

export function Basic(): React.JSX.Element {
  return (
    <>
      <Section>
        <Label>Without override</Label>
        <TestCases />
      </Section>

      <AxoTheme.Override theme="auto">
        <Section>
          <Label>Auto</Label>
          <TestCases />
        </Section>
      </AxoTheme.Override>

      <AxoTheme.Override theme="force-light">
        <Section>
          <Label>Force Light</Label>
          <TestCases />
        </Section>
      </AxoTheme.Override>

      <AxoTheme.Override theme="force-dark">
        <Section>
          <Label>Force Light</Label>
          <TestCases />

          <AxoTheme.Override theme="auto">
            <Section>
              <Label>Auto (Escape from an override)</Label>
              <TestCases />
            </Section>
          </AxoTheme.Override>
        </Section>
      </AxoTheme.Override>
    </>
  );
}
