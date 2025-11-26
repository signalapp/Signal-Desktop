// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { Meta } from '@storybook/react';
import React, { useState } from 'react';
import { action } from '@storybook/addon-actions';
import { CallQualitySurveyDialog } from './CallQualitySurveyDialog.dom.js';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/CallQualitySurveyDialog',
} satisfies Meta;

export function Default(): JSX.Element {
  const [open, setOpen] = useState(true);
  return (
    <CallQualitySurveyDialog
      i18n={i18n}
      open={open}
      onOpenChange={setOpen}
      onSubmit={action('onSubmit')}
    />
  );
}
