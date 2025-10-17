// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { getExtensionForDisplay } from '../util/Attachment.std.js';
import { isFileDangerous } from '../util/isFileDangerous.std.js';
import { tw } from '../axo/tw.dom.js';

export type PropsType = Readonly<Parameters<typeof getExtensionForDisplay>[0]>;

export function FileThumbnail(props: PropsType): JSX.Element {
  const extension = getExtensionForDisplay(props) ?? '';
  const isDangerous = isFileDangerous(props.fileName || '');

  return (
    <div
      className={tw(
        'flex items-center justify-center',
        'relative',
        'mx-1.5 h-10 w-7.5',
        'bg-contain bg-center bg-no-repeat',
        'bg-[url(../images/generic-file.svg)]'
      )}
    >
      <span
        className={tw(
          'mx-1 overflow-hidden',
          // eslint-disable-next-line better-tailwindcss/no-restricted-classes
          'text-[rgba(0,0,0,0.85)]',
          'text-ellipsis',
          extension.length > 3 ? 'text-[9px]' : '',
          'type-caption whitespace-nowrap'
        )}
      >
        {extension}
      </span>
      {isDangerous ? (
        <div
          className={tw(
            'absolute -end-1.5 -top-1 size-5',
            'bg-contain bg-center bg-no-repeat',
            'bg-[url(../images/generic-file-dangerous.svg)]'
          )}
        />
      ) : null}
    </div>
  );
}
