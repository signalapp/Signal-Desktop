// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import createDebug from 'debug';

import { AppStage } from './AppStage';
import styles from './UploadStage.module.scss';
import { ProgressBar } from '../../elements/ProgressBar';
import { H2, Text } from '../../elements/Typography';
import { Button } from '../../elements/Button';
import { encrypt } from '../../util/crypto';
import { upload, APIError } from '../../util/api';
import { assert } from '../../util/assert';
import { noop } from '../../util/noop';
import { useI18n } from '../../contexts/I18n';
import { setPackMeta, addToast } from '../../slices/art';
import {
  useArtType,
  useCover,
  useTitle,
  useAuthor,
  useSelectOrderedData,
} from '../../selectors/art';

const debug = createDebug('signal:routes:stickers:UploadStage');

export function UploadStage(): JSX.Element {
  const i18n = useI18n();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const artType = useArtType();
  const cover = useCover();
  const title = useTitle();
  const author = useAuthor();
  const orderedData = useSelectOrderedData();
  const total = orderedData.length;
  const [complete, setComplete] = React.useState(0);

  const handleCancel = React.useCallback(() => {
    navigate('/art/add-meta');
  }, [navigate]);

  React.useEffect(() => {
    (async () => {
      const onProgress = () => {
        setComplete(i => i + 1);
      };
      try {
        if (!cover) {
          throw new Error('UploadStage: Cover was missing on upload!');
        }
        const encryptedPack = await encrypt({
          artType,
          manifest: { title, author },
          images: orderedData.map(({ emoji, imageData }) => {
            assert(
              emoji && imageData,
              "Can't have partial data at this stage!"
            );

            return {
              emoji,
              contentType: imageData.contentType,
              buffer: imageData.buffer,
            };
          }),
          cover,
        });
        const packMeta = await upload(encryptedPack, {
          artType,
          onProgress,
        });
        dispatch(setPackMeta(packMeta));
        navigate('/art/share');
      } catch (e) {
        assert(e instanceof Error, 'Expected Error');

        debug('Error uploading pack:', e);
        if (e instanceof APIError) {
          dispatch(
            addToast({
              key: e.errorMessageI18nKey,
            })
          );
        } else {
          dispatch(
            addToast({
              key: 'StickerCreator--Toasts--errorUploading',
              subs: { message: e.message },
            })
          );
        }
        navigate('/art/add-meta');
      }
    })();

    return noop;
  }, [dispatch, navigate, artType, title, author, cover, orderedData]);

  return (
    <AppStage empty>
      <div className={styles.base}>
        <H2>{i18n(`StickerCreator--UploadStage--title--${artType}`)}</H2>
        <Text className={styles.subtitle}>
          {i18n('StickerCreator--UploadStage-uploaded', {
            // We convert these to string so that 0 isn't falsy, which i18n checks for.
            count: String(complete),
            total: String(total),
          })}
        </Text>
        <ProgressBar
          count={complete}
          total={total}
          className={styles.progress}
        />
        <Button onClick={handleCancel}>{i18n('cancel')}</Button>
      </div>
    </AppStage>
  );
}
