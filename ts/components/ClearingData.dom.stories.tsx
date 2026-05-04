// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX } from 'react';

import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { PropsType } from './ClearingData.dom.tsx';
import { ClearingData } from './ClearingData.dom.tsx';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/ClearingData',
} satisfies Meta<PropsType>;

export function CallbackNotCalledYet(): JSX.Element {
  return <ClearingData deleteAllData={action('deleteAllData')} i18n={i18n} />;
}

export function LeavingGroups(): JSX.Element {
  return (
    <ClearingData
      deleteAllData={callback => {
        callback('leaving-groups');
      }}
      i18n={i18n}
    />
  );
}

export function DeletingAccount(): JSX.Element {
  return (
    <ClearingData
      deleteAllData={callback => {
        callback('deleting-account');
      }}
      i18n={i18n}
    />
  );
}

export function DeletingData(): JSX.Element {
  return (
    <ClearingData
      deleteAllData={callback => {
        callback('deleting-data');
      }}
      i18n={i18n}
    />
  );
}
