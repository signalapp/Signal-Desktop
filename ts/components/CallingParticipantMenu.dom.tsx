// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { type ReactNode } from 'react';
import type { LocalizerType } from '../types/I18N.std.ts';
import { AxoMenuBuilder } from '../axo/AxoMenuBuilder.dom.tsx';
import { AxoTheme } from '../axo/AxoTheme.dom.tsx';

export type CallingParticipantMenuProps = Readonly<{
  align: AxoMenuBuilder.Align;
  side: AxoMenuBuilder.Side;
  i18n: LocalizerType;
  renderer: AxoMenuBuilder.Renderer;
  isMuteAudioDisabled: boolean;
  onMuteAudio: (() => void) | null;
  onUnmuteAudio: (() => void) | null;
  onViewProfile: (() => void) | null;
  onGoToChat: (() => void) | null;
  onRemoveFromCall: (() => void) | null;
  children: ReactNode;
}>;

export function CallingParticipantMenu({
  align,
  side,
  i18n,
  renderer,
  isMuteAudioDisabled,
  onMuteAudio,
  onUnmuteAudio,
  onViewProfile,
  onGoToChat,
  onRemoveFromCall,
  children,
}: CallingParticipantMenuProps): React.JSX.Element {
  return (
    <AxoTheme.Override theme="force-dark">
      <AxoMenuBuilder.Root
        // Workaround for bug where multiple menus stay open when clicking Trigger components
        // from other dropdown menus
        // https://github.com/radix-ui/primitives/issues/1836#issuecomment-1547607143
        modal={false}
        renderer={renderer}
      >
        <AxoMenuBuilder.Trigger>{children}</AxoMenuBuilder.Trigger>
        <AxoMenuBuilder.Content align={align} side={side}>
          {onMuteAudio && (
            <AxoMenuBuilder.Item
              symbol="mic-slash"
              onSelect={onMuteAudio}
              disabled={isMuteAudioDisabled}
            >
              {i18n('icu:CallingParticipantMenu__MuteAudio')}
            </AxoMenuBuilder.Item>
          )}
          {onUnmuteAudio && (
            <AxoMenuBuilder.Item symbol="mic-slash" onSelect={onUnmuteAudio}>
              {i18n('icu:CallingParticipantMenu__UnmuteAudio')}
            </AxoMenuBuilder.Item>
          )}
          {onViewProfile && (
            <AxoMenuBuilder.Item
              symbol="person-circle"
              onSelect={onViewProfile}
            >
              {i18n('icu:CallingParticipantMenu__ViewProfile')}
            </AxoMenuBuilder.Item>
          )}
          {onGoToChat && (
            <AxoMenuBuilder.Item
              symbol="arrow-square-up[end]"
              onSelect={onGoToChat}
            >
              {i18n('icu:CallingParticipantMenu__GoToChat')}
            </AxoMenuBuilder.Item>
          )}
          {onRemoveFromCall && (
            <AxoMenuBuilder.Item
              symbol="minus-circle"
              onSelect={onRemoveFromCall}
            >
              {i18n('icu:CallingParticipantMenu__RemoveFromCall')}
            </AxoMenuBuilder.Item>
          )}
        </AxoMenuBuilder.Content>
      </AxoMenuBuilder.Root>
    </AxoTheme.Override>
  );
}
