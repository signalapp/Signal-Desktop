// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { PointerEvent, ReactNode } from 'react';
import { useCallback, useMemo, useRef } from 'react';
import type { LocalizerType } from '../types/Util.std.ts';
import { tw } from '../axo/tw.dom.tsx';
import { mergeProps, useMove } from 'react-aria';
import { strictAssert } from '../util/assert.std.ts';
import { useSizeObserver } from '../hooks/useSizeObserver.dom.tsx';
import type { AxoColor } from '../axo/AxoColor.std.ts';
import { Uint32 } from '@signalapp/types';

export enum KnobType {
  start = 'start',
  end = 'end',
}

type Point = Readonly<{
  x: number;
  y: number;
}>;

type Size = Readonly<{
  width: number;
  height: number;
}>;

type Line = Readonly<{
  start: Point;
  end: Point;
}>;

function translatePoint(point: Point, offsetX: number, offsetY: number): Point {
  return {
    x: point.x + offsetX,
    y: point.y + offsetY,
  };
}

function sizeToCenter(size: Size): Point {
  return {
    x: size.width / 2,
    y: size.height / 2,
  };
}

// Converts from degrees to radians.
function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

// Converts from radians to degrees.
function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

// Wraps degrees into the range [0, 360)
function normalizeDegrees(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

function getVectorDegrees(vector: Point): number {
  // The y-axis points down on screen so it needs to be flipped
  return toDegrees(Math.atan2(-vector.y, vector.x));
}

// Rotates `degrees` along the shortest path towards `target` by at most `step`
function rotateTowards(degrees: number, target: number, step: number): number {
  const diff = normalizeDegrees(target - degrees);
  if (diff === 0 || diff === 180) {
    // Already there, or pointing in the opposite direction
    return degrees;
  }
  if (diff < 180) {
    return degrees + Math.min(step, diff);
  }
  return degrees - Math.min(step, 360 - diff);
}

function getKnobCoordinates(size: Size, degrees: number): Line {
  const radians = toRadians(degrees);

  // Degrees go counter-clockwise starting from the right
  const directionX = Math.cos(radians);
  const directionY = -Math.sin(radians); // y-axis is flipped

  const center = sizeToCenter(size);

  // Extend the direction from the center until it reaches the nearest edge.
  // (Dividing by 0 gives Infinity, which `Math.min()` ignores)
  const distance = Math.min(
    center.x / Math.abs(directionX),
    center.y / Math.abs(directionY)
  );

  const offsetX = directionX * distance;
  const offsetY = directionY * distance;

  return {
    start: translatePoint(center, offsetX, offsetY),
    end: translatePoint(center, -offsetX, -offsetY),
  };
}

export type GradientDialProps = Readonly<{
  i18n: LocalizerType;
  start: AxoColor;
  end: AxoColor;
  angle: Uint32;
  onAngleChange: (angle: Uint32) => void;
  onKnobSelect: (knob: KnobType) => void;
  selectedKnob: KnobType;
}>;

export function GradientDial(props: GradientDialProps): ReactNode {
  const { i18n, start, end, angle, onAngleChange, onKnobSelect, selectedKnob } =
    props;

  const ref = useRef<HTMLDivElement | null>(null);
  const size = useSizeObserver(ref);

  const coords = useMemo(() => {
    if (size == null || size.hidden) {
      return null;
    }
    const center = sizeToCenter(size);
    const knobs = getKnobCoordinates(size, angle);
    return { center, start: knobs.start, end: knobs.end };
  }, [size, angle]);

  return (
    <div
      // Inset by more than the knob radius so knobs never extend past the
      // edges of the editor
      className={tw('absolute inset-8')}
      ref={ref}
    >
      {coords != null && (
        <>
          <GradientDialKnob
            i18n={i18n}
            knob={KnobType.start}
            angle={angle}
            center={coords.center}
            point={coords.start}
            color={start}
            selected={selectedKnob === KnobType.start}
            onSelect={onKnobSelect}
            onAngleChange={onAngleChange}
          />
          <GradientDialKnob
            i18n={i18n}
            knob={KnobType.end}
            angle={angle}
            center={coords.center}
            point={coords.end}
            color={end}
            selected={selectedKnob === KnobType.end}
            onSelect={onKnobSelect}
            onAngleChange={onAngleChange}
          />
          <div className={tw('relative size-full overflow-clip')}>
            <div
              className={tw(
                // oxlint-disable-next-line better-tailwindcss/no-restricted-classes
                'absolute top-1/2 left-1/2 -translate-1/2',
                'origin-center',
                'h-screen w-1.5',
                'bg-material-quaternary backdrop-blur-thin',
                'shadow-elevation-0'
              )}
              style={{
                rotate: `${90 - angle}deg`,
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}

type GradientDialKnobProps = Readonly<{
  i18n: LocalizerType;
  knob: KnobType;
  angle: number;
  center: Point;
  point: Point;
  color: AxoColor;
  selected: boolean;
  onSelect: (knob: KnobType) => unknown;
  onAngleChange: (angle: Uint32) => void;
}>;

function GradientDialKnob(props: GradientDialKnobProps): ReactNode {
  const {
    i18n,
    knob,
    angle,
    center,
    point,
    selected,
    onSelect,
    onAngleChange,
  } = props;
  const dragPointRef = useRef<Point | null>(null);

  const label =
    knob === KnobType.start
      ? i18n('icu:GradientDial__knob-start')
      : i18n('icu:GradientDial__knob-end');

  const handleSelect = useCallback(() => {
    onSelect(knob);
  }, [onSelect, knob]);

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      // useMove() prevents the default focus behavior, focusing also selects it
      event.currentTarget.focus();
    },
    []
  );

  const { moveProps } = useMove({
    onMoveStart() {
      dragPointRef.current = point;
    },
    onMove(event) {
      const offset = knob === KnobType.end ? 180 : 0;
      const delta: Point = { x: event.deltaX, y: event.deltaY };

      let knobAngle: number;
      if (event.pointerType === 'keyboard') {
        // Rotate by a fixed number of degrees towards the arrow key's direction,
        // rather than moving by pixels which would rotate less near the corners
        const step = event.shiftKey ? 10 : 1;
        const target = getVectorDegrees(delta);
        knobAngle = rotateTowards(angle + offset, target, step);
      } else {
        strictAssert(dragPointRef.current != null, 'Missing dragPointRef');
        const origin = dragPointRef.current;
        const updated = translatePoint(origin, delta.x, delta.y);
        dragPointRef.current = updated;
        const vector = translatePoint(updated, -center.x, -center.y);
        knobAngle = getVectorDegrees(vector);
      }

      // Angles are stored as whole degrees (like in backups)
      onAngleChange(
        Uint32.fromNumber(normalizeDegrees(Math.round(knobAngle - offset)))
      );
    },
    onMoveEnd() {
      dragPointRef.current = null;
    },
  });

  return (
    <button
      {...mergeProps(moveProps, {
        onPointerDown: handlePointerDown,
      })}
      type="button"
      aria-label={label}
      aria-pressed={selected}
      className={tw(
        'absolute legacy-z-index-base size-10 -translate-1/2 rounded-full p-[1.5px]',
        'bg-material-quaternary backdrop-blur-thin',
        'border-3 border-transparent',
        'shadow-elevation-1',
        'not-focus-visible:aria-pressed:border-focused-outer',
        'focus-visible:aria-pressed:border-selected',
        'focus-visible:outline-none'
      )}
      onFocus={handleSelect}
      onClick={handleSelect}
      style={{
        top: point.y,
        left: point.x,
        // Inline to override the global `button { cursor: pointer }` styles
        cursor: selected ? 'move' : undefined,
      }}
    >
      <span
        className={tw('block size-full rounded-full')}
        style={{ backgroundColor: props.color.css() }}
      />
    </button>
  );
}
