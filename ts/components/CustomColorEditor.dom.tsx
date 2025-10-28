// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState } from 'react';
import { Button, ButtonVariant } from './Button.dom.js';
import { GradientDial, KnobType } from './GradientDial.dom.js';
import { SampleMessageBubbles } from './SampleMessageBubbles.dom.js';
import { Slider } from './Slider.dom.js';
import { Tabs } from './Tabs.dom.js';
import type { CustomColorType } from '../types/Colors.std.js';
import type { LocalizerType } from '../types/Util.std.js';
import { getHSL } from '../util/getHSL.std.js';
import { getCustomColorStyle } from '../util/getCustomColorStyle.dom.js';

export type PropsType = {
  customColor?: CustomColorType;
  i18n: LocalizerType;
  onClose: () => unknown;
  onSave: (color: CustomColorType) => unknown;
};

enum TabViews {
  Solid = 'Solid',
  Gradient = 'Gradient',
}

function getPercentage(value: number, max: number): number {
  return (100 * value) / max;
}

function getValue(percentage: number, max: number): number {
  return Math.round((max / 100) * percentage);
}

const MAX_HUE = 360;
const ULTRAMARINE_ISH_VALUES = {
  hue: 220,
  saturation: 84,
};
const ULTRAMARINE_ISH: CustomColorType = {
  start: ULTRAMARINE_ISH_VALUES,
  deg: 180,
};

export function CustomColorEditor({
  customColor = ULTRAMARINE_ISH,
  i18n,
  onClose,
  onSave,
}: PropsType): JSX.Element {
  const [color, setColor] = useState<CustomColorType>(customColor);
  const [selectedColorKnob, setSelectedColorKnob] = useState<KnobType>(
    KnobType.start
  );

  const { hue, saturation } =
    color[selectedColorKnob] || ULTRAMARINE_ISH_VALUES;

  return (
    <Tabs
      initialSelectedTab={color.end ? TabViews.Gradient : TabViews.Solid}
      moduleClassName="CustomColorEditor__tabs"
      onTabChange={selectedTab => {
        if (selectedTab === TabViews.Gradient && !color.end) {
          setColor({
            ...color,
            end: ULTRAMARINE_ISH_VALUES,
          });
        }

        if (selectedTab === TabViews.Solid && color.end) {
          setColor({
            ...color,
            end: undefined,
          });
        }
      }}
      tabs={[
        {
          id: TabViews.Solid,
          label: i18n('icu:CustomColorEditor__solid'),
        },
        {
          id: TabViews.Gradient,
          label: i18n('icu:CustomColorEditor__gradient'),
        },
      ]}
    >
      {({ selectedTab }) => (
        <>
          <div className="CustomColorEditor__messages">
            <SampleMessageBubbles
              backgroundStyle={getCustomColorStyle(color)}
              color="custom"
              i18n={i18n}
              includeAnotherBubble
            />
            {selectedTab === TabViews.Gradient && (
              <div data-supertab>
                <GradientDial
                  deg={color.deg}
                  i18n={i18n}
                  knob1Style={{ backgroundColor: getHSL(color.start) }}
                  knob2Style={{
                    backgroundColor: getHSL(
                      color.end || ULTRAMARINE_ISH_VALUES
                    ),
                  }}
                  onChange={deg => {
                    setColor({
                      ...color,
                      deg,
                    });
                  }}
                  onClick={knob => setSelectedColorKnob(knob)}
                  selectedKnob={selectedColorKnob}
                />
              </div>
            )}
          </div>
          <div data-supertab>
            <div className="CustomColorEditor__slider-container">
              {i18n('icu:CustomColorEditor__hue')}
              <Slider
                handleStyle={{
                  backgroundColor: getHSL({
                    hue,
                    saturation: 100,
                  }),
                }}
                label={i18n('icu:CustomColorEditor__hue')}
                moduleClassName="CustomColorEditor__hue-slider"
                onChange={(percentage: number) => {
                  setColor({
                    ...color,
                    [selectedColorKnob]: {
                      ...ULTRAMARINE_ISH_VALUES,
                      ...color[selectedColorKnob],
                      hue: getValue(percentage, MAX_HUE),
                    },
                  });
                }}
                value={getPercentage(hue, MAX_HUE)}
              />
            </div>
            <div className="CustomColorEditor__slider-container">
              {i18n('icu:CustomColorEditor__saturation')}
              <Slider
                containerStyle={getCustomColorStyle({
                  deg: 180,
                  start: { hue, saturation: 0 },
                  end: { hue, saturation: 100 },
                })}
                handleStyle={{
                  backgroundColor: getHSL(
                    color[selectedColorKnob] || ULTRAMARINE_ISH_VALUES
                  ),
                }}
                label={i18n('icu:CustomColorEditor__saturation')}
                moduleClassName="CustomColorEditor__saturation-slider"
                onChange={(value: number) => {
                  setColor({
                    ...color,
                    [selectedColorKnob]: {
                      ...ULTRAMARINE_ISH_VALUES,
                      ...color[selectedColorKnob],
                      saturation: value,
                    },
                  });
                }}
                value={saturation}
              />
            </div>
          </div>
          <div className="CustomColorEditor__footer" data-supertab>
            <Button variant={ButtonVariant.Secondary} onClick={onClose}>
              {i18n('icu:cancel')}
            </Button>
            <Button
              onClick={() => {
                onSave(color);
                onClose();
              }}
            >
              {i18n('icu:save')}
            </Button>
          </div>
        </>
      )}
    </Tabs>
  );
}
