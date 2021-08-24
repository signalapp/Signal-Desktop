// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import {
  CallingScreenSharingController,
  PropsType,
} from './CallingScreenSharingController';

import { setup as setupI18n } from '../../js/modules/i18n';
import enMessages from '../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  i18n,
  onCloseController: action('on-close-controller'),
  onStopSharing: action('on-stop-sharing'),
  presentedSourceName: overrideProps.presentedSourceName || 'Application',
});

const story = storiesOf('Components/CallingScreenSharingController', module);

story.add('Controller', () => {
  return <CallingScreenSharingController {...createProps()} />;
});

story.add('Really long app name', () => {
  return (
    <CallingScreenSharingController
      {...createProps({
        presentedSourceName:
          'A really long application name that is super long',
      })}
    />
  );
});
