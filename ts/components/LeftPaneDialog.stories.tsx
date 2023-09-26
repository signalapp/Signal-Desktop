// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { LeftPaneDialog } from './LeftPaneDialog';
import { WidthBreakpoint } from './_util';

const widths = {
  [WidthBreakpoint.Wide]: '400px',
  [WidthBreakpoint.Medium]: '300px',
  [WidthBreakpoint.Narrow]: '100px',
};

// eslint-disable-next-line max-len
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-explicit-any
function WidthDecorator(Story: any, context: any): JSX.Element {
  return (
    <div
      style={{
        width: widths[context.args.containerWidthBreakpoint as WidthBreakpoint],
      }}
    >
      <Story />
    </div>
  );
}

export default {
  title: 'Components/LeftPaneDialog',
  component: LeftPaneDialog,
  decorators: [WidthDecorator],
  argTypes: {
    type: {
      options: [undefined, 'warning', 'error'],
      type: 'select',
    },
    icon: {
      options: [undefined, 'update', 'relink', 'network', 'warning'],
      type: 'select',
    },
    title: {
      control: 'text',
    },
    subtitle: {
      control: 'text',
    },
    hoverText: {
      control: 'text',
      defaultValue:
        'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.',
    },
    hasXButton: {
      control: 'boolean',
    },
    hasAction: {
      control: 'boolean',
    },
    containerWidthBreakpoint: {
      options: Object.keys(WidthBreakpoint),
      mapping: WidthBreakpoint,
      type: 'select',
    },
  },
  args: {
    title: 'Lorem ipsum dolor sit amet',
    subtitle:
      'Consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    hasXButton: true,
    hasAction: true,
    onClick: (): null => null,
    clickLabel: 'Click me',
    containerWidthBreakpoint: WidthBreakpoint.Wide,
  },
};

export const Update = {
  args: {
    type: undefined,
    icon: 'update',
  },
};

export const Warning = {
  args: {
    type: 'warning',
    icon: 'warning',
  },
};

export const Error = {
  args: {
    type: 'error',
    icon: 'warning',
  },
};

export const Relink = {
  args: {
    type: undefined,
    icon: 'relink',
  },
};

export const Network = {
  args: {
    type: 'warning',
    icon: 'network',
  },
};

export const NarrowUpdate = {
  args: {
    type: undefined,
    icon: 'update',
    containerWidthBreakpoint: WidthBreakpoint.Narrow,
  },
};

export const NarrowWarning = {
  args: {
    type: 'warning',
    icon: 'warning',
    containerWidthBreakpoint: WidthBreakpoint.Narrow,
  },
};

export const NarrowError = {
  args: {
    type: 'error',
    icon: 'warning',
    containerWidthBreakpoint: WidthBreakpoint.Narrow,
  },
};
