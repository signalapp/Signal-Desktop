// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import styles from './DropZone.module.scss';
import { useI18n } from '../contexts/I18n';
import { getFilePath } from '../util/api';
import { useStickerDropzone } from '../util/useStickerDropzone';

export type Props = {
  readonly inner?: boolean;
  readonly label: string;
  onDrop(files: ReadonlyArray<File>): unknown;
  onDragActive?(active: boolean): unknown;
};

const getClassName = ({ inner }: Props, isDragActive: boolean) => {
  if (inner) {
    return styles.base;
  }

  if (isDragActive) {
    return styles.active;
  }

  return styles.standalone;
};

export function DropZone(props: Props): JSX.Element {
  const { inner, label, onDrop, onDragActive } = props;
  const i18n = useI18n();

  const handleDrop = React.useCallback(
    (files: ReadonlyArray<File>) => {
      onDrop(
        files.filter((file): file is File => getFilePath(file) !== undefined)
      );
    },
    [onDrop]
  );

  const { getRootProps, getInputProps, isDragActive } =
    useStickerDropzone(handleDrop);

  React.useEffect(() => {
    if (onDragActive) {
      onDragActive(isDragActive);
    }
  }, [isDragActive, onDragActive]);

  return (
    <div
      {...getRootProps({ className: getClassName(props, isDragActive) })}
      role="button"
      aria-label={label}
    >
      <input {...getInputProps()} />
      <svg viewBox="0 0 36 36" width="36px" height="36px">
        <path d="M32 17.25H18.75V4h-1.5v13.25H4v1.5h13.25V32h1.5V18.75H32v-1.5z" />
      </svg>
      {!inner ? (
        <p className={styles.text}>
          {isDragActive
            ? i18n('StickerCreator--DropZone--activeText')
            : i18n('StickerCreator--DropZone--staticText')}
        </p>
      ) : null}
    </div>
  );
}
