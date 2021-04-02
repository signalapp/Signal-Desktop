// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { CSSProperties, FunctionComponent } from 'react';

type PropsType = {
  style: CSSProperties;
};

export const SearchResultsLoadingFakeRow: FunctionComponent<PropsType> = ({
  style,
}) => (
  <div className="module-SearchResultsLoadingFakeRow" style={style}>
    <div className="module-SearchResultsLoadingFakeRow__avatar" />
    <div className="module-SearchResultsLoadingFakeRow__content">
      <div className="module-SearchResultsLoadingFakeRow__content__header" />
      <div className="module-SearchResultsLoadingFakeRow__content__message" />
    </div>
  </div>
);
