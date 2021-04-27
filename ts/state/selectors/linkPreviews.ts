// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createSelector } from 'reselect';

import { StateType } from '../reducer';

export const getLinkPreview = createSelector(
  ({ linkPreviews }: StateType) => linkPreviews.linkPreview,
  linkPreview => {
    if (linkPreview) {
      return {
        ...linkPreview,
        domain: window.Signal.LinkPreviews.getDomain(linkPreview.url),
        isLoaded: true,
      };
    }

    return undefined;
  }
);
