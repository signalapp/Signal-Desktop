// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { GradientDial, KnobType } from './GradientDial.dom.tsx';
import { SampleMessageBubbles } from './SampleMessageBubbles.dom.tsx';
import type { LocalizerType } from '../types/Util.std.ts';
import { tw } from '../axo/tw.dom.tsx';
import { AxoColorSlider } from '../axo/AxoColorSlider.dom.tsx';
import { AxoColor } from '../axo/AxoColor.std.ts';
import { missingCaseError } from '../util/missingCaseError.std.ts';
import { AxoTokens } from '../axo/AxoTokens.std.ts';
import type { ChatStyle } from '../types/ChatStyle.std.ts';
import { calculateLightness } from '../util/getHSL.std.ts';
import { Uint32 } from '@signalapp/types';

const ULTRAMARINE = AxoTokens.ChatBubble.Gradients.ultramarine;

const ULTRAMARINE_START = AxoColor.parse(ULTRAMARINE.start).argbInt();
const ULTRAMARINE_END = AxoColor.parse(ULTRAMARINE.end).argbInt();
const ULTRAMARINE_ANGLE = Uint32.fromNumber(270 - ULTRAMARINE.deg);

export const INITIAL_CUSTOM_CHAT_COLOR = {
  gradient: {
    start: ULTRAMARINE_START,
    end: ULTRAMARINE_END,
    angle: ULTRAMARINE_ANGLE,
  },
} as const satisfies ChatStyle.CustomChatColor['color'];

const HUE_TRACK_STOPS = Array.from({ length: 13 }, (_, index) => {
  const hue = index * 30;
  return `hsl(${hue}, 100%, ${calculateLightness(hue)}%)`;
});

const HUE_TRACK_BACKGROUND = `linear-gradient(to right, ${HUE_TRACK_STOPS.join(', ')})`;

function withCalculatedLightness(color: AxoColor): AxoColor {
  const { hue, saturation } = color.hsl();
  const lightness = calculateLightness(hue);
  return AxoColor.fromHSL({ hue, saturation, lightness });
}

export type CustomColorEditorMode = 'solid' | 'gradient';

export type CustomColorEditorState = Readonly<{
  start: AxoColor;
  end: AxoColor;
  angle: Uint32;
}>;

export function createCustomColorEditorState(
  initialColor: ChatStyle.CustomChatColor['color'] | null
): CustomColorEditorState {
  const startValue =
    initialColor?.solid ?? initialColor?.gradient.start ?? ULTRAMARINE_START;
  const endValue = initialColor?.gradient?.end ?? ULTRAMARINE_END;
  const angle = initialColor?.gradient?.angle ?? ULTRAMARINE_ANGLE;

  const start = AxoColor.fromARGBInt(startValue);
  const end = AxoColor.fromARGBInt(endValue);

  return { start, end, angle };
}

export function serializeCustomColorEditorState(
  mode: CustomColorEditorMode,
  editorState: CustomColorEditorState
): ChatStyle.CustomChatColor['color'] {
  const start = editorState.start.argbInt();
  const end = editorState.end.argbInt();
  const { angle } = editorState;

  if (mode === 'solid') {
    return { solid: start };
  }
  if (mode === 'gradient') {
    return { gradient: { start, end, angle } };
  }
  throw missingCaseError(mode);
}

export type CustomColorEditorProps = Readonly<{
  i18n: LocalizerType;
  mode: CustomColorEditorMode;
  editorState: CustomColorEditorState;
  onEditorStateChange: (state: CustomColorEditorState) => void;
}>;

export function CustomColorEditor(props: CustomColorEditorProps): ReactNode {
  const { i18n, mode, editorState, onEditorStateChange } = props;
  const [selectedKnob, setSelectedKnob] = useState(KnobType.start);

  const selectedColor = useMemo(() => {
    if (selectedKnob === KnobType.start) {
      return editorState.start;
    }
    if (selectedKnob === KnobType.end) {
      return editorState.end;
    }
    throw missingCaseError(selectedKnob);
  }, [selectedKnob, editorState]);

  const handleAngleChange = useCallback(
    (angle: Uint32) => {
      onEditorStateChange({ ...editorState, angle });
    },
    [onEditorStateChange, editorState]
  );

  const handleColorChange = useCallback(
    (value: AxoColor) => {
      const color = withCalculatedLightness(value);
      if (selectedKnob === KnobType.start) {
        onEditorStateChange({ ...editorState, start: color });
      } else if (selectedKnob === KnobType.end) {
        onEditorStateChange({ ...editorState, end: color });
      } else {
        throw missingCaseError(selectedKnob);
      }
    },
    [onEditorStateChange, editorState, selectedKnob]
  );

  const customColor = useMemo((): ChatStyle.CustomChatColor['color'] => {
    return serializeCustomColorEditorState(mode, editorState);
  }, [mode, editorState]);

  const hueThumbColor = useMemo(() => {
    const { hue } = selectedColor.hsl();
    const lightness = calculateLightness(hue);
    return AxoColor.fromHSL({ hue, saturation: 100, lightness });
  }, [selectedColor]);

  return (
    <>
      <div
        className={tw(
          'mb-2.5',
          'relative rounded-xl py-4',
          'bg-surface-primary',
          'inset-shadow-on-color'
        )}
      >
        {/* `relative` above also makes the gradients in the bubbles span this
            whole preview, like they span the whole chat view in the timeline */}
        <SampleMessageBubbles i18n={i18n} bubbleColor={{ customColor }} />
        {mode === 'gradient' && (
          <GradientDial
            i18n={i18n}
            start={editorState.start}
            end={editorState.end}
            angle={editorState.angle}
            onAngleChange={handleAngleChange}
            onKnobSelect={setSelectedKnob}
            selectedKnob={selectedKnob}
          />
        )}
      </div>
      <div className={tw('mb-1 type-body-large text-primary')}>
        {i18n('icu:CustomColorEditor__hue')}
      </div>
      <AxoColorSlider.Root
        channel="hue"
        color={selectedColor}
        onColorChange={handleColorChange}
        trackBackground={HUE_TRACK_BACKGROUND}
        thumbColor={hueThumbColor}
      />
      <div className={tw('mt-2 mb-1 type-body-large text-primary')}>
        {i18n('icu:CustomColorEditor__saturation')}
      </div>
      <AxoColorSlider.Root
        channel="saturation"
        color={selectedColor}
        onColorChange={handleColorChange}
      />
    </>
  );
}
