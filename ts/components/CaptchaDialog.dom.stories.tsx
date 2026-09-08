// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useState, type JSX } from 'react';
import type { Meta } from '@storybook/react';
import { CaptchaDialog } from './CaptchaDialog.dom.tsx';
import { Button } from './Button.dom.tsx';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/CaptchaDialog',
} satisfies Meta;

export function Basic(): JSX.Element {
  const [pending, setPending] = useState(false);
  const [skipped, setSkipped] = useState(false);

  if (skipped) {
    return <Button onClick={() => setSkipped(false)}>Show again</Button>;
  }

  return (
    <CaptchaDialog
      i18n={i18n}
      pending={pending}
      onContinue={() => setPending(true)}
      onSkip={() => setSkipped(true)}
    />
  );
}
