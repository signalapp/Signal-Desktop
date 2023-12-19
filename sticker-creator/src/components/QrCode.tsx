// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useMemo } from 'react';
import qrcode from 'qrcode-generator';

import styles from './QrCode.module.scss';

const AUTODETECT_TYPE_NUMBER = 0;
const ERROR_CORRECTION_LEVEL = 'L';

type PropsType = Readonly<{
  alt: string;
  data: string;
}>;

export function QrCode(props: PropsType): JSX.Element {
  const { alt, data } = props;

  const src = useMemo(() => {
    const qrCode = qrcode(AUTODETECT_TYPE_NUMBER, ERROR_CORRECTION_LEVEL);
    qrCode.addData(data);
    qrCode.make();

    const svgData = qrCode.createSvgTag({ cellSize: 1, margin: 0 });
    return `data:image/svg+xml;utf8,${svgData}`;
  }, [data]);

  return <img alt={alt} className={styles.code} src={src} />;
}
