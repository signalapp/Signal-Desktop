// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';

import { AppStage } from './AppStage';
import styles from './ShareStage.module.scss';
import appStyles from './AppStage.module.scss';
import { H2, Text } from '../../elements/Typography';
import { CopyText } from '../../elements/CopyText';
import { Toast } from '../../elements/Toast';
import { ShareButtons } from '../../components/ShareButtons';
import { ArtPackPreview } from '../../components/ArtPackPreview';
import { Intl } from '../../components/Intl';
import { reset } from '../../slices/art';
import {
  useArtType,
  useTitle,
  useAuthor,
  useOrderedImagePaths,
  usePackUrl,
} from '../../selectors/art';
import { useI18n } from '../../contexts/I18n';

export function ShareStage(): JSX.Element {
  const i18n = useI18n();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const artType = useArtType();
  const title = useTitle();
  const author = useAuthor();
  const images = useOrderedImagePaths();
  const shareUrl = usePackUrl();
  const [linkCopied, setLinkCopied] = React.useState(false);
  const onCopy = React.useCallback(() => {
    setLinkCopied(true);
  }, [setLinkCopied]);
  const resetLinkCopied = React.useCallback(() => {
    setLinkCopied(false);
  }, [setLinkCopied]);

  const handlePrev = React.useCallback(() => {
    dispatch(reset(artType));
    navigate('/');
  }, [dispatch, artType, navigate]);

  return (
    <AppStage
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
              <ArtPackPreview
                artType={artType}
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
                  components={{
                    hashtag: <strong key="hashtag">#makeprivacystick</strong>,
                  }}
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
}
