// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { DropzoneOptions } from 'react-dropzone';
import { useDropzone } from 'react-dropzone';

export const useStickerDropzone = (
  onDrop: DropzoneOptions['onDrop']
): ReturnType<typeof useDropzone> =>
  useDropzone({
    onDrop,
    accept: [
      'image/png',
      'image/webp',
      // Some OSes recognize .apng files with the MIME type but others don't, so we supply
      //   the extension too.
      'image/apng',
      '.apng',
    ],
  });
