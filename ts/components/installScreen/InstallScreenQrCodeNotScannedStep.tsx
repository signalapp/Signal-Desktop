// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactElement, ReactNode } from 'react';
import React, { useCallback } from 'react';
import classNames from 'classnames';

import type { LocalizerType } from '../../types/Util';
import { missingCaseError } from '../../util/missingCaseError';
import type { Loadable } from '../../util/loadable';
import { LoadingState } from '../../util/loadable';

import { I18n } from '../I18n';
import { Spinner } from '../Spinner';
import { QrCode } from '../QrCode';
import { TitlebarDragArea } from '../TitlebarDragArea';
import { InstallScreenSignalLogo } from './InstallScreenSignalLogo';
import { InstallScreenUpdateDialog } from './InstallScreenUpdateDialog';
import { getClassNamesFor } from '../../util/getClassNamesFor';
import type { UpdatesStateType } from '../../state/ducks/updates';
import { Environment, getEnvironment } from '../../environment';

export enum LoadError {
  Timeout = 'Timeout',
  Unknown = 'Unknown',
  NetworkIssue = 'NetworkIssue',
}

// We can't always use destructuring assignment because of the complexity of this props
//   type.

export type PropsType = Readonly<{
  i18n: LocalizerType;
  provisioningUrl: Loadable<string, LoadError>;
  hasExpired?: boolean;
  updates: UpdatesStateType;
  currentVersion: string;
  OS: string;
  retryGetQrCode: () => void;
  startUpdate: () => void;
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
  OS,
  provisioningUrl,
  retryGetQrCode,
  startUpdate,
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
          startUpdate={startUpdate}
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
                  plusButton: (
                    <div
                      className="module-InstallScreenQrCodeNotScannedStep__android-plus"
                      aria-label="+"
                    />
                  ),
                  linkNewDevice: <strong>{i18n('icu:linkNewDevice')}</strong>,
                }}
              />
            </li>
          </ol>
          {getEnvironment() !== Environment.Staging ? (
            <a target="_blank" rel="noreferrer" href={SUPPORT_PAGE}>
              {i18n('icu:Install__support-link')}
            </a>
          ) : (
            'THIS IS A STAGING DESKTOP'
          )}
        </div>
      </div>
    </div>
  );
}

function InstallScreenQrCode(
  props: Loadable<string, LoadError> & {
    i18n: LocalizerType;
    retryGetQrCode: () => void;
  }
): ReactElement {
  const { i18n } = props;

  let contents: ReactNode;
  switch (props.loadingState) {
    case LoadingState.Loading:
      contents = <Spinner size="24px" svgSize="small" />;
      break;
    case LoadingState.LoadFailed:
      switch (props.error) {
        case LoadError.Timeout:
          contents = (
            <>
              <span
                className={classNames(getQrCodeClassName('__error-message'))}
              >
                {i18n('icu:Install__qr-failed-load__error--timeout')}
              </span>
              <RetryButton i18n={i18n} onClick={props.retryGetQrCode} />
            </>
          );
          break;
        case LoadError.Unknown:
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
              <RetryButton i18n={i18n} onClick={props.retryGetQrCode} />
            </>
          );
          break;
        case LoadError.NetworkIssue:
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
        default:
          throw missingCaseError(props.error);
      }
      break;
    case LoadingState.Loaded:
      contents = (
        <QrCode
          alt={i18n('icu:Install__scan-this-code')}
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

function RetryButton({
  i18n,
  onClick,
}: {
  i18n: LocalizerType;
  onClick: () => void;
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
      {i18n('icu:Install__qr-failed-load__retry')}
    </button>
  );
}

function Paragraph(children: React.ReactNode): JSX.Element {
  return <p>{children}</p>;
}
