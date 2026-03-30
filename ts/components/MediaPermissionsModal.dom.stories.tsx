// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React from 'react';
import { action } from '@storybook/addon-actions';
import { type ComponentMeta } from '../storybook/types.std.ts';
import type { PropsType } from './MediaPermissionsModal.dom.tsx';
import { MediaPermissionsModal } from './MediaPermissionsModal.dom.tsx';

const { i18n } = window.SignalContext;

type TemplateProps = Omit<PropsType, 'i18n' | 'children'>;

function Template(props: TemplateProps) {
  return <MediaPermissionsModal i18n={i18n} {...props} />;
}

export default {
  title: 'Components/MediaPermissionsModal',
  component: Template,
  args: {
    mediaType: 'camera',
    requestor: 'call',
    openSystemMediaPermissions: action('onOpenSystemMediaPermissions'),
    onClose: action('onClose'),
  },
} satisfies ComponentMeta<TemplateProps>;

export function Camera(props: TemplateProps): React.JSX.Element {
  return <Template {...props} mediaType="camera" />;
}

export function Microphone(props: TemplateProps): React.JSX.Element {
  return <Template {...props} mediaType="microphone" />;
}

export function VoiceNote(props: TemplateProps): React.JSX.Element {
  return <Template {...props} requestor="voiceNote" mediaType="microphone" />;
}
