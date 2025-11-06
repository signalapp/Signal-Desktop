// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// Stub: Donations feature removed in Phase 1 cleanup

import React from 'react';

export type Props = {
  children: React.ReactNode;
};

export function DonationsErrorBoundary({ children }: Props): JSX.Element {
  // Stub: No donation error handling needed
  return <>{children}</>;
}
