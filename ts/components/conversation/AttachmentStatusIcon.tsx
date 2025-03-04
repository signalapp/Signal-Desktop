// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useRef, useState } from 'react';
import classNames from 'classnames';

import { ProgressCircle } from '../ProgressCircle';
import { usePrevious } from '../../hooks/usePrevious';

import type { AttachmentForUIType } from '../../types/Attachment';
import { roundFractionForProgressBar } from '../../util/numbers';

const TRANSITION_DELAY = 200;

export type PropsType = {
  attachment: AttachmentForUIType | undefined;
  isAttachmentNotAvailable: boolean;
  isIncoming: boolean;
  renderAttachmentDownloaded: () => JSX.Element;
};

enum IconState {
  NeedsDownload = 'NeedsDownload',
  Downloading = 'Downloading',
  Downloaded = 'Downloaded',
}

export function AttachmentStatusIcon({
  attachment,
  isAttachmentNotAvailable,
  isIncoming,
  renderAttachmentDownloaded,
}: PropsType): JSX.Element | null {
  const [isWaiting, setIsWaiting] = useState<boolean>(false);

  let state: IconState = IconState.Downloaded;
  if (attachment && isAttachmentNotAvailable) {
    state = IconState.Downloaded;
  } else if (attachment && !attachment.path && !attachment.pending) {
    state = IconState.NeedsDownload;
  } else if (attachment && !attachment.path && attachment.pending) {
    state = IconState.Downloading;
  }

  const timerRef = useRef<NodeJS.Timeout | undefined>();
  const previousState = usePrevious(state, state);

  // We need useLayoutEffect; otherwise we might get a flash of the wrong visual state.
  // We do calculations here which change the UI!
  React.useLayoutEffect(() => {
    if (state === previousState) {
      return;
    }

    if (
      previousState === IconState.NeedsDownload &&
      state === IconState.Downloading
    ) {
      setIsWaiting(true);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        timerRef.current = undefined;
        setIsWaiting(false);
      }, TRANSITION_DELAY);
    } else if (
      previousState === IconState.Downloading &&
      state === IconState.Downloaded
    ) {
      setIsWaiting(true);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        timerRef.current = undefined;
        setIsWaiting(false);
      }, TRANSITION_DELAY);
    }
  }, [previousState, state]);

  if (attachment && state === IconState.NeedsDownload) {
    return (
      <div className="AttachmentStatusIcon__container">
        <div
          className={classNames(
            'AttachmentStatusIcon__circle-icon-container',
            isIncoming
              ? 'AttachmentStatusIcon__circle-icon-container--incoming'
              : undefined
          )}
        >
          <div
            className={classNames(
              'AttachmentStatusIcon__circle-icon',
              isIncoming
                ? 'AttachmentStatusIcon__circle-icon--incoming'
                : undefined,
              'AttachmentStatusIcon__circle-icon--arrow-down'
            )}
          />
        </div>
      </div>
    );
  }

  if (
    attachment &&
    (state === IconState.Downloading ||
      (state === IconState.Downloaded && isWaiting))
  ) {
    const { size, totalDownloaded } = attachment;
    let downloadFraction =
      size && totalDownloaded
        ? roundFractionForProgressBar(totalDownloaded / size)
        : undefined;
    if (state === IconState.Downloading && isWaiting) {
      downloadFraction = undefined;
    }
    if (state === IconState.Downloaded && isWaiting) {
      downloadFraction = 1;
    }

    return (
      <div className="AttachmentStatusIcon__container">
        <div
          className={classNames(
            'AttachmentStatusIcon__circle-icon-container',
            isIncoming
              ? 'AttachmentStatusIcon__circle-icon-container--incoming'
              : undefined
          )}
        >
          {downloadFraction ? (
            <div
              className={classNames(
                'AttachmentStatusIcon__progress-container',
                isIncoming
                  ? 'AttachmentStatusIcon__progress-container--incoming'
                  : undefined
              )}
            >
              <ProgressCircle
                fractionComplete={downloadFraction}
                width={36}
                strokeWidth={2}
              />
            </div>
          ) : undefined}
          <div
            className={classNames(
              'AttachmentStatusIcon__circle-icon',
              isIncoming
                ? 'AttachmentStatusIcon__circle-icon--incoming'
                : undefined,
              'AttachmentStatusIcon__circle-icon--x'
            )}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="AttachmentStatusIcon__container">
      {renderAttachmentDownloaded()}
    </div>
  );
}
