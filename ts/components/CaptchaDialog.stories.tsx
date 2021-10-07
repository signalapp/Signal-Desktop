// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState } from 'react';
import { action } from '@storybook/addon-actions';
import { boolean } from '@storybook/addon-knobs';
import { storiesOf } from '@storybook/react';

import { CaptchaDialog } from './CaptchaDialog';
import { Button } from './Button';
import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';

const story = storiesOf('Components/CaptchaDialog', module);

const i18n = setupI18n('en', enMessages);

story.add('CaptchaDialog', () => {
  const [isSkipped, setIsSkipped] = useState(false);

  if (isSkipped) {
    return <Button onClick={() => setIsSkipped(false)}>Show again</Button>;
  }

  return (
    <CaptchaDialog
      i18n={i18n}
      isPending={boolean('isPending', false)}
      onContinue={action('onContinue')}
      onSkip={() => setIsSkipped(true)}
    />
  );
});
