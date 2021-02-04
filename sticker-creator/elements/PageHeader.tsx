// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import * as styles from './PageHeader.scss';
import { H1 } from './Typography';

export type Props = {
  children: React.ReactNode;
};

export const PageHeader = React.memo(({ children }: Props) => (
  <H1 className={styles.base}>{children}</H1>
));
