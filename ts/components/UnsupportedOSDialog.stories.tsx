// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import type { Meta } from '@storybook/react';
import { UnsupportedOSDialog } from './UnsupportedOSDialog';
import type { PropsType } from './UnsupportedOSDialog';
import { setupI18n } from '../util/setupI18n';
import { DAY } from '../util/durations';
import enMessages from '../../_locales/en/messages.json';
import { WidthBreakpoint } from './_util';
import { FakeLeftPaneContainer } from '../test-both/helpers/FakeLeftPaneContainer';

const i18n = setupI18n('en', enMessages);

const defaultProps: PropsType = {
  containerWidthBreakpoint: WidthBreakpoint.Wide,
  OS: 'macOS',
  expirationTimestamp: Date.now() + 5 * DAY,
  i18n,
  type: 'warning',
};

const permutations: ReadonlyArray<{
  title: string;
  props: Partial<PropsType>;
}> = [
  {
    title: 'Warning (wide container)',
    props: {
      containerWidthBreakpoint: WidthBreakpoint.Wide,
      type: 'warning',
    },
  },
  {
    title: 'Warning (narrow container)',
    props: {
      containerWidthBreakpoint: WidthBreakpoint.Narrow,
      type: 'warning',
    },
  },
  {
    title: 'Error (wide container)',
    props: {
      containerWidthBreakpoint: WidthBreakpoint.Wide,
      type: 'error',
    },
  },
  {
    title: 'Error (narrow container)',
    props: {
      containerWidthBreakpoint: WidthBreakpoint.Narrow,
      type: 'error',
    },
  },
];

export default {
  title: 'Components/UnsupportedOSDialog',
} satisfies Meta<PropsType>;

export function Iterations(): JSX.Element {
  return (
    <>
      {permutations.map(({ props, title }) => (
        <>
          <h3>{title}</h3>
          <FakeLeftPaneContainer
            containerWidthBreakpoint={
              props.containerWidthBreakpoint ?? WidthBreakpoint.Wide
            }
          >
            <UnsupportedOSDialog {...defaultProps} {...props} />
          </FakeLeftPaneContainer>
        </>
      ))}
    </>
  );
}
