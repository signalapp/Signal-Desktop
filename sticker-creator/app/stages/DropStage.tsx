import * as React from 'react';
import { AppStage } from './AppStage';
import * as styles from './DropStage.scss';
import * as appStyles from './AppStage.scss';
import { H2, Text } from '../../elements/Typography';
import { LabeledCheckbox } from '../../elements/LabeledCheckbox';
import { Toast } from '../../elements/Toast';
import { StickerGrid } from '../../components/StickerGrid';
import { stickersDuck } from '../../store';
import { useI18n } from '../../util/i18n';

const renderToaster = ({
  hasAnimated,
  hasTooLarge,
  numberAdded,
  resetStatus,
  i18n,
}: {
  hasAnimated: boolean;
  hasTooLarge: boolean;
  numberAdded: number;
  resetStatus: () => unknown;
  i18n: ReturnType<typeof useI18n>;
}) => {
  if (hasAnimated) {
    return (
      <div className={appStyles.toaster}>
        <Toast onClick={resetStatus}>
          {i18n('StickerCreator--Toasts--animated')}
        </Toast>
      </div>
    );
  }

  if (hasTooLarge) {
    return (
      <div className={appStyles.toaster}>
        <Toast onClick={resetStatus}>
          {i18n('StickerCreator--Toasts--tooLarge')}
        </Toast>
      </div>
    );
  }

  if (numberAdded > 0) {
    return (
      <div className={appStyles.toaster}>
        <Toast onClick={resetStatus}>
          {i18n('StickerCreator--Toasts--imagesAdded', [numberAdded])}
        </Toast>
      </div>
    );
  }

  return null;
};

export const DropStage = () => {
  const i18n = useI18n();
  const stickerPaths = stickersDuck.useStickerOrder();
  const stickersReady = stickersDuck.useStickersReady();
  const haveStickers = stickerPaths.length > 0;
  const hasAnimated = stickersDuck.useHasAnimated();
  const hasTooLarge = stickersDuck.useHasTooLarge();
  const numberAdded = stickersDuck.useImageAddedCount();
  const [showGuide, setShowGuide] = React.useState<boolean>(true);
  const { resetStatus } = stickersDuck.useStickerActions();

  React.useEffect(() => {
    resetStatus();
  }, []);

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
      {renderToaster({
        hasAnimated,
        hasTooLarge,
        numberAdded,
        resetStatus,
        i18n,
      })}
    </AppStage>
  );
};
