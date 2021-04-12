// Copyright 2019-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { noop } from 'lodash';
import { AppStage } from './AppStage';
import * as styles from './UploadStage.scss';
import { history } from '../../util/history';
import { ProgressBar } from '../../elements/ProgressBar';
import { H2, Text } from '../../elements/Typography';
import { Button } from '../../elements/Button';
import { stickersDuck } from '../../store';
import { encryptAndUpload } from '../../util/preload';
import { useI18n } from '../../util/i18n';

const handleCancel = () => {
  history.push('/add-meta');
};

export const UploadStage: React.ComponentType = () => {
  const i18n = useI18n();
  const actions = stickersDuck.useStickerActions();
  const cover = stickersDuck.useCover();
  const title = stickersDuck.useTitle();
  const author = stickersDuck.useAuthor();
  const orderedData = stickersDuck.useSelectOrderedData();
  const total = orderedData.length;
  const [complete, setComplete] = React.useState(0);

  React.useEffect(() => {
    (async () => {
      const onProgress = () => {
        setComplete(i => i + 1);
      };
      try {
        const packMeta = await encryptAndUpload(
          { title, author },
          orderedData,
          cover,
          onProgress
        );
        actions.setPackMeta(packMeta);
        history.push('/share');
      } catch (e) {
        window.log.error('Error uploading image:', e);
        actions.addToast({
          key: 'StickerCreator--Toasts--errorUploading',
          subs: [e.message],
        });
        history.push('/add-meta');
      }
    })();

    return noop;
  }, [actions, title, author, cover, orderedData]);

  return (
    <AppStage empty>
      <div className={styles.base}>
        <H2>{i18n('StickerCreator--UploadStage--title')}</H2>
        <Text>
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
};
