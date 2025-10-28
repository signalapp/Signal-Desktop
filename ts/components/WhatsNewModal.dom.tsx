// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import React from 'react';
import moment from 'moment';

import { Modal } from './Modal.dom.js';
import { I18n } from './I18n.dom.js';
import type { LocalizerType } from '../types/Util.std.js';
import { tw } from '../axo/tw.dom.js';

export type PropsType = {
  hideWhatsNewModal: () => unknown;
  i18n: LocalizerType;
};

type ReleaseNotesType = {
  date: Date;
  version: string;
  header?: JSX.Element;
  features: Array<JSX.Element>;
};

// Exported so it doesn't get marked unused
export function ExternalLink(props: {
  href: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <a href={props.href} target="_blank" rel="noreferrer">
      {props.children}
    </a>
  );
}

function Elias6() {
  return <ExternalLink href="https://github.com/elias6">@elias6</ExternalLink>;
}

export function WhatsNewModal({
  i18n,
  hideWhatsNewModal,
}: PropsType): JSX.Element {
  let contentNode: ReactNode;

  const releaseNotes: ReleaseNotesType = {
    date: new Date(window.getBuildCreation?.() || Date.now()),
    version: window.getVersion?.(),
    features: [
      <I18n i18n={i18n} id="icu:WhatsNew__7.77-1" />,
      <I18n
        i18n={i18n}
        id="icu:WhatsNew__7.77-2"
        components={{
          elias6: Elias6,
        }}
      />,
    ],
  };

  if (releaseNotes.features.length === 1 && !releaseNotes.header) {
    contentNode = <p className={tw('mt-2')}>{releaseNotes.features[0]}</p>;
  } else {
    contentNode = (
      <>
        {releaseNotes.header ? <p>{releaseNotes.header}</p> : null}
        <ul className={tw('ms-4 mt-2 list-disc')}>
          {releaseNotes.features.map(element => {
            return (
              <li className={tw('mt-2')} key={element.props.id}>
                {element}
              </li>
            );
          })}
        </ul>
      </>
    );
  }

  return (
    <Modal
      modalName="WhatsNewModal"
      hasXButton
      i18n={i18n}
      onClose={hideWhatsNewModal}
      title={i18n('icu:WhatsNew__modal-title')}
    >
      <>
        <span>
          {moment(releaseNotes.date).format('LL')} &middot;{' '}
          {releaseNotes.version}
        </span>
        {contentNode}
      </>
    </Modal>
  );
}
