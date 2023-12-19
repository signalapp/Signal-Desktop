// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import logoUrl from '../assets/signal.svg';

import { useI18n } from '../contexts/I18n';
import { H1 } from './Typography';

import styles from './PageHeader.module.scss';

export function PageHeader(): JSX.Element {
  const i18n = useI18n();

  return (
    <div className={styles.header}>
      <img
        className={styles.icon}
        alt={i18n('StickerCreator--title--icon')}
        src={logoUrl}
        width="47"
        height="47"
      />
      <H1>{i18n('StickerCreator--title--sticker')}</H1>
      <div className={styles.grow} />
      <a
        className={styles.guidelines}
        href="https://support.signal.org/hc/articles/360031836512-Stickers#sticker_creator"
        target="_blank"
        rel="noreferrer"
      >
        {i18n('StickerCreator--guidelines')}
      </a>
    </div>
  );
}
