// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { FC } from 'react';
import { memo, useCallback, useMemo } from 'react';
import {
  ColorSlider,
  SliderTrack,
  ColorThumb,
  type Color,
} from 'react-aria-components';
import { tw } from './tw.dom.tsx';
import { useAxoIntl } from './_internal/AxoIntl.dom.tsx';
import { unreachable } from './_internal/assert.std.tsx';
import { AxoColor } from './AxoColor.std.ts';

export namespace AxoColorSlider {
  /**
   * <AxoColorSlider.Root>
   * --------------------------------------------------------------------------
   */

  export type Channel = 'hue' | 'saturation' | 'lightness';

  export type RootProps = Readonly<{
    channel: Channel;
    color: AxoColor;
    onColorChange: (color: AxoColor) => void;
    trackBackground?: string | null;
    thumbColor?: AxoColor | null;
  }>;

  export const Root: FC<RootProps> = memo(props => {
    const { channel, color, onColorChange, trackBackground, thumbColor } =
      props;
    const intl = useAxoIntl();

    const label = useMemo(() => {
      if (channel === 'hue') {
        return intl.get('AxoColorSlider.Hue');
      }
      if (channel === 'saturation') {
        return intl.get('AxoColorSlider.Saturation');
      }
      if (channel === 'lightness') {
        return intl.get('AxoColorSlider.Lightness');
      }
      unreachable(channel);
    }, [channel, intl]);

    const value = useMemo(() => {
      const raw = AxoColor.__internals.getter(color);
      if (raw.getColorSpace() === 'hsl') {
        return raw;
      }
      return raw.toFormat('hsl');
    }, [color]);

    const thumbStyle = useMemo(() => {
      if (thumbColor == null) {
        return undefined;
      }
      return { backgroundColor: thumbColor.css() };
    }, [thumbColor]);

    const handleChange = useCallback(
      (updatedColor: Color) => {
        onColorChange(AxoColor.__internals.create(updatedColor));
      },
      [onColorChange]
    );

    return (
      <ColorSlider
        channel={channel}
        value={value}
        onChange={handleChange}
        className={tw('my-2 h-2.5')}
        aria-label={label}
      >
        <SliderTrack className={tw('h-full rounded-full')}>
          {trackBackground != null && (
            <div
              aria-hidden
              className={tw('absolute inset-0 rounded-full rtl:-scale-x-100')}
              style={{ background: trackBackground }}
            />
          )}
          <ColorThumb
            className={tw(
              'top-1/2 size-5 rounded-full',
              'border-2 border-(--axo-color-fill-white) shadow-elevation-0',
              'data-focus-visible:axo-focus-ring'
            )}
            style={thumbStyle}
          />
        </SliderTrack>
      </ColorSlider>
    );
  });

  Root.displayName = 'AxoColorSlider.Root';
}
