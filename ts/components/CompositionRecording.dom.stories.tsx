// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState } from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { Props } from './CompositionRecording.dom.js';
import { CompositionRecording } from './CompositionRecording.dom.js';

const { i18n } = window.SignalContext;

export default {
  title: 'components/CompositionRecording',
  component: CompositionRecording,
} satisfies Meta<Props>;

export function Default(): JSX.Element {
  const [active, setActive] = useState(false);

  const cancel = action('cancel');
  const send = action('send');

  const handleActivate = () => {
    setActive(true);
  };

  const handleCancel = () => {
    cancel();
    setActive(false);
  };
  const handleSend = () => {
    send();
    setActive(false);
  };

  return (
    <>
      {!active && (
        <button type="button" onClick={handleActivate}>
          Activate
        </button>
      )}
      {active && (
        <CompositionRecording
          i18n={i18n}
          onCancel={handleCancel}
          onSend={handleSend}
          errorRecording={_ => action('error')()}
          addAttachment={action('addAttachment')}
          completeRecording={action('completeRecording')}
          saveDraftRecordingIfNeeded={action('saveDraftRecordingIfNeeded')}
          showToast={action('showToast')}
          hideToast={action('hideToast')}
        />
      )}
    </>
  );
}
