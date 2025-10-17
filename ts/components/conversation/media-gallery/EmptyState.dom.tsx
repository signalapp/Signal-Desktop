// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

export type Props = {
  label: string;
};

export function EmptyState({ label }: Props): JSX.Element {
  return <div className="module-empty-state">{label}</div>;
}
