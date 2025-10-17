// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { Meta } from '@storybook/react';
import React from 'react';
import { ExperimentalAxoBadge } from './AxoBadge.dom.js';
import { tw } from './tw.dom.js';

export default {
  title: 'Axo/AriaBadge (Experimental)',
} satisfies Meta;

export function All(): JSX.Element {
  const values: ReadonlyArray<ExperimentalAxoBadge.BadgeValue> = [
    -1,
    0,
    1,
    10,
    123,
    1234,
    12345,
    'mention',
    'unread',
  ];

  return (
    <table className={tw('border-separate border-spacing-2 text-center')}>
      <thead>
        <th>size</th>
        {values.map(value => {
          return <th key={value}>{value}</th>;
        })}
      </thead>
      <tbody>
        {ExperimentalAxoBadge._getAllBadgeSizes().map(size => {
          return (
            <tr key={size}>
              <th>{size}</th>
              {values.map(value => {
                return (
                  <td key={value} className={tw('')}>
                    <ExperimentalAxoBadge.Root
                      size={size}
                      value={value}
                      max={99}
                      maxDisplay="99+"
                      aria-label={null}
                    />
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
