// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { action } from '@storybook/addon-actions';

import type { PropsType } from './CallingScreenSharingController';
import { CallingScreenSharingController } from './CallingScreenSharingController';

import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  i18n,
  onCloseController: action('on-close-controller'),
  onStopSharing: action('on-stop-sharing'),
  presentedSourceName: overrideProps.presentedSourceName || 'Application',
});

export default {
  title: 'Components/CallingScreenSharingController',
};

export const Controller = (): JSX.Element => {
  return <CallingScreenSharingController {...createProps()} />;
};

export const ReallyLongAppName = (): JSX.Element => {
  return (
    <CallingScreenSharingController
      {...createProps({
        presentedSourceName:
          'A really long application name that is super long',
      })}
    />
  );
};

ReallyLongAppName.story = {
  name: 'Really long app name',
};
