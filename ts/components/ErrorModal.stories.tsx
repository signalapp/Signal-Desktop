// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { text } from '@storybook/addon-knobs';
import { action } from '@storybook/addon-actions';

import type { PropsType } from './ErrorModal';
import { ErrorModal } from './ErrorModal';

import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  title: text('title', overrideProps.title || ''),
  description: text('description', overrideProps.description || ''),
  buttonText: text('buttonText', overrideProps.buttonText || ''),
  i18n,
  onClose: action('onClick'),
});

storiesOf('Components/ErrorModal', module).add('Normal', () => {
  return <ErrorModal {...createProps()} />;
});

storiesOf('Components/ErrorModal', module).add('Custom Strings', () => {
  return (
    <ErrorModal
      {...createProps({
        title: 'Real bad!',
        description: 'Just avoid that next time, kay?',
        buttonText: 'Fine',
      })}
    />
  );
});
