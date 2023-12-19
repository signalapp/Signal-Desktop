// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import styles from './ArtPackPreview.module.scss';
import { useI18n } from '../contexts/I18n';
import { type ArtType } from '../constants';

export type Props = {
  artType: ArtType;
  images: ReadonlyArray<string>;
  title: string;
  author: string;
};

export const ArtPackPreview = React.memo(function ArtPackPreview({
  artType,
  images,
  title,
  author,
}: Props) {
  const i18n = useI18n();

  return (
    <div className={styles.container}>
      <div className={styles.titleBar}>
        {i18n(`StickerCreator--Preview--title--${artType}`)}
      </div>
      <div className={styles.scroller}>
        <div className={styles.grid}>
          {images.map(src => (
            <img key={src} className={styles.art} src={src} alt={src} />
          ))}
        </div>
      </div>
      <div className={styles.meta}>
        <div className={styles.metaText}>
          <div className={styles.metaTitle}>{title}</div>
          <div className={styles.metaAuthor}>{author}</div>
        </div>
      </div>
    </div>
  );
});
