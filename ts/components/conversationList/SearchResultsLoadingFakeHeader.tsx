// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { FunctionComponent } from 'react';
import React from 'react';

type PropsType = Record<string, never>;

export const SearchResultsLoadingFakeHeader: FunctionComponent<
  PropsType
> = () => <div className="module-SearchResultsLoadingFakeHeader" />;
