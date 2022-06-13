// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import * as styles from './MessageMeta.scss';
import { useI18n } from '../util/i18n';

export type Props = {
  kind?: 'bubble' | 'dark' | 'light';
  minutesAgo: number;
};

const getItemClass = ({ kind }: Props) => {
  if (kind === 'dark') {
    return styles.dark;
  }

  if (kind === 'light') {
    return styles.light;
  }

  return styles.bubble;
};

export const MessageMeta = React.memo((props: Props) => {
  const i18n = useI18n();
  const itemClass = getItemClass(props);

  return (
    <div className={styles.base}>
      <svg width={12} height={12} className={itemClass}>
        <g fillRule="evenodd">
          <path d="M8.5 1.67L9 .804a6 6 0 11-7.919 1.76l.868.504-.008.011L6.25 5.567l-.5.866-4.309-2.488A5 5 0 108.5 1.67z" />
          <path d="M6.003 1H6a5.06 5.06 0 00-.5.025V.02A6.08 6.08 0 016 0h.003A6 6 0 0112 6h-1a5 5 0 00-4.997-5zM3.443.572l.502.87a5.06 5.06 0 00-.866.5l-.502-.87a6.08 6.08 0 01.866-.5z" />
        </g>
      </svg>
      <div className={itemClass}>
        {i18n('minutesAgo', [props.minutesAgo.toString()])}
      </div>
      <svg width={18} height={12} className={itemClass}>
        <defs>
          <path
            d="M7.917.313a6.99 6.99 0 00-2.844 6.7L5 7.084l-1.795-1.79L2.5 6 5 8.5l.34-.34a7.015 7.015 0 002.577 3.527A6.002 6.002 0 010 6 6.002 6.002 0 017.917.313zM12 0c3.312 0 6 2.688 6 6s-2.688 6-6 6-6-2.688-6-6 2.688-6 6-6zm-1 8.5L15.5 4l-.705-.71L11 7.085l-1.795-1.79L8.5 6 11 8.5z"
            id="prefix__a"
          />
          <path id="prefix__c" d="M0 0h18v12H0z" />
        </defs>
        <g fillRule="evenodd">
          <mask id="prefix__b">
            <use xlinkHref="#prefix__a" />
          </mask>
          <g mask="url(#prefix__b)">
            <use xlinkHref="#prefix__c" />
          </g>
        </g>
      </svg>
    </div>
  );
});
