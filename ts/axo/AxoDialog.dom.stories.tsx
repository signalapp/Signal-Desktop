// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode } from 'react';
import React, { useState } from 'react';
import type { Meta } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { AxoDialog } from './AxoDialog.dom.js';
import { AxoButton } from './AxoButton.dom.js';
import { tw } from './tw.dom.js';

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
  footerContent?: ReactNode;
  children: ReactNode;
}): JSX.Element {
  const [open, setOpen] = useState(true);
  return (
    <AxoDialog.Root open={open} onOpenChange={setOpen}>
      <AxoDialog.Trigger>
        <AxoButton.Root variant="secondary" size="medium">
          Open Dialog
        </AxoButton.Root>
      </AxoDialog.Trigger>
      <AxoDialog.Content size={props.contentSize} escape="cancel-is-noop">
        <AxoDialog.Header>
          {props.back && <AxoDialog.Back aria-label="Back" />}
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
