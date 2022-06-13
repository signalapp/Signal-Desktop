// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import type { FileWithPath } from 'react-dropzone';
import { AppStage } from './AppStage';
import * as styles from './MetaStage.scss';
import { processStickerImage } from '../../util/preload';
import { useStickerDropzone } from '../../util/useStickerDropzone';
import { history } from '../../util/history';
import { H2, Text } from '../../elements/Typography';
import { LabeledInput } from '../../elements/LabeledInput';
import { ConfirmModal } from '../../components/ConfirmModal';
import { stickersDuck } from '../../store';
import { useI18n } from '../../util/i18n';

export const MetaStage: React.ComponentType = () => {
  const i18n = useI18n();
  const actions = stickersDuck.useStickerActions();
  const valid = stickersDuck.useAllDataValid();
  const cover = stickersDuck.useCover();
  const title = stickersDuck.useTitle();
  const author = stickersDuck.useAuthor();
  const [confirming, setConfirming] = React.useState(false);

  const onDrop = React.useCallback(
    async ([{ path }]: Array<FileWithPath>) => {
      try {
        const stickerImage = await processStickerImage(path);
        actions.setCover(stickerImage);
      } catch (e) {
        actions.removeSticker(path);
      }
    },
    [actions]
  );

  const { getRootProps, getInputProps, isDragActive } =
    useStickerDropzone(onDrop);

  const onNext = React.useCallback(() => {
    setConfirming(true);
  }, [setConfirming]);

  const onCancel = React.useCallback(() => {
    setConfirming(false);
  }, [setConfirming]);

  const onConfirm = React.useCallback(() => {
    history.push('/upload');
  }, []);

  const coverFrameClass = isDragActive
    ? styles.coverFrameActive
    : styles.coverFrame;

  return (
    <AppStage onNext={onNext} nextActive={valid} noMessage prev="/add-emojis">
      {confirming ? (
        <ConfirmModal
          title={i18n('StickerCreator--MetaStage--ConfirmDialog--title')}
          confirm={i18n('StickerCreator--MetaStage--ConfirmDialog--confirm')}
          onCancel={onCancel}
          onConfirm={onConfirm}
        >
          {i18n('StickerCreator--MetaStage--ConfirmDialog--text')}
        </ConfirmModal>
      ) : null}
      <H2>{i18n('StickerCreator--MetaStage--title')}</H2>
      <div className={styles.main}>
        <div className={styles.row}>
          <LabeledInput value={title} onChange={actions.setTitle}>
            {i18n('StickerCreator--MetaStage--Field--title')}
          </LabeledInput>
        </div>
        <div className={styles.row}>
          <LabeledInput value={author} onChange={actions.setAuthor}>
            {i18n('StickerCreator--MetaStage--Field--author')}
          </LabeledInput>
        </div>
        <div className={styles.row}>
          <h3 className={styles.label}>
            {i18n('StickerCreator--MetaStage--Field--cover')}
          </h3>
          <Text>{i18n('StickerCreator--MetaStage--Field--cover--help')}</Text>
          <div className={styles.coverContainer}>
            <div {...getRootProps()} className={coverFrameClass}>
              {cover?.src ? (
                <img
                  className={styles.coverImage}
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
};
