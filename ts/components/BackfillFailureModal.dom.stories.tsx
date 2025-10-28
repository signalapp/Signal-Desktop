// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { action } from '@storybook/addon-actions';
import type { PropsType } from './BackfillFailureModal.dom.js';
import {
  BackfillFailureModal,
  BackfillFailureKind,
} from './BackfillFailureModal.dom.js';
import type { ComponentMeta } from '../storybook/types.std.js';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/BackfillFailureModal',
  component: BackfillFailureModal,
  args: {
    i18n,
    onClose: action('onClose'),
    kind: BackfillFailureKind.Timeout,
  },
} satisfies ComponentMeta<PropsType>;

export function Timeout(args: PropsType): JSX.Element {
  return <BackfillFailureModal {...args} />;
}

export function NotFound(args: PropsType): JSX.Element {
  return <BackfillFailureModal {...args} kind={BackfillFailureKind.NotFound} />;
}
