// Copyright 2018-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

type Props = {
  label: string;
};

export const EmptyState = ({ label }: Props): JSX.Element => (
  <div className="module-empty-state">{label}</div>
);
