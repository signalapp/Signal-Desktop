// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { PropsType } from './DialogRelink.dom.js';
import { DialogRelink } from './DialogRelink.dom.js';
import { WidthBreakpoint } from './_util.std.js';
import { FakeLeftPaneContainer } from '../test-helpers/FakeLeftPaneContainer.dom.js';

const { i18n } = window.SignalContext;

const defaultProps = {
  containerWidthBreakpoint: WidthBreakpoint.Wide,
  i18n,
  relinkDevice: action('relink-device'),
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
      {permutations.map(({ props, title }) => (
        <>
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
