// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useState } from 'react';

import type { LinkPreviewDraftType } from '../types/LinkPreview.std.ts';
import type { LinkPreviewForUIType } from '../types/message/LinkPreviews.std.ts';

export function useHydrateDraftLinkPreview(
  draft: LinkPreviewDraftType | undefined
): LinkPreviewForUIType | undefined {
  const [url, setUrl] = useState<string | undefined>();

  useEffect(() => {
    let objectUrl: string | undefined;

    if (draft?.image && !draft.image.pending) {
      const blob = new Blob([draft.image.data], {
        type: draft.image.contentType,
      });
      objectUrl = URL.createObjectURL(blob);
    }

    // oxlint-disable-next-line react/set-state-in-effect
    setUrl(objectUrl);

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [draft]);

  if (!draft) {
    return undefined;
  }

  const { image, ...rest } = draft;
  if (image == null || image.pending || url == null) {
    return rest;
  }

  const {
    // oxlint-disable-next-line typescript/no-unused-vars
    pending: _pending,
    // oxlint-disable-next-line typescript/no-unused-vars
    data: _data,
    // oxlint-disable-next-line typescript/no-unused-vars
    screenshotData: _screenshotData,
    ...restOfImage
  } = image;

  return {
    ...rest,
    image: {
      ...restOfImage,
      isPermanentlyUndownloadable: false,
      url,
    },
  };
}
