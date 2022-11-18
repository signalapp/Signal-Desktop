// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

type PropsType = Record<string, never>;

export function SearchResultsLoadingFakeRow(_: PropsType): JSX.Element {
  return (
    <div className="module-SearchResultsLoadingFakeRow">
      <div className="module-SearchResultsLoadingFakeRow__avatar" />
      <div className="module-SearchResultsLoadingFakeRow__content">
        <div className="module-SearchResultsLoadingFakeRow__content__line" />
        <div className="module-SearchResultsLoadingFakeRow__content__line" />
        <div className="module-SearchResultsLoadingFakeRow__content__line" />
      </div>
    </div>
  );
}
