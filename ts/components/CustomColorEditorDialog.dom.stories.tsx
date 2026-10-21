// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode } from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import { CustomColorEditorDialog } from './CustomColorEditorDialog.dom.tsx';
import { AxoColor } from '../axo/AxoColor.std.ts';
import { Uint32 } from '@signalapp/types';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/CustomColorEditorDialog',
} satisfies Meta;

export function NewColor(): ReactNode {
  return (
    <CustomColorEditorDialog
      i18n={i18n}
      initialColor={null}
      onClose={action('onClose')}
      onSave={action('onSave')}
    />
  );
}

export function EditSolidColor(): ReactNode {
  return (
    <CustomColorEditorDialog
      i18n={i18n}
      initialColor={{
        solid: AxoColor.parse('hsl(340, 70%, 43.33%)').argbInt(),
      }}
      onClose={action('onClose')}
      onSave={action('onSave')}
    />
  );
}

export function EditGradientColor(): ReactNode {
  return (
    <CustomColorEditorDialog
      i18n={i18n}
      initialColor={{
        gradient: {
          start: AxoColor.parse('hsl(32, 90%, 37%)').argbInt(),
          end: AxoColor.parse('hsl(280, 60%, 43.33%)').argbInt(),
          angle: Uint32.fromNumber(135),
        },
      }}
      onClose={action('onClose')}
      onSave={action('onSave')}
    />
  );
}
