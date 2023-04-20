// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { useDispatch } from 'react-redux';
import { AppStage } from './AppStage';
import styles from './DropStage.module.scss';
import { H2, Text } from '../../elements/Typography';
import { ArtGrid } from '../../components/ArtGrid';
import { resetStatus } from '../../slices/art';
import { useArtType, useArtReady } from '../../selectors/art';
import { useI18n } from '../../contexts/I18n';

export function DropStage(): JSX.Element {
  const i18n = useI18n();
  const dispatch = useDispatch();
  const artType = useArtType();
  const artReady = useArtReady();
  const [showGuide, setShowGuide] = React.useState<boolean>(true);

  React.useEffect(() => {
    dispatch(resetStatus());
  }, [dispatch]);

  return (
    <AppStage
      next="/art/add-emojis"
      nextActive={artReady}
      noScroll
      showGuide={showGuide}
      setShowGuide={setShowGuide}
    >
      <H2>{i18n(`icu:StickerCreator--DropStage--title--${artType}`)}</H2>
      <div className={styles.info}>
        <Text className={styles.message}>
          {i18n(`StickerCreator--DropStage--help--${artType}`)}
        </Text>
      </div>
      <div className={styles.main}>
        <ArtGrid mode="add" showGuide={showGuide} />
      </div>
    </AppStage>
  );
}
