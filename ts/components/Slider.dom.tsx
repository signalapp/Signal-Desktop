// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { CSSProperties, KeyboardEvent } from 'react';
import React, { useRef } from 'react';
import { getClassNamesFor } from '../util/getClassNamesFor.std.js';
import { arrow } from '../util/keyboard.dom.js';

export type PropsType = {
  containerStyle?: CSSProperties;
  label: string;
  handleStyle?: CSSProperties;
  moduleClassName?: string;
  onChange: (value: number) => unknown;
  value: number;
};

export function Slider({
  containerStyle = {},
  label,
  handleStyle = {},
  moduleClassName,
  onChange,
  value,
}: PropsType): JSX.Element {
  const diff = useRef<number>(0);
  const handleRef = useRef<HTMLDivElement | null>(null);
  const sliderRef = useRef<HTMLDivElement | null>(null);

  const getClassName = getClassNamesFor('Slider', moduleClassName);

  const handleValueChange = (ev: MouseEvent | React.MouseEvent) => {
    if (!sliderRef || !sliderRef.current) {
      return;
    }

    let x =
      ev.clientX -
      diff.current -
      sliderRef.current.getBoundingClientRect().left;

    const max = sliderRef.current.offsetWidth;

    x = Math.min(max, Math.max(0, x));

    const nextValue = (100 * x) / max;

    onChange(nextValue);

    ev.preventDefault();
    ev.stopPropagation();
  };

  const handleMouseUp = () => {
    document.removeEventListener('mouseup', handleMouseUp);
    document.removeEventListener('mousemove', handleValueChange);
  };

  // We want to use React.MouseEvent here because above we
  // use the regular MouseEvent
  const handleMouseDown = (ev: React.MouseEvent) => {
    if (!handleRef || !handleRef.current) {
      return;
    }

    diff.current = ev.clientX - handleRef.current.getBoundingClientRect().left;

    document.addEventListener('mousemove', handleValueChange);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleKeyDown = (ev: KeyboardEvent) => {
    let preventDefault = false;

    if (ev.key === arrow('end')) {
      const nextValue = value + 1;
      onChange(Math.min(nextValue, 100));

      preventDefault = true;
    }

    if (ev.key === arrow('start')) {
      const nextValue = value - 1;
      onChange(Math.max(0, nextValue));

      preventDefault = true;
    }

    if (ev.key === 'Home') {
      onChange(0);
      preventDefault = true;
    }

    if (ev.key === 'End') {
      onChange(100);
      preventDefault = true;
    }

    if (preventDefault) {
      ev.preventDefault();
      ev.stopPropagation();
    }
  };

  return (
    <div
      aria-label={label}
      className={getClassName('')}
      onClick={handleValueChange}
      onKeyDown={handleKeyDown}
      ref={sliderRef}
      role="button"
      style={containerStyle}
      tabIndex={0}
    >
      <div
        aria-label={label}
        aria-valuenow={value}
        className={getClassName('__handle')}
        onMouseDown={handleMouseDown}
        ref={handleRef}
        role="slider"
        style={{ ...handleStyle, left: `${value}%` }}
        tabIndex={-1}
      />
    </div>
  );
}
