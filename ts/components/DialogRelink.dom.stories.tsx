// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX } from 'react';

import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { PropsType } from './DialogRelink.dom.tsx';
import { DialogRelink } from './DialogRelink.dom.tsx';
import { WidthBreakpoint } from './_util.std.ts';
import { FakeLeftPaneContainer } from '../test-helpers/FakeLeftPaneContainer.dom.tsx';

const { i18n } = window.SignalContext;

const defaultProps = {
  containerWidthBreakpoint: WidthBreakpoint.Wide,
  i18n,
  relinkDevice: action('relink-device'),
  renderClearingDataView: action('render-clearing-data-view'),
  reregister: action('reregister'),
  weArePrimaryDevice: false,
};

const permutations = [
  {
    title: 'Unlinked (wide container)',
    props: {
      containerWidthBreakpoint: WidthBreakpoint.Wide,
    },
  },
  {
    title: 'Unlinked (narrow container)',
    props: {
      containerWidthBreakpoint: WidthBreakpoint.Narrow,
    },
  },
];

export default {
  title: 'Components/DialogRelink',
} satisfies Meta<PropsType>;

export function Iterations(): JSX.Element {
  return (
    <>
      {permutations.map(({ props, title }, index) => (
        <>
          {index > 0 && <br />}
          <h3>{title}</h3>
          <FakeLeftPaneContainer
            containerWidthBreakpoint={props.containerWidthBreakpoint}
          >
            <DialogRelink {...defaultProps} {...props} />
          </FakeLeftPaneContainer>
        </>
      ))}
    </>
  );
}

export function IterationsStandalone(): JSX.Element {
  return (
    <>
      {permutations.map(({ props, title }, index) => (
        <>
          {index > 0 && <br />}
          <h3>{title}</h3>
          <FakeLeftPaneContainer
            containerWidthBreakpoint={props.containerWidthBreakpoint}
          >
            <DialogRelink {...defaultProps} {...props} weArePrimaryDevice />
          </FakeLeftPaneContainer>
        </>
      ))}
    </>
  );
}
