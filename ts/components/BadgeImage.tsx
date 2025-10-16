// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import type { BadgeType } from '../badges/types.std.js';
import { Spinner } from './Spinner.dom.js';
import { getBadgeImageFileLocalPath } from '../badges/getBadgeImageFileLocalPath.std.js';
import { BadgeImageTheme } from '../badges/BadgeImageTheme.std.js';

export function BadgeImage({
  badge,
  size,
}: Readonly<{
  badge: BadgeType;
  size: number;
}>): JSX.Element {
  const { name } = badge;

  const imagePath = getBadgeImageFileLocalPath(
    badge,
    size,
    BadgeImageTheme.Transparent
  );

  if (!imagePath) {
    return (
      <Spinner
        ariaLabel={name}
        moduleClassName="BadgeImage BadgeImage__loading"
        size={`${size}px`}
        svgSize="normal"
      />
    );
  }

  return (
    <img
      alt={name}
      className="BadgeImage"
      src={imagePath}
      style={{
        width: size,
        height: size,
      }}
    />
  );
}
