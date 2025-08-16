// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { Meta } from '@storybook/react';
import type { PropsType } from './BrandedQRCode';
import { BrandedQRCode } from './BrandedQRCode';

export default {
  title: 'Components/BrandedQRCode',
} satisfies Meta<PropsType>;

export function Default(): JSX.Element {
  return (
    <svg
      role="img"
      aria-label="Scan this little code!"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <BrandedQRCode
        size={16}
        color="black"
        link="sgnl://linkdevice?uuid=gCkj0T2xiSUaPRhMYiF24w&pub_key=7RshtQrb3UTMowITe79uW9dgw_CLTGWenj0OT80i0HpH"
      />
    </svg>
  );
}
