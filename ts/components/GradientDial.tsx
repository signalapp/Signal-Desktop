// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { CSSProperties, KeyboardEvent } from 'react';
import React, { useEffect, useRef, useState } from 'react';
import classNames from 'classnames';
import { arrow } from '../util/keyboard.dom.js';
import type { LocalizerType } from '../types/Util.std.js';

export enum KnobType {
  start = 'start',
  end = 'end',
}

export type PropsType = {
  deg?: number;
  i18n: LocalizerType;
  knob1Style: CSSProperties;
  knob2Style: CSSProperties;
  onChange: (deg: number) => unknown;
  onClick: (knob: KnobType) => unknown;
  selectedKnob: KnobType;
};

// Converts from degrees to radians.
function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

// Converts from radians to degrees.
function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

type CSSPosition = { left: number; top: number };

function getKnobCoordinates(
  degrees: number,
  rect: ClientRect
): { start: CSSPosition; end: CSSPosition } {
  const center = {
    x: rect.width / 2,
    y: rect.height / 2,
  };
  const alpha = toDegrees(Math.atan(rect.height / rect.width));
  const beta = (360.0 - alpha * 4) / 4;

  if (degrees < alpha) {
    // Right top
    const a = center.x;
    const b = a * Math.tan(toRadians(degrees));

    return {
      start: {
        left: rect.width,
        top: center.y - b,
      },
      end: {
        left: 0,
        top: center.y + b,
      },
    };
  }

  if (degrees < 90) {
    // Top right
    const phi = 90 - degrees;
    const a = center.y;
    const b = a * Math.tan(toRadians(phi));

    return {
      start: {
        left: center.x + b,
        top: 0,
      },
      end: {
        left: center.x - b,
        top: rect.height,
      },
    };
  }

  if (degrees < 90 + beta) {
    // Top left
    const phi = degrees - 90;
    const a = center.y;
    const b = a * Math.tan(toRadians(phi));

    return {
      start: {
        left: center.x - b,
        top: 0,
      },
      end: {
        left: center.x + b,
        top: rect.height,
      },
    };
  }

  if (degrees < 180) {
    // left top
    const phi = 180 - degrees;
    const a = center.x;
    const b = a * Math.tan(toRadians(phi));

    return {
      start: {
        left: 0,
        top: center.y - b,
      },
      end: {
        left: rect.width,
        top: center.y + b,
      },
    };
  }

  if (degrees < 180 + alpha) {
    // left bottom
    const phi = degrees - 180;
    const a = center.x;
    const b = a * Math.tan(toRadians(phi));

    return {
      start: {
        left: 0,
        top: center.y + b,
      },
      end: {
        left: rect.width,
        top: center.y - b,
      },
    };
  }

  if (degrees < 270) {
    // bottom left
    const phi = 270 - degrees;
    const a = center.y;
    const b = a * Math.tan(toRadians(phi));

    return {
      start: {
        left: center.x - b,
        top: rect.height,
      },
      end: {
        left: center.x + b,
        top: 0,
      },
    };
  }

  if (degrees < 270 + beta) {
    // bottom right
    const phi = degrees - 270;
    const a = center.y;
    const b = a * Math.tan(toRadians(phi));

    return {
      start: {
        left: center.x + b,
        top: rect.height,
      },
      end: {
        left: center.x - b,
        top: 0,
      },
    };
  }

  // right bottom
  const phi = 360 - degrees;
  const a = center.x;
  const b = a * Math.tan(toRadians(phi));

  return {
    start: {
      left: rect.width,
      top: center.y + b,
    },
    end: {
      left: 0,
      top: center.y - b,
    },
  };
}

export function GradientDial({
  deg = 180,
  i18n,
  knob1Style,
  knob2Style,
  onChange,
  onClick,
  selectedKnob,
}: PropsType): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [knobDim, setKnobDim] = useState<{
    start?: CSSPosition;
    end?: CSSPosition;
  }>({});

  const handleMouseMove = (ev: MouseEvent) => {
    if (!containerRef || !containerRef.current) {
      return;
    }

    const rect = containerRef.current.getBoundingClientRect();
    const center = {
      x: rect.width / 2,
      y: rect.height / 2,
    };

    const a = {
      x: ev.clientX - (rect.x + center.x),
      y: ev.clientY - (rect.y + center.y),
    };
    const b = { x: center.x, y: 0 };
    const dot = a.x * b.x + a.y * b.y;
    const det = a.x * b.y - a.y * b.x;

    const offset = selectedKnob === KnobType.end ? 180 : 0;
    const degrees = (toDegrees(Math.atan2(det, dot)) + 360 + offset) % 360;

    onChange(degrees);

    ev.preventDefault();
    ev.stopPropagation();
  };

  const handleMouseUp = () => {
    document.removeEventListener('mouseup', handleMouseUp);
    document.removeEventListener('mousemove', handleMouseMove);
  };

  // We want to use React.MouseEvent here because above we
  // use the regular MouseEvent
  const handleMouseDown = (ev: React.MouseEvent) => {
    ev.preventDefault();
    ev.stopPropagation();

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleKeyDown = (ev: KeyboardEvent) => {
    if (ev.key === 'ArrowDown' || ev.key === arrow('start')) {
      onChange(Math.min(360, Math.max(0, deg + 1)));
    }

    if (ev.key === 'ArrowUp' || ev.key === arrow('end')) {
      onChange(Math.min(360, Math.max(0, deg - 1)));
    }

    if (ev.key === 'Enter' && ev.target instanceof HTMLElement) {
      if (ev.target.ariaLabel === '0') {
        onClick(KnobType.start);
      } else if (ev.target.ariaLabel === '1') {
        onClick(KnobType.end);
      }
    }
  };

  useEffect(() => {
    if (!containerRef || !containerRef.current) {
      return;
    }

    const containerRect = containerRef.current.getBoundingClientRect();
    setKnobDim(getKnobCoordinates(deg, containerRect));
  }, [containerRef, deg]);

  return (
    <div className="GradientDial__container" ref={containerRef}>
      {knobDim.start && (
        <div
          aria-label={i18n('icu:GradientDial__knob-start')}
          className={classNames('GradientDial__knob', {
            'GradientDial__knob--selected': selectedKnob === KnobType.start,
          })}
          onKeyDown={handleKeyDown}
          onMouseDown={ev => {
            if (selectedKnob === KnobType.start) {
              handleMouseDown(ev);
            }
          }}
          onClick={() => {
            onClick(KnobType.start);
          }}
          role="button"
          style={{
            ...knob1Style,
            ...knobDim.start,
          }}
          tabIndex={0}
        />
      )}
      {knobDim.end && (
        <div
          aria-label={i18n('icu:GradientDial__knob-end')}
          className={classNames('GradientDial__knob', {
            'GradientDial__knob--selected': selectedKnob === KnobType.end,
          })}
          onKeyDown={handleKeyDown}
          onMouseDown={ev => {
            if (selectedKnob === KnobType.end) {
              handleMouseDown(ev);
            }
          }}
          onClick={() => {
            onClick(KnobType.end);
          }}
          role="button"
          style={{
            ...knob2Style,
            ...knobDim.end,
          }}
          tabIndex={0}
        />
      )}
      {knobDim.start && knobDim.end && (
        <div className="GradientDial__bar--container">
          <div
            className="GradientDial__bar--node"
            style={{
              transform: `translate(-50%, -50%) rotate(${90 - deg}deg)`,
            }}
          />
        </div>
      )}
    </div>
  );
}
