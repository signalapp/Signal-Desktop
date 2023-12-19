// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { AppStage } from './AppStage';
import styles from './DropStage.module.scss';
import { H2, Text } from '../../elements/Typography';
import { ArtGrid } from '../../components/ArtGrid';
import { useArtType, useEmojisReady } from '../../selectors/art';
import { useI18n } from '../../contexts/I18n';

export function EmojiStage(): JSX.Element {
  const i18n = useI18n();
  const artType = useArtType();
  const emojisReady = useEmojisReady();

  return (
    <AppStage next="/art/add-meta" prev="/art/drop" nextActive={emojisReady}>
      <H2>{i18n(`StickerCreator--EmojiStage--title--${artType}`)}</H2>
      <div className={styles.info}>
        <Text className={styles.message}>
          {i18n(`StickerCreator--EmojiStage--help--${artType}`)}
        </Text>
      </div>
      <div className={styles.main}>
        <ArtGrid mode="pick-emoji" />
      </div>
    </AppStage>
  );
}
