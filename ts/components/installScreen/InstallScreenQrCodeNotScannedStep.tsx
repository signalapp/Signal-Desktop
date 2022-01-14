// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactElement, ReactNode } from 'react';
import React from 'react';
import classNames from 'classnames';

import type { LocalizerType } from '../../types/Util';
import { missingCaseError } from '../../util/missingCaseError';
import type { Loadable } from '../../util/loadable';
import { LoadingState } from '../../util/loadable';

import { Intl } from '../Intl';
import { Spinner } from '../Spinner';
import { QrCode } from '../QrCode';
import { TitlebarDragArea } from '../TitlebarDragArea';
import { InstallScreenSignalLogo } from './InstallScreenSignalLogo';
import { getClassNamesFor } from '../../util/getClassNamesFor';

// We can't always use destructuring assignment because of the complexity of this props
//   type.
/* eslint-disable react/destructuring-assignment */
type PropsType = {
  i18n: LocalizerType;
  provisioningUrl: Loadable<string>;
};

const QR_CODE_FAILED_LINK =
  'https://support.signal.org/hc/articles/360007320451#desktop_multiple_device';

const getQrCodeClassName = getClassNamesFor(
  'module-InstallScreenQrCodeNotScannedStep__qr-code'
);

export const InstallScreenQrCodeNotScannedStep = ({
  i18n,
  provisioningUrl,
}: Readonly<PropsType>): ReactElement => (
  <div className="module-InstallScreenQrCodeNotScannedStep">
    <TitlebarDragArea />

    <InstallScreenSignalLogo />

    <div className="module-InstallScreenQrCodeNotScannedStep__contents">
      <InstallScreenQrCode i18n={i18n} {...provisioningUrl} />
      <div className="module-InstallScreenQrCodeNotScannedStep__instructions">
        <h1>{i18n('Install__scan-this-code')}</h1>
        <ol>
          <li>{i18n('Install__instructions__1')}</li>
          <li>
            <Intl
              i18n={i18n}
              id="Install__instructions__2"
              components={{
                settings: (
                  <strong>{i18n('Install__instructions__2__settings')}</strong>
                ),
                linkedDevices: <strong>{i18n('linkedDevices')}</strong>,
              }}
            />
          </li>
          <li>
            <Intl
              i18n={i18n}
              id="Install__instructions__3"
              components={{
                plusButton: (
                  <div
                    className="module-InstallScreenQrCodeNotScannedStep__android-plus"
                    aria-label="+"
                  />
                ),
                linkNewDevice: <strong>{i18n('linkNewDevice')}</strong>,
              }}
            />
          </li>
        </ol>
        <a href="https://support.signal.org/hc/articles/360007320451#desktop_multiple_device">
          {i18n('Install__support-link')}
        </a>
      </div>
    </div>
  </div>
);

function InstallScreenQrCode(
  props: Loadable<string> & { i18n: LocalizerType }
): ReactElement {
  const { i18n } = props;

  let contents: ReactNode;
  switch (props.loadingState) {
    case LoadingState.Loading:
      contents = <Spinner size="24px" svgSize="small" />;
      break;
    case LoadingState.LoadFailed:
      contents = (
        <span className={classNames(getQrCodeClassName('__error-message'))}>
          <Intl
            i18n={i18n}
            id="Install__qr-failed"
            components={[
              <a href={QR_CODE_FAILED_LINK}>
                {i18n('Install__qr-failed__learn-more')}
              </a>,
            ]}
          />
        </span>
      );
      break;
    case LoadingState.Loaded:
      contents = (
        <QrCode
          alt={i18n('Install__scan-this-code')}
          className={getQrCodeClassName('__code')}
          data={props.value}
        />
      );
      break;
    default:
      throw missingCaseError(props);
  }

  return (
    <div
      className={classNames(
        getQrCodeClassName(''),
        props.loadingState === LoadingState.Loaded &&
          getQrCodeClassName('--loaded'),
        props.loadingState === LoadingState.LoadFailed &&
          getQrCodeClassName('--load-failed')
      )}
    >
      {contents}
    </div>
  );
}
