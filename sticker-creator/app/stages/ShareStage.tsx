// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { AppStage } from './AppStage';
import * as styles from './ShareStage.scss';
import * as appStyles from './AppStage.scss';
import { history } from '../../util/history';
import { H2, Text } from '../../elements/Typography';
import { CopyText } from '../../elements/CopyText';
import { Toast } from '../../elements/Toast';
import { ShareButtons } from '../../components/ShareButtons';
import { StickerPackPreview } from '../../components/StickerPackPreview';
import { stickersDuck } from '../../store';
import { useI18n } from '../../util/i18n';
import { Intl } from '../../../ts/components/Intl';

export const ShareStage: React.ComponentType = () => {
  const i18n = useI18n();
  const actions = stickersDuck.useStickerActions();
  const title = stickersDuck.useTitle();
  const author = stickersDuck.useAuthor();
  const images = stickersDuck.useOrderedImagePaths();
  const shareUrl = stickersDuck.usePackUrl();
  const [linkCopied, setLinkCopied] = React.useState(false);
  const onCopy = React.useCallback(() => {
    setLinkCopied(true);
  }, [setLinkCopied]);
  const resetLinkCopied = React.useCallback(() => {
    setLinkCopied(false);
  }, [setLinkCopied]);

  const handleNext = React.useCallback(() => {
    window.close();
  }, []);

  const handlePrev = React.useCallback(() => {
    actions.reset();
    history.push('/');
  }, [actions]);

  return (
    <AppStage
      nextText={i18n('StickerCreator--ShareStage--close')}
      onNext={handleNext}
      nextActive
      prevText={i18n('StickerCreator--ShareStage--createAnother')}
      onPrev={handlePrev}
    >
      {shareUrl ? (
        <>
          <H2>{i18n('StickerCreator--ShareStage--title')}</H2>
          <Text className={styles.message}>
            {i18n('StickerCreator--ShareStage--help')}
          </Text>
          <div className={styles.main}>
            <div className={styles.row}>
              <StickerPackPreview
                title={title}
                author={author}
                images={images}
              />
            </div>
            <div className={styles.row}>
              <CopyText
                value={shareUrl}
                label={i18n('StickerCreator--ShareStage--copyTitle')}
                onCopy={onCopy}
              />
            </div>
            <div className={styles.row}>
              <Text className={styles.callToAction} center>
                <Intl
                  i18n={i18n}
                  id="StickerCreator--ShareStage--callToAction"
                  components={[
                    <strong key="hashtag">#makeprivacystick</strong>,
                  ]}
                />
              </Text>
            </div>
            <div className={styles.row}>
              <ShareButtons value={shareUrl} />
            </div>
          </div>
          {linkCopied ? (
            <div className={appStyles.toaster}>
              <Toast onClick={resetLinkCopied}>
                {i18n('StickerCreator--Toasts--linkedCopied')}
              </Toast>
            </div>
          ) : null}
        </>
      ) : null}
    </AppStage>
  );
};
