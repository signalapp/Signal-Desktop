// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { CSSProperties, FunctionComponent } from 'react';

type PropsType = {
  style: CSSProperties;
};

export const SearchResultsLoadingFakeHeader: FunctionComponent<PropsType> = ({
  style,
}) => <div className="module-SearchResultsLoadingFakeHeader" style={style} />;
