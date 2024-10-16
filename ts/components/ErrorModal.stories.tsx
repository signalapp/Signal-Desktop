// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';

import type { Meta } from '@storybook/react';
import type { PropsType } from './ErrorModal';
import { ErrorModal } from './ErrorModal';

import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';
import { ButtonVariant } from './Button';

const i18n = setupI18n('en', enMessages);

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  buttonVariant: overrideProps.buttonVariant ?? undefined,
  description: overrideProps.description ?? '',
  title: Object.hasOwn(overrideProps, 'title') ? overrideProps.title : '',
  i18n,
  onClose: action('onClick'),
});

export default {
  title: 'Components/ErrorModal',
  argTypes: {},
  args: {},
} satisfies Meta<PropsType>;

export function Normal(): JSX.Element {
  return <ErrorModal {...createProps()} />;
}

export function PrimaryButton(): JSX.Element {
  return (
    <ErrorModal {...createProps({ buttonVariant: ButtonVariant.Primary })} />
  );
}

export function CustomStrings(): JSX.Element {
  return (
    <ErrorModal
      {...createProps({
        title: 'Real bad!',
        description: 'Just avoid that next time, kay?',
      })}
    />
  );
}

export function NoTitle(): JSX.Element {
  return (
    <ErrorModal
      {...createProps({
        title: null,
        description: 'This is a fun error!',
      })}
    />
  );
}
