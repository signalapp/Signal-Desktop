// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useState, type JSX } from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { PeakType } from '../types/Audio.dom.tsx';
import type { Props } from './CompositionRecording.dom.tsx';
import { CompositionRecording } from './CompositionRecording.dom.tsx';

const { i18n } = window.SignalContext;

export default {
  title: 'components/CompositionRecording',
  component: CompositionRecording,
} satisfies Meta<Props>;

const PEAKS = new Array<PeakType>();
for (let i = 0; i < 200; i += 1) {
  PEAKS.push({
    value: ((i / 50) % 1) * 0.5,
    index: i,
  });
}

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
          saveDraftRecordingIfNeeded={action('saveDraftRecordingIfNeeded')}
          showToast={action('showToast')}
          hideToast={action('hideToast')}
          peaks={PEAKS}
        />
      )}
    </>
  );
}
