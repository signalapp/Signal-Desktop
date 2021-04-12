// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, {
  useRef,
  useState,
  useEffect,
  ChangeEventHandler,
  MouseEventHandler,
  FunctionComponent,
} from 'react';
import classNames from 'classnames';
import { ContextMenu, MenuItem, ContextMenuTrigger } from 'react-contextmenu';
import loadImage, { LoadImageOptions } from 'blueimp-load-image';
import { noop } from 'lodash';

import { LocalizerType } from '../types/Util';
import { Spinner } from './Spinner';
import { canvasToArrayBuffer } from '../util/canvasToArrayBuffer';

type PropsType = {
  // This ID needs to be globally unique across the app.
  contextMenuId: string;
  disabled?: boolean;
  i18n: LocalizerType;
  onChange: (value: undefined | ArrayBuffer) => unknown;
  value: undefined | ArrayBuffer;
  variant?: AvatarInputVariant;
};

enum ImageStatus {
  Nothing = 'nothing',
  Loading = 'loading',
  HasImage = 'has-image',
}

export enum AvatarInputVariant {
  Light = 'light',
  Dark = 'dark',
}

export const AvatarInput: FunctionComponent<PropsType> = ({
  contextMenuId,
  disabled,
  i18n,
  onChange,
  value,
  variant = AvatarInputVariant.Light,
}) => {
  const fileInputRef = useRef<null | HTMLInputElement>(null);
  // Comes from a third-party dependency
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const menuTriggerRef = useRef<null | any>(null);

  const [objectUrl, setObjectUrl] = useState<undefined | string>();
  useEffect(() => {
    if (!value) {
      setObjectUrl(undefined);
      return noop;
    }
    const url = URL.createObjectURL(new Blob([value]));
    setObjectUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [value]);

  const [processingFile, setProcessingFile] = useState<undefined | File>(
    undefined
  );
  useEffect(() => {
    if (!processingFile) {
      return noop;
    }

    let shouldCancel = false;

    (async () => {
      let newValue: ArrayBuffer;
      try {
        newValue = await processFile(processingFile);
      } catch (err) {
        // Processing errors should be rare; if they do, we silently fail. In an ideal
        //   world, we may want to show a toast instead.
        return;
      }
      if (shouldCancel) {
        return;
      }
      setProcessingFile(undefined);
      onChange(newValue);
    })();

    return () => {
      shouldCancel = true;
    };
  }, [processingFile, onChange]);

  const buttonLabel = value
    ? i18n('AvatarInput--change-photo-label')
    : i18n('AvatarInput--no-photo-label--group');

  const startUpload = () => {
    const fileInput = fileInputRef.current;
    if (fileInput) {
      fileInput.click();
    }
  };

  const clear = () => {
    onChange(undefined);
  };

  const onClick: MouseEventHandler<unknown> = value
    ? event => {
        const menuTrigger = menuTriggerRef.current;
        if (!menuTrigger) {
          return;
        }
        menuTrigger.handleContextClick(event);
      }
    : startUpload;

  const onInputChange: ChangeEventHandler<HTMLInputElement> = event => {
    const file = event.target.files && event.target.files[0];
    if (file) {
      setProcessingFile(file);
    }
  };

  let imageStatus: ImageStatus;
  if (processingFile || (value && !objectUrl)) {
    imageStatus = ImageStatus.Loading;
  } else if (objectUrl) {
    imageStatus = ImageStatus.HasImage;
  } else {
    imageStatus = ImageStatus.Nothing;
  }

  const isLoading = imageStatus === ImageStatus.Loading;

  return (
    <>
      <ContextMenuTrigger id={contextMenuId} ref={menuTriggerRef}>
        <button
          type="button"
          disabled={disabled || isLoading}
          className={classNames(
            'module-AvatarInput',
            `module-AvatarInput--${variant}`
          )}
          onClick={onClick}
        >
          <div
            className={`module-AvatarInput__avatar module-AvatarInput__avatar--${imageStatus}`}
            style={
              imageStatus === ImageStatus.HasImage
                ? {
                    backgroundImage: `url(${objectUrl})`,
                  }
                : undefined
            }
          >
            {isLoading && (
              <Spinner size="70px" svgSize="normal" direction="on-avatar" />
            )}
          </div>
          <span className="module-AvatarInput__label">{buttonLabel}</span>
        </button>
      </ContextMenuTrigger>
      <ContextMenu id={contextMenuId}>
        <MenuItem onClick={startUpload}>
          {i18n('AvatarInput--upload-photo-choice')}
        </MenuItem>
        <MenuItem onClick={clear}>
          {i18n('AvatarInput--remove-photo-choice')}
        </MenuItem>
      </ContextMenu>
      <input
        accept=".gif,.jpg,.jpeg,.png,.webp,image/gif,image/jpeg/image/png,image/webp"
        hidden
        onChange={onInputChange}
        ref={fileInputRef}
        type="file"
      />
    </>
  );
};

async function processFile(file: File): Promise<ArrayBuffer> {
  const { image } = await loadImage(file, {
    canvas: true,
    cover: true,
    crop: true,
    imageSmoothingQuality: 'medium',
    maxHeight: 512,
    maxWidth: 512,
    minHeight: 2,
    minWidth: 2,
    // `imageSmoothingQuality` is not present in `loadImage`'s types, but it is
    //   documented and supported. Updating DefinitelyTyped is the long-term solution
    //   here.
  } as LoadImageOptions);

  // NOTE: The types for `loadImage` say this can never be a canvas, but it will be if
  //   `canvas: true`, at least in our case. Again, updating DefinitelyTyped should
  //   address this.
  if (!(image instanceof HTMLCanvasElement)) {
    throw new Error('Loaded image was not a canvas');
  }

  return canvasToArrayBuffer(image);
}
