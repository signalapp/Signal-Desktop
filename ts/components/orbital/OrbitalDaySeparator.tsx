// Copyright 2025 Orbital
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

export type OrbitalDaySeparatorProps = {
  label: string;
};

/**
 * OrbitalDaySeparator - ASCII art separator for grouping threads by day
 *
 * Features:
 * - Retro BBS/forum style ASCII art
 * - Courier New monospace font
 * - Centered text with decorative separators
 * - Subtle tertiary text color
 */
export function OrbitalDaySeparator({
  label,
}: OrbitalDaySeparatorProps): JSX.Element {
  return (
    <div className="OrbitalDaySeparator" role="separator" aria-label={label}>
      <div className="OrbitalDaySeparator__text" aria-hidden="true">
        ─── {label} ───
      </div>
    </div>
  );
}

/**
 * Alternative ASCII separators for different contexts
 */

export function OrbitalSectionSeparator(): JSX.Element {
  return (
    <div className="OrbitalASCII OrbitalASCII--separator" aria-hidden="true">
      ·  ·  ·  ✦  ·  ·  ·
    </div>
  );
}

export function OrbitalDotSeparator(): JSX.Element {
  return (
    <div className="OrbitalASCII OrbitalASCII--separator" aria-hidden="true">
      • • • • • • • • • • • • • • • • •
    </div>
  );
}

export function OrbitalLineSeparator(): JSX.Element {
  return (
    <div className="OrbitalASCII OrbitalASCII--separator" aria-hidden="true">
      ─────────────────────────────────
    </div>
  );
}
