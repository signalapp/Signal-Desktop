// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ChangeEventHandler } from 'react';
import React, { useEffect, useRef, useState } from 'react';
import lodash from 'lodash';

import type { LocalizerType } from '../types/Util.std.js';
import { processImageFile } from '../util/processImageFile.dom.js';

const { noop } = lodash;

export type PropsType = {
  className: string;
  i18n: LocalizerType;
  onChange: (avatar: Uint8Array) => unknown;
};

export function AvatarUploadButton({
  className,
  i18n,
  onChange,
}: PropsType): JSX.Element {
  const fileInputRef = useRef<null | HTMLInputElement>(null);

  const [processingFile, setProcessingFile] = useState<File | undefined>();

  useEffect(() => {
    if (!processingFile) {
      return noop;
    }

    let shouldCancel = false;

    void (async () => {
      let newAvatar: Uint8Array;
      try {
        newAvatar = await processImageFile(processingFile);
      } catch (err) {
        // Processing errors should be rare; if they do, we silently fail. In an ideal
        //   world, we may want to show a toast instead.
        return;
      }
      if (shouldCancel) {
        return;
      }
      setProcessingFile(undefined);
      onChange(newAvatar);
    })();

    return () => {
      shouldCancel = true;
    };
  }, [onChange, processingFile]);

  const onInputChange: ChangeEventHandler<HTMLInputElement> = event => {
    const file = event.target.files && event.target.files[0];
    if (file) {
      setProcessingFile(file);
    }
  };

  return (
    <>
      <button
        className={className}
        onClick={() => {
          const fileInput = fileInputRef.current;
          if (fileInput) {
            // Setting the value to empty so that onChange always fires in case
            // you add multiple photos.
            fileInput.value = '';
            fileInput.click();
          }
        }}
        type="button"
      >
        {i18n('icu:photo')}
      </button>
      <input
        accept=".gif,.jpg,.jpeg,.png,.webp,image/gif,image/jpeg,image/png,image/webp"
        hidden
        onChange={onInputChange}
        ref={fileInputRef}
        type="file"
      />
    </>
  );
}
