// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import type { Meta } from '@storybook/react';
import { AxoTextField } from './AxoTextField.dom.tsx';
import { tw } from './tw.dom.tsx';
import type { AxoSymbol } from './AxoSymbol.dom.tsx';
import { assert } from './_internal/assert.std.tsx';

export default {
  title: 'Axo/AxoTextField',
} satisfies Meta;

function Stack(props: { children: ReactNode }) {
  return (
    <div className={tw('flex flex-col gap-2 pb-20')}>{props.children}</div>
  );
}

function Heading(props: { children: ReactNode }) {
  return (
    <h2
      className={tw(
        'mt-4 first:mt-0',
        'type-title-small font-semibold text-label-primary'
      )}
    >
      {props.children}
    </h2>
  );
}

function Hint(props: { children: ReactNode }) {
  return (
    <p className={tw('type-body-medium text-label-secondary')}>
      {props.children}
    </p>
  );
}

function Warn(props: { children: ReactNode }) {
  return (
    <p className={tw('type-body-medium text-color-label-destructive italic')}>
      Warning: {props.children}
    </p>
  );
}

function Code(props: { children: ReactNode }) {
  return (
    <code
      className={tw(
        'inline-block rounded-xs bg-background-secondary px-0.5 font-mono'
      )}
    >
      {props.children}
    </code>
  );
}

const MAX_GRAPHEMES_SHORT = 20;
const MAX_BYTES_SHORT = 25;

function TemplateRoot(props: AxoTextField.RootProps) {
  const { width, children, ...rest } = props;
  return (
    <AxoTextField.Root width={width ?? 'sm'} {...rest}>
      {children}
    </AxoTextField.Root>
  );
}

type TemplateInputProps = Readonly<{
  ref?: AxoTextField.InputProps['ref'];
  defaultValue?: string;
  placeholder?: string;
  showCount?: boolean;
  showClear?: boolean;
  sizing?: AxoTextField.Sizing;
  disabled?: boolean;
}>;

function TemplateInput(props: TemplateInputProps) {
  const fallbackValue =
    props.showCount || props.showClear ? 'jamie was here' : '';
  const defaultValue = props.defaultValue ?? fallbackValue;
  const [value, setValue] = useState(defaultValue);

  return (
    <AxoTextField.Input
      ref={props.ref}
      placeholder={props.placeholder ?? 'Type something'}
      value={value}
      onValueChange={setValue}
      maxGraphemes={props.showCount ? MAX_GRAPHEMES_SHORT : 200}
      maxBytes={props.showCount ? MAX_BYTES_SHORT : 800}
      showCount={props.showCount}
      showClear={props.showClear}
      sizing={props.sizing}
      disabled={props.disabled}
    />
  );
}

type TemplateProps = Readonly<{
  ref?: AxoTextField.InputProps['ref'];
  defaultValue?: string;
  placeholder?: string;
  width?: AxoTextField.Width;
  symbol?: AxoSymbol.IconName;
  showCount?: boolean;
  showClear?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
  sizing?: AxoTextField.Sizing;
  disabled?: boolean;
}>;

function Template(props: TemplateProps): ReactNode {
  return (
    <TemplateRoot
      width={props.width}
      symbol={props.symbol}
      disabled={props.disabled}
    >
      {props.leading}
      <TemplateInput
        ref={props.ref}
        defaultValue={props.defaultValue}
        placeholder={props.placeholder}
        showCount={props.showCount}
        showClear={props.showClear}
        sizing={props.sizing}
      />
      {props.trailing}
    </TemplateRoot>
  );
}

const EMOJI_ACTION = (
  <AxoTextField.Action label="Insert emoji" symbol="emoji" />
);
const MENU_ACTION = <AxoTextField.Action label="More actions" symbol="menu" />;

export function Sizes(): ReactNode {
  return (
    <Stack>
      <Heading>Sizes</Heading>

      <Template placeholder="Extra small" width="xs" />
      <Template placeholder="Small" width="sm" />
      <Template placeholder="Medium" width="md" />
      <Template placeholder="Large" width="lg" />
      <Template placeholder="Extra Large" width="xl" />
      <Template placeholder="Full" width="full" />

      <Heading>With Fit-Content</Heading>
      <Hint>
        Type to expand the width of inputs until it fills the available space
      </Hint>
      <Template placeholder="Extra small" width="xs" sizing="grow" />
      <Template placeholder="Small" width="sm" sizing="grow" />
      <Template placeholder="Medium" width="md" sizing="grow" />
      <Template placeholder="Large" width="lg" sizing="grow" />
      <Template placeholder="Extra Large" width="xl" sizing="grow" />
      <Template placeholder="Full" width="full" sizing="grow" />

      <Heading>With multiple segments</Heading>
      <TemplateRoot symbol="at">
        <TemplateInput placeholder="Username" sizing="fixed" />
        <AxoTextField.Separator />
        <TemplateInput placeholder="00" sizing="fit" />
      </TemplateRoot>

      <TemplateRoot symbol="at" width="full">
        <TemplateInput placeholder="Username" sizing="grow" />
        <AxoTextField.Separator />
        <TemplateInput placeholder="00" sizing="fit" />
      </TemplateRoot>
    </Stack>
  );
}

function InvalidTemplate(props: TemplateProps) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    assert(ref.current).setCustomValidity('invalid');
  }, []);

  return <Template ref={ref} {...props} />;
}

export function Invalid(): ReactNode {
  return (
    <Stack>
      <Heading>Invalid</Heading>
      <InvalidTemplate />
      <InvalidTemplate symbol="label" />
      <InvalidTemplate symbol="label" showCount showClear />
      <InvalidTemplate showCount showClear leading={EMOJI_ACTION} />
    </Stack>
  );
}

export function Disabled(): ReactNode {
  return (
    <Stack>
      <Heading>Disabled</Heading>

      <Template symbol="label" disabled />
      <Template symbol="label" showClear showCount disabled />
      <Template showClear showCount leading={EMOJI_ACTION} disabled />
    </Stack>
  );
}

export function Icon(): ReactNode {
  return (
    <Stack>
      <Heading>Icon</Heading>
      <Hint>
        Icons should always be at the start, with no other leading actions.
      </Hint>
      <Template placeholder="Staff" symbol="label" />
      <Template
        defaultValue="Adrians friend from Arizona"
        placeholder="Enter a note"
        symbol="note"
      />
      <Template placeholder="filename.zip" symbol="file" />
    </Stack>
  );
}

export function Clear(): ReactNode {
  const placeholder = 'wow, you cleared and left no crumbs';
  return (
    <Stack>
      <Heading>Clear</Heading>
      <Hint>
        Clear buttons should always be at the end, after count, with no other
        trailing actions.
      </Hint>
      <Template placeholder={placeholder} showClear />
      <Warn>
        Do not conditionally render <Code>&lt;Clear&gt;</Code>
      </Warn>

      <Heading>With other elements</Heading>
      <Template placeholder={placeholder} symbol="note" showCount showClear />
      <Template
        placeholder={placeholder}
        showClear
        showCount
        leading={EMOJI_ACTION}
      />
    </Stack>
  );
}

export function Count(): ReactNode {
  return (
    <Stack>
      <Heading>Count</Heading>
      <Hint>Count should always be at the end before any actions.</Hint>

      <Template defaultValue="" placeholder="Empty" showCount />
      <Template
        defaultValue={'25%'.padEnd(MAX_GRAPHEMES_SHORT * 0.25, '.')}
        showCount
      />
      <Template
        defaultValue={'49%'.padEnd(MAX_GRAPHEMES_SHORT * 0.49_99, '.')}
        showCount
      />
      <Template
        defaultValue={'50%'.padEnd(MAX_GRAPHEMES_SHORT * 0.5, '.')}
        showCount
      />
      <Template
        defaultValue={'74%'.padEnd(MAX_GRAPHEMES_SHORT * 0.74_99, '.')}
        showCount
      />
      <Template
        defaultValue={'75%'.padEnd(MAX_GRAPHEMES_SHORT * 0.75, '.')}
        showCount
      />
      <Template
        defaultValue={'100%'.padEnd(MAX_GRAPHEMES_SHORT * 1.0, '.')}
        showCount
      />
      <Template
        defaultValue={'Initial value is too long'.padEnd(
          MAX_GRAPHEMES_SHORT * 1.5,
          '.'
        )}
        showCount
      />
      <Warn>
        Do not conditionally render <Code>&lt;Count&gt;</Code>
      </Warn>

      <Heading>With other elements</Heading>
      <Template symbol="label" showCount showClear />
      <Template symbol="note" showCount trailing={EMOJI_ACTION} />
    </Stack>
  );
}

export function Actions(): ReactNode {
  return (
    <Stack>
      <Heading>Leading Actions</Heading>
      <Hint>Leading actions should be the only item at the start</Hint>
      <Template leading={EMOJI_ACTION} />
      <Template leading={EMOJI_ACTION} showCount showClear />

      <Heading>Trailing Actions</Heading>
      <Hint>
        Trailing actions should be the only item at the end, except for count
      </Hint>
      <Template trailing={EMOJI_ACTION} />
      <Template showCount trailing={EMOJI_ACTION} />
      <Template symbol="note" showCount trailing={EMOJI_ACTION} />

      <Heading>Leading + Trailing Actions</Heading>
      <Template leading={EMOJI_ACTION} trailing={MENU_ACTION} />
      <Template showCount leading={EMOJI_ACTION} trailing={MENU_ACTION} />
    </Stack>
  );
}

export function Segmented(): ReactNode {
  return (
    <Stack>
      <Heading>Segmented</Heading>
      <TemplateRoot symbol="at">
        <TemplateInput placeholder="Username" sizing="grow" />
        <AxoTextField.Separator />
        <TemplateInput placeholder="00" sizing="fit" />
      </TemplateRoot>

      <TemplateRoot symbol="at">
        <TemplateInput
          placeholder="Username"
          defaultValue="signaldesktop"
          sizing="grow"
          showCount
        />
        <AxoTextField.Separator />
        <TemplateInput defaultValue="42" placeholder="00" sizing="fit" />
      </TemplateRoot>
    </Stack>
  );
}
