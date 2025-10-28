// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { Meta } from '@storybook/react';
import React, { useState } from 'react';
import { ExperimentalAxoSegmentedControl } from './AxoSegmentedControl.dom.js';
import { tw } from './tw.dom.js';

export default {
  title: 'Axo/AxoSegmentedControl (Experimental)',
} satisfies Meta;

function Template(props: {
  variant: ExperimentalAxoSegmentedControl.Variant;
  width: ExperimentalAxoSegmentedControl.RootWidth;
  itemWidth: ExperimentalAxoSegmentedControl.ItemWidth;
  longNames?: boolean;
  includeBadges?: boolean;
}) {
  const [value, setValue] = useState('inbox');

  return (
    <>
      <h2 className={tw('font-mono type-title-medium')}>
        {`variant=${props.variant}, `}
        {`width=${props.width}, `}
        {`itemWidth=${props.itemWidth}`}
      </h2>
      <ExperimentalAxoSegmentedControl.Root
        variant={props.variant}
        width={props.width}
        itemWidth={props.itemWidth}
        value={value}
        onValueChange={newValue => {
          if (newValue != null) {
            setValue(newValue);
          }
        }}
      >
        <ExperimentalAxoSegmentedControl.Item value="inbox">
          <ExperimentalAxoSegmentedControl.ItemText>
            {props.longNames && 'Really Really Long Name For '}
            Inbox
          </ExperimentalAxoSegmentedControl.ItemText>
          {props.includeBadges && (
            <ExperimentalAxoSegmentedControl.ExperimentalItemBadge
              value={42}
              max={99}
              maxDisplay="99+"
              aria-label={null}
            />
          )}
        </ExperimentalAxoSegmentedControl.Item>
        <ExperimentalAxoSegmentedControl.Item value="drafts">
          <ExperimentalAxoSegmentedControl.ItemText>
            {props.longNames && 'Really Really Long Name For '}
            Drafts
          </ExperimentalAxoSegmentedControl.ItemText>
          {props.includeBadges && (
            <ExperimentalAxoSegmentedControl.ExperimentalItemBadge
              value="mention"
              max={99}
              maxDisplay="99+"
              aria-label={null}
            />
          )}
        </ExperimentalAxoSegmentedControl.Item>
        <ExperimentalAxoSegmentedControl.Item value="sent">
          <ExperimentalAxoSegmentedControl.ItemText>
            Sent
          </ExperimentalAxoSegmentedControl.ItemText>
          {props.includeBadges && (
            <ExperimentalAxoSegmentedControl.ExperimentalItemBadge
              value="unread"
              max={99}
              maxDisplay="99+"
              aria-label={null}
            />
          )}
        </ExperimentalAxoSegmentedControl.Item>
      </ExperimentalAxoSegmentedControl.Root>
    </>
  );
}

function TemplateVariants(props: {
  longNames?: boolean;
  includeBadges?: boolean;
}) {
  return (
    <div className={tw('grid gap-4')}>
      <Template variant="track" width="full" itemWidth="fit" {...props} />
      <Template variant="no-track" width="full" itemWidth="fit" {...props} />

      <Template variant="track" width="full" itemWidth="equal" {...props} />
      <Template variant="no-track" width="full" itemWidth="equal" {...props} />

      <Template variant="track" width="fit" itemWidth="fit" {...props} />
      <Template variant="no-track" width="fit" itemWidth="fit" {...props} />

      <Template variant="track" width="fit" itemWidth="equal" {...props} />
      <Template variant="no-track" width="fit" itemWidth="equal" {...props} />
    </div>
  );
}

export function Basic(): JSX.Element {
  return <TemplateVariants />;
}

export function LongNames(): JSX.Element {
  return <TemplateVariants longNames />;
}

export function WithBadges(): JSX.Element {
  return <TemplateVariants includeBadges />;
}

export function LongNamesWithBadges(): JSX.Element {
  return <TemplateVariants longNames includeBadges />;
}
