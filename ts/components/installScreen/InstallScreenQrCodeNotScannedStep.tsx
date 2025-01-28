// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactElement, ReactNode } from 'react';
import React, { useCallback, useState, useEffect } from 'react';
import classNames from 'classnames';
import { noop } from 'lodash';

import type { LocalizerType } from '../../types/Util';
import {
  InstallScreenStep,
  InstallScreenQRCodeError,
} from '../../types/InstallScreen';
import { missingCaseError } from '../../util/missingCaseError';
import type { Loadable } from '../../util/loadable';
import { LoadingState } from '../../util/loadable';
import { drop } from '../../util/drop';
import { getEnvironment, Environment } from '../../environment';

import { I18n } from '../I18n';
import { Spinner } from '../Spinner';
import { BrandedQRCode } from '../BrandedQRCode';
import { TitlebarDragArea } from '../TitlebarDragArea';
import { InstallScreenSignalLogo } from './InstallScreenSignalLogo';
import { InstallScreenUpdateDialog } from './InstallScreenUpdateDialog';
import { getClassNamesFor } from '../../util/getClassNamesFor';
import type { UpdatesStateType } from '../../state/ducks/updates';

// We can't always use destructuring assignment because of the complexity of this props
//   type.

export type PropsType = Readonly<{
  i18n: LocalizerType;
  provisioningUrl: Loadable<string, InstallScreenQRCodeError>;
  hasExpired?: boolean;
  updates: UpdatesStateType;
  currentVersion: string;
  OS: string;
  isStaging: boolean;
  retryGetQrCode: () => void;
  startUpdate: () => void;
  forceUpdate: () => void;
}>;

const getQrCodeClassName = getClassNamesFor(
  'module-InstallScreenQrCodeNotScannedStep__qr-code'
);

const SUPPORT_PAGE =
  'https://support.signal.org/hc/articles/360007320451#desktop_multiple_device';

export function InstallScreenQrCodeNotScannedStep({
  currentVersion,
  hasExpired,
  i18n,
  isStaging,
  OS,
  provisioningUrl,
  retryGetQrCode,
  startUpdate,
  forceUpdate,
  updates,
}: Readonly<PropsType>): ReactElement {
  return (
    <div className="module-InstallScreenQrCodeNotScannedStep">
      <TitlebarDragArea />

      <InstallScreenSignalLogo />

      {hasExpired && (
        <InstallScreenUpdateDialog
          i18n={i18n}
          {...updates}
          step={InstallScreenStep.QrCodeNotScanned}
          startUpdate={startUpdate}
          forceUpdate={forceUpdate}
          currentVersion={currentVersion}
          OS={OS}
        />
      )}

      <div className="module-InstallScreenQrCodeNotScannedStep__contents">
        <InstallScreenQrCode
          i18n={i18n}
          {...provisioningUrl}
          retryGetQrCode={retryGetQrCode}
        />
        <div className="module-InstallScreenQrCodeNotScannedStep__instructions">
          <h1>{i18n('icu:Install__scan-this-code')}</h1>
          <ol>
            <li>{i18n('icu:Install__instructions__1')}</li>
            <li>
              <I18n
                i18n={i18n}
                id="icu:Install__instructions__2"
                components={{
                  settings: (
                    <strong>
                      {i18n('icu:Install__instructions__2__settings')}
                    </strong>
                  ),
                  linkedDevices: <strong>{i18n('icu:linkedDevices')}</strong>,
                }}
              />
            </li>
            <li>
              <I18n
                i18n={i18n}
                id="icu:Install__instructions__3"
                components={{
                  linkNewDevice: <strong>{i18n('icu:linkNewDevice')}</strong>,
                }}
              />
            </li>
          </ol>
          {isStaging ? (
            'THIS IS A STAGING DESKTOP'
          ) : (
            <a target="_blank" rel="noreferrer" href={SUPPORT_PAGE}>
              {i18n('icu:Install__support-link')}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function InstallScreenQrCode(
  props: Loadable<string, InstallScreenQRCodeError> & {
    i18n: LocalizerType;
    retryGetQrCode: () => void;
  }
): ReactElement {
  const { i18n, retryGetQrCode } = props;

  let contents: ReactNode;

  const loadError =
    props.loadingState === LoadingState.LoadFailed ? props.error : undefined;

  useEffect(() => {
    if (loadError !== InstallScreenQRCodeError.MaxRotations) {
      return noop;
    }

    const cleanup = () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        return;
      }

      cleanup();
      retryGetQrCode();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return cleanup;
  }, [retryGetQrCode, loadError]);

  let isJustButton = false;
  switch (props.loadingState) {
    case LoadingState.Loading:
      contents = <Spinner size="24px" svgSize="small" />;
      break;
    case LoadingState.LoadFailed:
      switch (props.error) {
        case InstallScreenQRCodeError.Timeout:
          contents = (
            <>
              <span
                className={classNames(getQrCodeClassName('__error-message'))}
              >
                {i18n('icu:Install__qr-failed-load__error--timeout')}
              </span>
              <RetryButton onClick={retryGetQrCode}>
                {i18n('icu:Install__qr-failed-load__retry')}
              </RetryButton>
            </>
          );
          break;
        case InstallScreenQRCodeError.Unknown:
          contents = (
            <>
              <span
                className={classNames(getQrCodeClassName('__error-message'))}
              >
                <I18n
                  i18n={i18n}
                  id="icu:Install__qr-failed-load__error--unknown"
                  components={{ paragraph: Paragraph }}
                />
              </span>
              <RetryButton onClick={retryGetQrCode}>
                {i18n('icu:Install__qr-failed-load__retry')}
              </RetryButton>
            </>
          );
          break;
        case InstallScreenQRCodeError.NetworkIssue:
          contents = (
            <>
              <span
                className={classNames(getQrCodeClassName('__error-message'))}
              >
                {i18n('icu:Install__qr-failed-load__error--network')}
              </span>

              <a
                className={classNames(getQrCodeClassName('__get-help'))}
                target="_blank"
                rel="noreferrer"
                href={SUPPORT_PAGE}
              >
                {i18n('icu:Install__qr-failed-load__get-help')}
              </a>
            </>
          );
          break;
        case InstallScreenQRCodeError.MaxRotations:
          isJustButton = true;
          contents = (
            <RetryButton onClick={retryGetQrCode}>
              {i18n('icu:Install__qr-max-rotations__retry')}
            </RetryButton>
          );
          break;
        default:
          throw missingCaseError(props.error);
      }
      break;
    case LoadingState.Loaded:
      contents = <QRCodeImage i18n={i18n} link={props.value} />;
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
          getQrCodeClassName('--load-failed'),
        isJustButton && getQrCodeClassName('--just-button')
      )}
    >
      {contents}
    </div>
  );
}

function QRCodeImage({
  i18n,
  link,
}: {
  i18n: LocalizerType;
  link: string;
}): JSX.Element {
  const [isCopying, setIsCopying] = useState(false);

  // Add a development-only feature to copy a QR code to the clipboard by double-clicking.
  // This can be used to quickly inspect the code, or to link this Desktop with an iOS
  // simulator primary, which has a debug-only option to paste the linking URL instead of
  // scanning it. (By the time you read this comment Android may have a similar feature.)
  const onDoubleClick = useCallback(() => {
    if (getEnvironment() === Environment.PackagedApp) {
      return;
    }

    drop(navigator.clipboard.writeText(link));
    setIsCopying(true);
  }, [link]);

  useEffect(() => {
    if (!isCopying) {
      return noop;
    }

    const timer = setTimeout(() => {
      setIsCopying(false);
    }, 250);

    return () => clearTimeout(timer);
  }, [isCopying]);

  return (
    <svg
      role="img"
      aria-label={i18n('icu:Install__scan-this-code')}
      className={classNames(
        getQrCodeClassName('__code'),
        isCopying && getQrCodeClassName('__code--copying')
      )}
      onDoubleClick={onDoubleClick}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <BrandedQRCode size={16} link={link} color="black" />
    </svg>
  );
}

function RetryButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}): JSX.Element {
  const onKeyDown = useCallback(
    (ev: React.KeyboardEvent<HTMLButtonElement>) => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        ev.stopPropagation();
        onClick();
      }
    },
    [onClick]
  );

  return (
    <button
      className={getQrCodeClassName('__link')}
      onClick={onClick}
      onKeyDown={onKeyDown}
      type="button"
    >
      {children}
    </button>
  );
}

function Paragraph(children: React.ReactNode): JSX.Element {
  return <p>{children}</p>;
}
