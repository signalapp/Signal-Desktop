// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { AppStage } from './AppStage';
import * as styles from './DropStage.scss';
import { H2, Text } from '../../elements/Typography';
import { StickerGrid } from '../../components/StickerGrid';
import { stickersDuck } from '../../store';
import { useI18n } from '../../util/i18n';

export const EmojiStage: React.ComponentType = () => {
  const i18n = useI18n();
  const emojisReady = stickersDuck.useEmojisReady();

  return (
    <AppStage next="/add-meta" prev="/drop" nextActive={emojisReady}>
      <H2>{i18n('StickerCreator--EmojiStage--title')}</H2>
      <div className={styles.info}>
        <Text className={styles.message}>
          {i18n('StickerCreator--EmojiStage--help')}
        </Text>
      </div>
      <div className={styles.main}>
        <StickerGrid mode="pick-emoji" />
      </div>
    </AppStage>
  );
};
