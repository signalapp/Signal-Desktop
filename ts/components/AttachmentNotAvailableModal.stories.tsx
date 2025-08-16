// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { action } from '@storybook/addon-actions';
import type { PropsType } from './AttachmentNotAvailableModal';
import {
  AttachmentNotAvailableModal,
  AttachmentNotAvailableModalType,
} from './AttachmentNotAvailableModal';
import type { ComponentMeta } from '../storybook/types';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/AttachmentNotAvailableModal',
  component: AttachmentNotAvailableModal,
  args: {
    modalType: AttachmentNotAvailableModalType.VisualMedia,
    i18n,
    onClose: action('onClose'),
  },
} satisfies ComponentMeta<PropsType>;

export function File(args: PropsType): JSX.Element {
  return (
    <AttachmentNotAvailableModal
      {...args}
      modalType={AttachmentNotAvailableModalType.File}
    />
  );
}

export function LongText(args: PropsType): JSX.Element {
  return (
    <AttachmentNotAvailableModal
      {...args}
      modalType={AttachmentNotAvailableModalType.LongText}
    />
  );
}

export function Sticker(args: PropsType): JSX.Element {
  return (
    <AttachmentNotAvailableModal
      {...args}
      modalType={AttachmentNotAvailableModalType.Sticker}
    />
  );
}

export function VisualMedia(args: PropsType): JSX.Element {
  return (
    <AttachmentNotAvailableModal
      {...args}
      modalType={AttachmentNotAvailableModalType.VisualMedia}
    />
  );
}

export function VoiceMessage(args: PropsType): JSX.Element {
  return (
    <AttachmentNotAvailableModal
      {...args}
      modalType={AttachmentNotAvailableModalType.VoiceMessage}
    />
  );
}
