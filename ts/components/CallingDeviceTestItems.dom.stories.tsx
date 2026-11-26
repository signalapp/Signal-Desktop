// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode } from 'react';
import type { Meta } from '@storybook/react';
import type { CallingDeviceTestItemsProps } from './CallingDeviceTestItems.dom.tsx';
import { CallingDeviceTestItems } from './CallingDeviceTestItems.dom.tsx';
import { PreferencesList } from './preferences/PreferencesList.dom.tsx';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/CallingDeviceTestItems',
} satisfies Meta;

function Template(props: Partial<CallingDeviceTestItemsProps>): ReactNode {
  return (
    <PreferencesList label={i18n('icu:Preferences__devices')}>
      <CallingDeviceTestItems
        i18n={i18n}
        selectedMicrophone={{ type: 'nonWindowsDefault' }}
        selectedSpeaker={{ type: 'nonWindowsDefault' }}
        requestMicrophoneAccess={async () => true}
        {...props}
      />
    </PreferencesList>
  );
}

export function Default(): ReactNode {
  return <Template />;
}

export function Testing(): ReactNode {
  return (
    <Template initialMicrophoneTestStatus="running" initialAudioLevel={0.75} />
  );
}

export function PermissionDenied(): ReactNode {
  return <Template initialMicrophoneTestStatus="permission-denied" />;
}

export function Failed(): ReactNode {
  return <Template initialMicrophoneTestStatus="failed" />;
}
