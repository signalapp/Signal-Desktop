// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { Link } from 'react-router-dom';

import { useI18n } from '../contexts/I18n';
import styles from './Index.module.scss';

export function Index(): JSX.Element {
  const i18n = useI18n();

  return (
    <>
      <div className={styles.container}>
        <Link to="/art/?artType=sticker">
          {i18n('index--create-sticker-pack')}
        </Link>
      </div>

      <footer />
    </>
  );
}
