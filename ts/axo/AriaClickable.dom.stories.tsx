// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode } from 'react';
import React, { useId } from 'react';
import type { Meta } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { AriaClickable } from './AriaClickable.dom.js';
import { AxoButton } from './AxoButton.dom.js';
import { tw } from './tw.dom.js';

export default {
  title: 'Axo/AriaClickable',
} satisfies Meta;

function Card(props: { children: ReactNode }) {
  return (
    <AriaClickable.Root
      className={tw(
        'group flex items-center gap-4 rounded-md border border-border-secondary p-4',
        'data-[hovered]:bg-background-secondary',
        'data-[pressed]:bg-fill-secondary-pressed',
        'outline-0 outline-border-focused',
        'data-[focused]:outline-[2.5px]'
      )}
    >
      {props.children}
    </AriaClickable.Root>
  );
}

function CardTitle(props: { children: ReactNode }) {
  return (
    <h3 className={tw('type-title-medium text-label-primary')}>
      {props.children}
    </h3>
  );
}

function CardContent(props: { children: ReactNode }) {
  return <div className={tw('flex-1')}>{props.children}</div>;
}

function CardSeeMoreLink(props: { onClick: () => void; children: ReactNode }) {
  const id = useId();
  return (
    <>
      <span
        id={id}
        className={tw(
          'text-color-label-primary',
          'group-data-[hovered]:underline'
        )}
      >
        {props.children}
      </span>
      <AriaClickable.HiddenTrigger
        aria-labelledby={id}
        onClick={props.onClick}
      />
    </>
  );
}

function CardActions(props: { children: ReactNode }) {
  return (
    <AriaClickable.DeadArea
      className={tw('flex w-fit shrink-0 items-center gap-4 rounded-full')}
    >
      {props.children}
    </AriaClickable.DeadArea>
  );
}

function CardButton(props: {
  variant: AxoButton.Variant;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <AriaClickable.SubWidget>
      <AxoButton.Root
        variant={props.variant}
        size="medium"
        onClick={props.onClick}
      >
        {props.children}
      </AxoButton.Root>
    </AriaClickable.SubWidget>
  );
}

export function Basic(): JSX.Element | null {
  return (
    <Card>
      <CardContent>
        <CardTitle>Card Title</CardTitle>
        <p>
          Lorem ipsum dolor, sit amet consectetur adipisicing elit...{' '}
          <CardSeeMoreLink onClick={action('onSeeMore')}>
            See more
          </CardSeeMoreLink>
        </p>
      </CardContent>
      <CardActions>
        <CardButton variant="borderless-primary" onClick={action('onEdit')}>
          Edit
        </CardButton>
        <CardButton variant="destructive" onClick={action('onDelete')}>
          Delete
        </CardButton>
      </CardActions>
    </Card>
  );
}
