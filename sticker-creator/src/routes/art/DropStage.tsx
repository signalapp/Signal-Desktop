// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useState, useEffect, type JSX } from 'react';
import { useDispatch } from 'react-redux';
import createDebug from 'debug';
import { AppStage } from './AppStage';
import styles from './DropStage.module.scss';
import { H2, Text } from '../../elements/Typography';
import { LabeledInput } from '../../elements/LabeledInput';
import { Button } from '../../elements/Button';
import { ProgressBar } from '../../elements/ProgressBar';
import { ArtGrid } from '../../components/ArtGrid';
import { resetStatus, initializePack, addToast } from '../../slices/art';
import { useArtType, useArtReady, useArtOrder } from '../../selectors/art';
import { importPack, toInitializePackPayload, APIError } from '../../util/api';
import { useI18n } from '../../contexts/I18n';

const debug = createDebug('signal:routes:stickers:DropStage');

export function DropStage(): JSX.Element {
  const i18n = useI18n();
  const dispatch = useDispatch();
  const artType = useArtType();
  const artReady = useArtReady();
  const order = useArtOrder();
  const [showGuide, setShowGuide] = useState<boolean>(true);
  const [importLink, setImportLink] = useState('');
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<
    { done: number; total: number } | undefined
  >();

  useEffect(() => {
    dispatch(resetStatus());
  }, [dispatch]);

  const handleImport = useCallback(async () => {
    dispatch(resetStatus());
    setImporting(true);
    setImportProgress(undefined);
    try {
      const contents = await importPack(importLink.trim(), (done, total) =>
        setImportProgress({ done, total })
      );
      dispatch(initializePack(toInitializePackPayload(contents)));
    } catch (e) {
      debug('Error importing pack:', e);
      dispatch(
        addToast({
          key:
            e instanceof APIError
              ? e.errorMessageI18nKey
              : 'StickerCreator--Toasts--errorImporting',
        })
      );
    } finally {
      setImporting(false);
    }
  }, [dispatch, importLink]);

  const importStatus = (
    <div className={styles.importStatus}>
      <Text>
        {importProgress
          ? i18n('StickerCreator--DropStage--import--progress', {
              count: String(importProgress.done),
              total: String(importProgress.total),
            })
          : i18n('StickerCreator--DropStage--import--loading')}
      </Text>
      <ProgressBar
        count={importProgress?.done ?? 0}
        total={importProgress?.total ?? 1}
      />
    </div>
  );

  const importForm = (
    <>
      <LabeledInput
        placeholder={i18n('StickerCreator--DropStage--import--placeholder')}
        value={importLink}
        onChange={setImportLink}
      >
        {i18n('StickerCreator--DropStage--import--label')}
      </LabeledInput>
      <Button onClick={handleImport} disabled={!importLink.trim()}>
        {i18n('StickerCreator--DropStage--import--button')}
      </Button>
    </>
  );

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
      {order.length === 0 ? (
        <div className={styles.import}>
          {importing ? importStatus : importForm}
        </div>
      ) : null}
    </AppStage>
  );
}
