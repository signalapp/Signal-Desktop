// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { Meta } from '@storybook/react';
import { useState, type ReactNode } from 'react';
import { AxoColorSlider } from './AxoColorSlider.dom.tsx';
import { AxoColor } from './AxoColor.std.ts';

export default {
  title: 'Axo/AxoColorSlider',
} satisfies Meta;

export function Basic(): ReactNode {
  const [color, setColor] = useState(() => {
    return AxoColor.parse('#f00');
  });
  return (
    <>
      <AxoColorSlider.Root
        color={color}
        channel="hue"
        onColorChange={setColor}
      />
      <AxoColorSlider.Root
        color={color}
        channel="saturation"
        onColorChange={setColor}
      />
      <AxoColorSlider.Root
        color={color}
        channel="lightness"
        onColorChange={setColor}
      />
    </>
  );
}
