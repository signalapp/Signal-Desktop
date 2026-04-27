// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React from 'react';
import type { Meta } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { tw } from '../axo/tw.dom.tsx';
import {
  CallingParticipantMenu,
  type CallingParticipantMenuProps,
} from './CallingParticipantMenu.dom.tsx';
import { AxoButton } from '../axo/AxoButton.dom.tsx';

const { i18n } = window.SignalContext;

export default {
  title: 'CallingParticipantMenu',
  excludeStories: ['renderCallingParticipantMenu'],
} satisfies Meta;

const defaultProps: CallingParticipantMenuProps = {
  align: 'center',
  side: 'bottom',
  i18n,
  renderer: 'AxoContextMenu',
  isMuteAudioDisabled: false,
  onMuteAudio: action('on-mute-audio'),
  onUnmuteAudio: null,
  onViewProfile: action('on-view-profile'),
  onGoToChat: action('on-go-to-chat'),
  onRemoveFromCall: action('on-remove-from-call'),
  children: <div>Menu</div>,
};

export function renderCallingParticipantMenu(
  overrideProps: Partial<CallingParticipantMenuProps>
): React.JSX.Element {
  return <CallingParticipantMenu {...defaultProps} {...overrideProps} />;
}

export function Basic(): React.JSX.Element {
  return (
    <div className={tw('flex h-96 w-full items-center justify-center gap-8')}>
      {renderCallingParticipantMenu({
        renderer: 'AxoDropdownMenu',
        children: (
          <AxoButton.Root variant="secondary" size="md">
            Open Dropdown Menu
          </AxoButton.Root>
        ),
      })}
      {renderCallingParticipantMenu({
        renderer: 'AxoContextMenu',
        children: (
          <div
            className={tw('bg-fill-secondary p-12 text-color-label-primary')}
          >
            Right-Click
          </div>
        ),
      })}
    </div>
  );
}
