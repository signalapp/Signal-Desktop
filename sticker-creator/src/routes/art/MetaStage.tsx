// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';

import { getFilePath } from '../../util/api';
import { processImage } from '../../util/processImage';
import { useStickerDropzone } from '../../util/useStickerDropzone';
import { H2, Text } from '../../elements/Typography';
import { LabeledInput } from '../../elements/LabeledInput';
import { ConfirmModal } from '../../components/ConfirmModal';
import { setCover, removeImage, setTitle, setAuthor } from '../../slices/art';
import {
  useArtType,
  useAllDataValid,
  useCover,
  useTitle,
  useAuthor,
} from '../../selectors/art';
import { useI18n } from '../../contexts/I18n';
import styles from './MetaStage.module.scss';
import { AppStage } from './AppStage';

export function MetaStage(): JSX.Element {
  const i18n = useI18n();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const artType = useArtType();
  const valid = useAllDataValid();
  const cover = useCover();
  const title = useTitle();
  const author = useAuthor();
  const [confirming, setConfirming] = React.useState(false);

  const onDrop = React.useCallback(
    async ([file]: Array<File>) => {
      try {
        const stickerImage = await processImage(file, artType);
        dispatch(setCover(stickerImage));
      } catch (e) {
        dispatch(removeImage(getFilePath(file) || file.name));
      }
    },
    [dispatch, artType]
  );

  const { getRootProps, getInputProps, isDragActive } =
    useStickerDropzone(onDrop);

  const onNext = React.useCallback(() => {
    setConfirming(true);
  }, []);

  const onCancel = React.useCallback(() => {
    setConfirming(false);
  }, []);

  const onConfirm = React.useCallback(() => {
    navigate('/art/upload');
  }, [navigate]);

  return (
    <AppStage
      onNext={onNext}
      nextActive={valid}
      noMessage
      prev="/art/add-emojis"
    >
      {confirming ? (
        <ConfirmModal
          title={i18n(
            `StickerCreator--MetaStage--ConfirmDialog--title--${artType}`
          )}
          confirm={i18n('StickerCreator--MetaStage--ConfirmDialog--confirm')}
          onCancel={onCancel}
          onConfirm={onConfirm}
        >
          {i18n(`StickerCreator--MetaStage--ConfirmDialog--text--${artType}`)}
        </ConfirmModal>
      ) : null}
      <H2>{i18n('StickerCreator--MetaStage--title')}</H2>
      <div className={styles.main}>
        <div className={styles.row}>
          <LabeledInput
            value={title}
            onChange={value => dispatch(setTitle(value))}
            placeholder={i18n(
              'StickerCreator--MetaStage--Field--title-placeholder'
            )}
          >
            {i18n('StickerCreator--MetaStage--Field--title')}
          </LabeledInput>
        </div>
        <div className={styles.row}>
          <LabeledInput
            value={author}
            onChange={value => dispatch(setAuthor(value))}
            placeholder={i18n(
              'StickerCreator--MetaStage--Field--author-placeholder'
            )}
          >
            {i18n('StickerCreator--MetaStage--Field--author')}
          </LabeledInput>
        </div>
        <div className={styles.row}>
          <h3 className={styles.label}>
            {i18n('StickerCreator--MetaStage--Field--cover')}
          </h3>
          <Text>
            {i18n(`StickerCreator--MetaStage--Field--cover--help--${artType}`)}
          </Text>
          <div className={styles.coverContainer}>
            <div
              {...getRootProps()}
              className={styles.coverFrame}
              data-drag-active={isDragActive}
            >
              <div className={styles.editButton} />
              {cover?.src ? (
                <img
                  className={styles.coverImage}
                  data-art-type={artType}
                  src={cover.src}
                  alt="Cover"
                />
              ) : null}
              <input {...getInputProps()} />
            </div>
          </div>
        </div>
      </div>
    </AppStage>
  );
}
