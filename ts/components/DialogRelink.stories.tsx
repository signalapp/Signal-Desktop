// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { boolean } from '@storybook/addon-knobs';
import { action } from '@storybook/addon-actions';

import { DialogRelink } from './DialogRelink';
import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';
import { WidthBreakpoint } from './_util';
import { FakeLeftPaneContainer } from '../test-both/helpers/FakeLeftPaneContainer';

const i18n = setupI18n('en', enMessages);

const defaultProps = {
  containerWidthBreakpoint: WidthBreakpoint.Wide,
  i18n,
  isRegistrationDone: true,
  relinkDevice: action('relink-device'),
};

const permutations = [
  {
    title: 'Unlinked (wide container)',
    props: {
      containerWidthBreakpoint: WidthBreakpoint.Wide,
      isRegistrationDone: false,
    },
  },
  {
    title: 'Unlinked (narrow container)',
    props: {
      containerWidthBreakpoint: WidthBreakpoint.Narrow,
      isRegistrationDone: false,
    },
  },
];

export default {
  title: 'Components/DialogRelink',
};

export const KnobsPlayground = (): JSX.Element => {
  const isRegistrationDone = boolean('isRegistrationDone', false);

  return (
    <DialogRelink {...defaultProps} isRegistrationDone={isRegistrationDone} />
  );
};

export const Iterations = (): JSX.Element => {
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
};
