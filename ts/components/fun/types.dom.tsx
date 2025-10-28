// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export type FunImageAriaProps =
  | Readonly<{ role: 'img'; 'aria-label': string }>
  | Readonly<{ role: 'presentation'; 'aria-label'?: never }>;
