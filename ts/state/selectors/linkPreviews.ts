// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createSelector } from 'reselect';

import type { LinkPreviewSourceType } from '../../types/LinkPreview.std.js';
import type { StateType } from '../reducer.preload.js';

export const getLinkPreview = createSelector(
  ({ linkPreviews }: StateType) => linkPreviews,
  ({ linkPreview, source }) => {
    return (fromSource: LinkPreviewSourceType) => {
      if (!linkPreview) {
        return;
      }

      if (source !== fromSource) {
        return;
      }

      return linkPreview;
    };
  }
);
