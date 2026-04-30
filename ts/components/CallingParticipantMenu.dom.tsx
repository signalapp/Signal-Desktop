// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState, type ReactNode } from 'react';
import type { LocalizerType } from '../types/I18N.std.ts';
import { AxoMenuBuilder } from '../axo/AxoMenuBuilder.dom.tsx';
import { AxoTheme } from '../axo/AxoTheme.dom.tsx';
import { ConfirmationDialog } from './ConfirmationDialog.dom.tsx';
import { strictAssert } from '../util/assert.std.ts';

export type CallingParticipantMenuProps = Readonly<{
  align?: AxoMenuBuilder.Align;
  side?: AxoMenuBuilder.Side;
  i18n: LocalizerType;
  renderer: AxoMenuBuilder.Renderer;
  isMuteAudioDisabled: boolean;
  participantTitle: string | undefined;
  onBlockFromCall: (() => void) | null;
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
  onBlockFromCall,
  onMuteAudio,
  onUnmuteAudio,
  onViewProfile,
  onGoToChat,
  onRemoveFromCall,
  participantTitle,
  children,
}: CallingParticipantMenuProps): React.JSX.Element {
  const [removeFromCallModalVisible, setRemoveFromCallModalVisible] =
    useState(false);

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
          {onBlockFromCall && onRemoveFromCall && (
            <AxoMenuBuilder.Item
              symbol="minus-circle"
              onSelect={() => setRemoveFromCallModalVisible(true)}
            >
              {i18n('icu:CallingParticipantMenu__RemoveFromCall')}
            </AxoMenuBuilder.Item>
          )}
        </AxoMenuBuilder.Content>
      </AxoMenuBuilder.Root>
      {removeFromCallModalVisible && (
        <ConfirmationDialog
          dialogName="CallingAdhocCallInfo.removeClientDialog"
          moduleClassName="CallingAdhocCallInfo__RemoveClientDialog"
          actions={[
            {
              action: () => {
                strictAssert(
                  onBlockFromCall,
                  'onBlockFromCall prop is required'
                );
                onBlockFromCall();
              },
              style: 'negative',
              text: i18n(
                'icu:CallingAdhocCallInfo__RemoveClientDialogButton--block'
              ),
            },
            {
              action: () => {
                strictAssert(
                  onRemoveFromCall,
                  'onRemoveFromCall prop is required'
                );
                onRemoveFromCall();
              },
              style: 'negative',
              text: i18n(
                'icu:CallingAdhocCallInfo__RemoveClientDialogButton--remove'
              ),
            },
          ]}
          cancelText={i18n('icu:cancel')}
          i18n={i18n}
          onClose={() => setRemoveFromCallModalVisible(false)}
        >
          {i18n('icu:CallingAdhocCallInfo__RemoveClientDialogBody', {
            name: participantTitle ?? '',
          })}
        </ConfirmationDialog>
      )}
    </AxoTheme.Override>
  );
}
