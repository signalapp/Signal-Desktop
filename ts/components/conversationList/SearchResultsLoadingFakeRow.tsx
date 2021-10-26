// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { FunctionComponent } from 'react';
import React from 'react';

type PropsType = Record<string, never>;

export const SearchResultsLoadingFakeRow: FunctionComponent<PropsType> = () => (
  <div className="module-SearchResultsLoadingFakeRow">
    <div className="module-SearchResultsLoadingFakeRow__avatar" />
    <div className="module-SearchResultsLoadingFakeRow__content">
      <div className="module-SearchResultsLoadingFakeRow__content__line" />
      <div className="module-SearchResultsLoadingFakeRow__content__line" />
      <div className="module-SearchResultsLoadingFakeRow__content__line" />
    </div>
  </div>
);
