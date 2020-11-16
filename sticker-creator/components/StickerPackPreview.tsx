// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import * as styles from './StickerPackPreview.scss';
import { useI18n } from '../util/i18n';

export type Props = {
  images: Array<string>;
  title: string;
  author: string;
};

export const StickerPackPreview = React.memo(
  ({ images, title, author }: Props) => {
    const i18n = useI18n();

    return (
      <div className={styles.container}>
        <div className={styles.titleBar}>
          {i18n('StickerCreator--Preview--title')}
        </div>
        <div className={styles.scroller}>
          <div className={styles.grid}>
            {images.map(src => (
              <img key={src} className={styles.sticker} src={src} alt={src} />
            ))}
          </div>
        </div>
        <div className={styles.meta}>
          <div className={styles.metaTitle}>{title}</div>
          <div className={styles.metaAuthor}>{author}</div>
        </div>
      </div>
    );
  }
);
