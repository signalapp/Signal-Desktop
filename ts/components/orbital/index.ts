// Copyright 2025 Orbital
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Orbital Threading Components
 *
 * Early 2000s Internet aesthetic threaded discussion UI
 * with color-coded reply depth system (Blue → Purple → Blue → Purple)
 */

export { OrbitalThreadList } from './OrbitalThreadList';
export type { OrbitalThread, OrbitalThreadListProps } from './OrbitalThreadList';

export { OrbitalThreadItem } from './OrbitalThreadItem';
export type { OrbitalThreadItemProps } from './OrbitalThreadItem';

export { OrbitalThreadDetail } from './OrbitalThreadDetail';
export type { OrbitalMessageType, OrbitalThreadDetailProps } from './OrbitalThreadDetail';

export { OrbitalMessage, getReplyDepthColor, getReplyIndentation } from './OrbitalMessage';
export type { OrbitalMessageProps } from './OrbitalMessage';

export { OrbitalComposer } from './OrbitalComposer';
export type { OrbitalComposerMode, OrbitalComposerProps } from './OrbitalComposer';

export {
  OrbitalDaySeparator,
  OrbitalSectionSeparator,
  OrbitalDotSeparator,
  OrbitalLineSeparator,
} from './OrbitalDaySeparator';
export type { OrbitalDaySeparatorProps } from './OrbitalDaySeparator';

export { OrbitalThreadingDemo } from './OrbitalThreadingDemo';
