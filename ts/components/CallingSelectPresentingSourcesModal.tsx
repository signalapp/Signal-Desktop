// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState } from 'react';
import classNames from 'classnames';
import { groupBy } from 'lodash';
import { Button, ButtonVariant } from './Button';
import type { LocalizerType } from '../types/Util';
import { Modal } from './Modal';
import type { PresentedSource, PresentableSource } from '../types/Calling';
import { Theme } from '../util/theme';

export type PropsType = {
  i18n: LocalizerType;
  presentingSourcesAvailable: Array<PresentableSource>;
  setPresenting: (_?: PresentedSource) => void;
};

const Source = ({
  onSourceClick,
  source,
  sourceToPresent,
}: {
  onSourceClick: (source: PresentedSource) => void;
  source: PresentableSource;
  sourceToPresent?: PresentedSource;
}): JSX.Element => {
  return (
    <button
      className={classNames({
        'module-CallingSelectPresentingSourcesModal__source': true,
        'module-CallingSelectPresentingSourcesModal__source--selected':
          sourceToPresent?.id === source.id,
      })}
      key={source.id}
      onClick={() => {
        onSourceClick({
          id: source.id,
          name: source.name,
        });
      }}
      type="button"
    >
      <img
        alt={source.name}
        className="module-CallingSelectPresentingSourcesModal__name--screenshot"
        src={source.thumbnail}
      />
      <div className="module-CallingSelectPresentingSourcesModal__name--container">
        {source.appIcon ? (
          <img
            alt={source.name}
            className="module-CallingSelectPresentingSourcesModal__name--icon"
            height={16}
            src={source.appIcon}
            width={16}
          />
        ) : null}
        <span className="module-CallingSelectPresentingSourcesModal__name--text">
          {source.name}
        </span>
      </div>
    </button>
  );
};

export const CallingSelectPresentingSourcesModal = ({
  i18n,
  presentingSourcesAvailable,
  setPresenting,
}: PropsType): JSX.Element | null => {
  const [sourceToPresent, setSourceToPresent] = useState<
    PresentedSource | undefined
  >(undefined);

  if (!presentingSourcesAvailable.length) {
    throw new Error('No sources available for presenting');
  }

  const sources = groupBy(
    presentingSourcesAvailable,
    source => source.isScreen
  );

  return (
    <Modal
      hasXButton
      i18n={i18n}
      moduleClassName="module-CallingSelectPresentingSourcesModal"
      onClose={() => {
        setPresenting();
      }}
      theme={Theme.Dark}
      title={i18n('calling__SelectPresentingSourcesModal--title')}
    >
      <div className="module-CallingSelectPresentingSourcesModal__title">
        {i18n('calling__SelectPresentingSourcesModal--entireScreen')}
      </div>
      <div className="module-CallingSelectPresentingSourcesModal__sources">
        {(sources.true ?? []).map(source => (
          <Source
            key={source.id}
            onSourceClick={selectedSource => setSourceToPresent(selectedSource)}
            source={source}
            sourceToPresent={sourceToPresent}
          />
        ))}
      </div>
      <div className="module-CallingSelectPresentingSourcesModal__title">
        {i18n('calling__SelectPresentingSourcesModal--window')}
      </div>
      <div className="module-CallingSelectPresentingSourcesModal__sources">
        {(sources.false ?? []).map(source => (
          <Source
            key={source.id}
            onSourceClick={selectedSource => setSourceToPresent(selectedSource)}
            source={source}
            sourceToPresent={sourceToPresent}
          />
        ))}
      </div>
      <Modal.ButtonFooter moduleClassName="module-CallingSelectPresentingSourcesModal">
        <Button
          onClick={() => setPresenting()}
          variant={ButtonVariant.Secondary}
        >
          {i18n('cancel')}
        </Button>
        <Button
          disabled={!sourceToPresent}
          onClick={() => setPresenting(sourceToPresent)}
        >
          {i18n('calling__SelectPresentingSourcesModal--confirm')}
        </Button>
      </Modal.ButtonFooter>
    </Modal>
  );
};
