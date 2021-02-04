// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { AppStage } from './AppStage';
import * as styles from './DropStage.scss';
import { H2, Text } from '../../elements/Typography';
import { LabeledCheckbox } from '../../elements/LabeledCheckbox';
import { StickerGrid } from '../../components/StickerGrid';
import { stickersDuck } from '../../store';
import { useI18n } from '../../util/i18n';

export const DropStage: React.ComponentType = () => {
  const i18n = useI18n();
  const stickerPaths = stickersDuck.useStickerOrder();
  const stickersReady = stickersDuck.useStickersReady();
  const haveStickers = stickerPaths.length > 0;
  const [showGuide, setShowGuide] = React.useState<boolean>(true);
  const { resetStatus } = stickersDuck.useStickerActions();

  React.useEffect(() => {
    resetStatus();
  }, [resetStatus]);

  return (
    <AppStage next="/add-emojis" nextActive={stickersReady}>
      <H2>{i18n('StickerCreator--DropStage--title')}</H2>
      <div className={styles.info}>
        <Text className={styles.message}>
          {i18n('StickerCreator--DropStage--help')}
        </Text>
        {haveStickers ? (
          <LabeledCheckbox onChange={setShowGuide} value={showGuide}>
            {i18n('StickerCreator--DropStage--showMargins')}
          </LabeledCheckbox>
        ) : null}
      </div>
      <div className={styles.main}>
        <StickerGrid mode="add" showGuide={showGuide} />
      </div>
    </AppStage>
  );
};
