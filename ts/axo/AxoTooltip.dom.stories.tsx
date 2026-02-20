// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { JSX, ReactNode } from 'react';
import React, { useState } from 'react';
import type { Meta } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { AxoTooltip } from './AxoTooltip.dom.js';
import { AxoButton } from './AxoButton.dom.js';
import { tw } from './tw.dom.js';
import { AxoScrollArea } from './AxoScrollArea.dom.js';
import { AxoDialog } from './AxoDialog.dom.js';

export default {
  title: 'Axo/AxoTooltip',
} satisfies Meta;

const LONG_TEXT = (
  <>
    Lorem ipsum dolor sit amet, consectetur adipisicing elit. Dolore nesciunt
    eligendi velit doloribus ipsum deleniti eaque voluptatibus, sequi quae
    pariatur nulla ad maiores eos, necessitatibus esse mollitia odio consequatur
    aliquid?
  </>
);

function Row(props: { children: ReactNode }) {
  return <div className={tw('flex flex-wrap gap-2')}>{props.children}</div>;
}

function Stack(props: { children: ReactNode }) {
  return <div className={tw('flex flex-col gap-2')}>{props.children}</div>;
}

type ExampleProps = {
  trigger?: string;
  label?: ReactNode;
  side?: AxoTooltip.Side;
  align?: AxoTooltip.Align;
  keyboardShortcut?: string;
  experimentalTimestamp?: number;
};

function SimpleExample(props: ExampleProps) {
  return (
    <AxoTooltip.Root
      __FORCE_OPEN
      label={props.label ?? 'Hello World'}
      side={props.side}
      align={props.align}
      keyboardShortcut={props.keyboardShortcut}
      experimentalTimestamp={props.experimentalTimestamp}
    >
      <AxoButton.Root variant="primary" size="md" onClick={action('onClick')}>
        {props.trigger ?? 'Hover Me'}
      </AxoButton.Root>
    </AxoTooltip.Root>
  );
}

function Example(props: ExampleProps) {
  const [boundary, setBoundary] = useState<HTMLElement | null>(null);
  return (
    <AxoTooltip.CollisionBoundary boundary={boundary}>
      <div
        className={tw('size-100 snap-both snap-mandatory overflow-auto border')}
        ref={setBoundary}
      >
        <div className={tw('flex size-250 items-center justify-center')}>
          <div className={tw('snap-center')}>
            <SimpleExample {...props} />
          </div>
        </div>
      </div>
    </AxoTooltip.CollisionBoundary>
  );
}

export function Sides(): JSX.Element {
  return (
    <Stack>
      <Row>
        <Example trigger="Top" side="top" />
        <Example trigger="Bottom" side="bottom" />
        <Example trigger="Inline Start" side="inline-start" />
        <Example trigger="Inline End" side="inline-end" />
      </Row>
      <Row>
        <Example trigger="Top" side="top" label={LONG_TEXT} />
        <Example trigger="Bottom" side="bottom" label={LONG_TEXT} />
        <Example trigger="Inline Start" side="inline-start" label={LONG_TEXT} />
        <Example trigger="Inline End" side="inline-end" label={LONG_TEXT} />
      </Row>
    </Stack>
  );
}

export function Align(): JSX.Element {
  return (
    <Stack>
      <Row>
        <Example trigger="Center" align="center" />
        <Example trigger="Center" align="force-start" />
        <Example trigger="Center" align="force-end" />
      </Row>
      <Row>
        <Example trigger="Center" align="center" label={LONG_TEXT} />
        <Example trigger="Center" align="force-start" label={LONG_TEXT} />
        <Example trigger="Center" align="force-end" label={LONG_TEXT} />
      </Row>
    </Stack>
  );
}

export function Accessories(): JSX.Element {
  return (
    <Stack>
      <Row>
        <Example trigger="None" />
        <Example trigger="Keyboard Shortcut" keyboardShortcut="⌘⇧Y" />
        <Example trigger="Timestamp" experimentalTimestamp={Date.now()} />
      </Row>
      <Row>
        <Example label={LONG_TEXT} trigger="None" />
        <Example
          label={LONG_TEXT}
          trigger="Keyboard Shortcut"
          keyboardShortcut="⌘⇧Y"
        />
        <Example
          label={LONG_TEXT}
          trigger="Timestamp"
          experimentalTimestamp={Date.now()}
        />
      </Row>
    </Stack>
  );
}

export function InScrollArea(): JSX.Element {
  return (
    <div className={tw('size-100')}>
      <AxoScrollArea.Root scrollbarWidth="thin" orientation="both">
        <AxoScrollArea.Hint edge="top" />
        <AxoScrollArea.Hint edge="bottom" />
        <AxoScrollArea.Hint edge="inline-start" />
        <AxoScrollArea.Hint edge="inline-end" />
        <AxoScrollArea.Viewport>
          <AxoScrollArea.Content>
            <div className={tw('grid w-max grid-cols-3 gap-50 p-50')}>
              {Array.from({ length: 9 }, (_, index) => {
                return <SimpleExample key={index} />;
              })}
            </div>
          </AxoScrollArea.Content>
        </AxoScrollArea.Viewport>
      </AxoScrollArea.Root>
    </div>
  );
}

export function InDialog(): JSX.Element {
  return (
    <AxoDialog.Root open>
      <AxoDialog.Content size="md" escape="cancel-is-destructive">
        <AxoDialog.Header>
          <AxoDialog.Title>Title</AxoDialog.Title>
          <AxoDialog.Close aria-label="Close" />
        </AxoDialog.Header>
        <AxoDialog.Body>
          <div className={tw('flex flex-col items-center-safe gap-50 py-50')}>
            {Array.from({ length: 6 }, (_, index) => {
              return <SimpleExample key={index} />;
            })}
          </div>
        </AxoDialog.Body>
        <AxoDialog.Footer>
          <AxoDialog.Actions>
            <AxoDialog.IconAction
              variant="primary"
              symbol="send-fill"
              label="Send message"
              onClick={action('onSave')}
            />
          </AxoDialog.Actions>
        </AxoDialog.Footer>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}
