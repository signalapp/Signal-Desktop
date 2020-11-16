// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { Redirect, Route, Switch } from 'react-router-dom';
import { DropStage } from './stages/DropStage';
import { EmojiStage } from './stages/EmojiStage';
import { UploadStage } from './stages/UploadStage';
import { MetaStage } from './stages/MetaStage';
import { ShareStage } from './stages/ShareStage';
import * as styles from './index.scss';
import { PageHeader } from '../elements/PageHeader';
import { useI18n } from '../util/i18n';

export const App: React.ComponentType = () => {
  const i18n = useI18n();

  return (
    <div className={styles.container}>
      <PageHeader>{i18n('StickerCreator--title')}</PageHeader>
      <Switch>
        <Route path="/drop">
          <DropStage />
        </Route>
        <Route path="/add-emojis">
          <EmojiStage />
        </Route>
        <Route path="/add-meta">
          <MetaStage />
        </Route>
        <Route path="/upload">
          <UploadStage />
        </Route>
        <Route path="/share">
          <ShareStage />
        </Route>
        <Redirect to="/drop" />
      </Switch>
    </div>
  );
};
