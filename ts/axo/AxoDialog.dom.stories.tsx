// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode } from 'react';
import React, { useId, useMemo, useState } from 'react';
import type { Meta } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { AxoDialog } from './AxoDialog.dom.js';
import { AxoButton } from './AxoButton.dom.js';
import { tw } from './tw.dom.js';
import { AxoCheckbox } from './AxoCheckbox.dom.js';

export default {
  title: 'Axo/AxoDialog',
} satisfies Meta;

const TEXT_SHORT = <>Lorem ipsum dolor</>;

const TEXT_LONG = (
  <>
    Lorem ipsum dolor sit amet consectetur, adipisicing elit. Eum repudiandae
    repellendus quo natus, placeat incidunt neque, exercitationem itaque, error
    molestiae omnis laudantium? Ex aperiam quas impedit ut ratione cumque
    repudiandae!
  </>
);

function Box(props: { children: ReactNode }) {
  return (
    <div
      className={tw(
        'flex items-center justify-center rounded-2xl bg-color-fill-primary p-10 type-title-large font-semibold text-label-primary-on-color'
      )}
    >
      {props.children}
    </div>
  );
}

function Template(props: {
  back?: boolean;
  contentSize: AxoDialog.ContentSize;
  bodyPadding?: AxoDialog.BodyPadding;
  iconAction?: boolean;
  footerContent?: ReactNode;
  children: ReactNode;
}): JSX.Element {
  const [open, setOpen] = useState(true);
  return (
    <AxoDialog.Root open={open} onOpenChange={setOpen}>
      <AxoDialog.Trigger>
        <AxoButton.Root variant="secondary" size="md">
          Open Dialog
        </AxoButton.Root>
      </AxoDialog.Trigger>
      <AxoDialog.Content size={props.contentSize} escape="cancel-is-noop">
        <AxoDialog.Header>
          {props.back && (
            <AxoDialog.Back aria-label="Back" onClick={action('onBack')} />
          )}
          <AxoDialog.Title>Title</AxoDialog.Title>
          <AxoDialog.Close aria-label="Close" />
        </AxoDialog.Header>
        <AxoDialog.Body padding={props.bodyPadding}>
          {props.children}
        </AxoDialog.Body>
        <AxoDialog.Footer>
          {props.footerContent && (
            <AxoDialog.FooterContent>
              {props.footerContent}
            </AxoDialog.FooterContent>
          )}
          <AxoDialog.Actions>
            {props.iconAction ? (
              <AxoDialog.IconAction
                aria-label="Send"
                variant="primary"
                symbol="send-fill"
                onClick={action('onSend')}
              />
            ) : (
              <>
                <AxoDialog.Action
                  variant="secondary"
                  onClick={action('onCancel')}
                >
                  Cancel
                </AxoDialog.Action>
                <AxoDialog.Action variant="primary" onClick={action('onSave')}>
                  Save
                </AxoDialog.Action>
              </>
            )}
          </AxoDialog.Actions>
        </AxoDialog.Footer>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}

export function Basic(): JSX.Element {
  return (
    <Template contentSize="md">
      <p>
        Lorem ipsum dolor sit amet consectetur adipisicing elit. Laboriosam est
        cum consequuntur natus repudiandae vel aperiam minus pariatur,
        repellendus reprehenderit ad unde, sit magnam dicta ut deleniti veniam
        modi ea.
      </p>
    </Template>
  );
}

export function Small(): JSX.Element {
  return <Template contentSize="sm">{TEXT_LONG}</Template>;
}

export function Large(): JSX.Element {
  return <Template contentSize="lg">{TEXT_LONG}</Template>;
}

export function IconAction(): JSX.Element {
  return (
    <Template contentSize="sm" iconAction>
      {TEXT_SHORT}
    </Template>
  );
}

export function LongContent(): JSX.Element {
  return (
    <Template contentSize="md">
      <div className={tw('flex flex-col gap-2')}>
        {Array.from({ length: 10 }, (_, index) => {
          return <Box key={index}>{index + 1}</Box>;
        })}
      </div>
    </Template>
  );
}

export function BackButton(): JSX.Element {
  return (
    <Template contentSize="md" back>
      {TEXT_LONG}
    </Template>
  );
}

export function FooterContent(): JSX.Element {
  return (
    <Template contentSize="md" footerContent={TEXT_SHORT}>
      {TEXT_LONG}
    </Template>
  );
}

export function FooterContentLong(): JSX.Element {
  return (
    <Template contentSize="md" footerContent={TEXT_LONG}>
      {TEXT_LONG}
    </Template>
  );
}

export function FooterContentLongAndTight(): JSX.Element {
  return (
    <Template contentSize="sm" footerContent={TEXT_LONG}>
      {TEXT_LONG}
    </Template>
  );
}

function Spacer(props: { height: 8 | 12 }) {
  return <div style={{ height: props.height }} />;
}

function TextInputField(props: { placeholder: string }) {
  const style = useMemo(() => {
    const bodyPadding = 24;
    const inputPadding = 16;

    return { marginInline: inputPadding - bodyPadding };
  }, []);

  return (
    <div className={tw('py-1.5')} style={style}>
      <input
        placeholder={props.placeholder}
        className={tw(
          'w-full px-3 py-1.5',
          'border-[0.5px] border-border-primary shadow-elevation-0',
          'rounded-lg bg-fill-primary',
          'placeholder:text-label-placeholder',
          'forced-colors:border forced-colors:border-[ButtonBorder] forced-colors:bg-[ButtonFace] forced-colors:text-[ButtonText]'
        )}
      />
    </div>
  );
}

export function ExampleNicknameAndNoteDialog(): JSX.Element {
  const [open, setOpen] = useState(true);
  return (
    <AxoDialog.Root open={open} onOpenChange={setOpen}>
      <AxoDialog.Trigger>
        <AxoButton.Root variant="secondary" size="md">
          Open Dialog
        </AxoButton.Root>
      </AxoDialog.Trigger>
      <AxoDialog.Content size="sm" escape="cancel-is-destructive">
        <AxoDialog.Header>
          <AxoDialog.Title>Nickname</AxoDialog.Title>
          <AxoDialog.Close aria-label="Close" />
        </AxoDialog.Header>
        <AxoDialog.Body>
          <p className={tw('mb-4 type-body-small text-label-secondary')}>
            Nicknames &amp; notes are stored with Signal and end-to-end
            encrypted. They are only visible to you.
          </p>
          <div
            className={tw(
              'mx-auto size-20 rounded-full bg-color-fill-primary',
              'forced-colors:border'
            )}
          />
          <Spacer height={12} />
          <TextInputField placeholder="First name" />
          <TextInputField placeholder="Last name" />
          <TextInputField placeholder="Note" />
          <Spacer height={12} />
        </AxoDialog.Body>
        <AxoDialog.Footer>
          <AxoDialog.Actions>
            <AxoDialog.Action variant="secondary" onClick={action('onCancel')}>
              Cancel
            </AxoDialog.Action>
            <AxoDialog.Action variant="primary" onClick={action('onSave')}>
              Save
            </AxoDialog.Action>
          </AxoDialog.Actions>
        </AxoDialog.Footer>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}

function CheckboxField(props: { label: string }) {
  const id = useId();
  const [checked, setChecked] = useState(false);

  return (
    <div className={tw('flex gap-3 py-2.5')}>
      <AxoCheckbox.Root
        id={id}
        variant="square"
        checked={checked}
        onCheckedChange={setChecked}
      />
      <label
        htmlFor={id}
        className={tw('truncate type-body-large text-label-primary')}
      >
        {props.label}
      </label>
    </div>
  );
}

export function ExampleMuteNotificationsDialog(): JSX.Element {
  const [open, setOpen] = useState(true);
  return (
    <AxoDialog.Root open={open} onOpenChange={setOpen}>
      <AxoDialog.Trigger>
        <AxoButton.Root variant="secondary" size="md">
          Open Dialog
        </AxoButton.Root>
      </AxoDialog.Trigger>
      <AxoDialog.Content size="sm" escape="cancel-is-noop">
        <AxoDialog.Header>
          <AxoDialog.Title>Mute notifications</AxoDialog.Title>
          <AxoDialog.Close aria-label="Close" />
        </AxoDialog.Header>
        <AxoDialog.Body>
          <Spacer height={8} />
          <CheckboxField label="Mute for 1 hour" />
          <CheckboxField label="Mute for 8 hours" />
          <CheckboxField label="Mute for 1 day" />
          <CheckboxField label="Mute for 1 week" />
          <CheckboxField label="Mute always" />
          <Spacer height={8} />
        </AxoDialog.Body>
        <AxoDialog.Footer>
          <AxoDialog.Actions>
            <AxoDialog.Action variant="secondary" onClick={action('onCancel')}>
              Cancel
            </AxoDialog.Action>
            <AxoDialog.Action variant="primary" onClick={action('onSave')}>
              Save
            </AxoDialog.Action>
          </AxoDialog.Actions>
        </AxoDialog.Footer>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}

function ExampleItem(props: { label: string; description: string }) {
  const labelId = useId();
  const descriptionId = useId();

  return (
    <div
      role="option"
      aria-selected={false}
      aria-labelledby={labelId}
      aria-describedby={descriptionId}
      tabIndex={0}
      className={tw('rounded-lg px-[13px] py-2.5 hover:bg-fill-secondary')}
    >
      <div
        id={labelId}
        className={tw('truncate type-body-large text-label-primary')}
      >
        {props.label}
      </div>
      <div
        id={descriptionId}
        className={tw('truncate type-body-small text-label-secondary')}
      >
        {props.description}
      </div>
    </div>
  );
}

export function ExampleLanguageDialog(): JSX.Element {
  const [open, setOpen] = useState(true);
  return (
    <AxoDialog.Root open={open} onOpenChange={setOpen}>
      <AxoDialog.Trigger>
        <AxoButton.Root variant="secondary" size="md">
          Open Dialog
        </AxoButton.Root>
      </AxoDialog.Trigger>
      <AxoDialog.Content size="sm" escape="cancel-is-noop">
        <AxoDialog.Header>
          <AxoDialog.Title>Language</AxoDialog.Title>
          <AxoDialog.Close aria-label="Close" />
        </AxoDialog.Header>
        <AxoDialog.ExperimentalSearch>
          <input
            type="search"
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            placeholder="Search languages"
            className={tw(
              'w-full rounded-lg bg-fill-secondary px-3 py-[5px]',
              'forced-colors:border forced-colors:border-[ButtonBorder] forced-colors:bg-[ButtonFace] forced-colors:text-[ButtonText]'
            )}
          />
        </AxoDialog.ExperimentalSearch>
        <AxoDialog.Body padding="only-scrollbar-gutter">
          <div
            role="listbox"
            style={{
              paddingInline:
                'calc(11px - var(--axo-scrollbar-gutter-thin-vertical)',
            }}
          >
            <ExampleItem label="System Language" description="English" />
            <ExampleItem label="Afrikaans" description="Afrikaans" />
            <ExampleItem label="Arabic" description="العربية" />
            <ExampleItem label="Azerbaijani" description="Azərbaycan dili" />
            <ExampleItem label="Bulgarian" description="Български" />
            <ExampleItem label="Bangla" description="বাংলা" />
            <ExampleItem label="Bosnian" description="bosanski" />
            <ExampleItem label="Catalan" description="català" />
            <ExampleItem label="Czech" description="Čeština" />
          </div>
        </AxoDialog.Body>
        <AxoDialog.Footer>
          <AxoDialog.Actions>
            <AxoDialog.Action variant="secondary" onClick={action('onCancel')}>
              Cancel
            </AxoDialog.Action>
            <AxoDialog.Action variant="primary" onClick={action('onSet')}>
              Set
            </AxoDialog.Action>
          </AxoDialog.Actions>
        </AxoDialog.Footer>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}
