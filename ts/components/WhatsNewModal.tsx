// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import React from 'react';
import moment from 'moment';

import { Modal } from './Modal';
import { Intl } from './Intl';
import type { LocalizerType } from '../types/Util';

export type PropsType = {
  hideWhatsNewModal: () => unknown;
  i18n: LocalizerType;
};

type ReleaseNotesType = {
  date: Date;
  version: string;
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

export function WhatsNewModal({
  i18n,
  hideWhatsNewModal,
}: PropsType): JSX.Element {
  let contentNode: ReactNode;

  const releaseNotes: ReleaseNotesType = {
    date: new Date(window.getBuildCreation?.() || Date.now()),
    version: window.getVersion?.(),
    features: [
      <Intl i18n={i18n} id="icu:WhatsNew__v6.45--0" />,
      <Intl i18n={i18n} id="icu:WhatsNew__v6.45--1" />,
      <Intl i18n={i18n} id="icu:WhatsNew__v6.45--2" />,
      <Intl
        i18n={i18n}
        id="icu:WhatsNew__v6.45--3"
        components={{
          linkToGithub1: (
            <ExternalLink href="https://github.com/dasois">
              @dasois
            </ExternalLink>
          ),
          linkToGithub2: (
            <ExternalLink href="https://github.com/pelya">@pelya</ExternalLink>
          ),
        }}
      />,
    ],
  };

  if (releaseNotes.features.length === 1) {
    contentNode = <p>{releaseNotes.features[0]}</p>;
  } else {
    contentNode = (
      <ul>
        {releaseNotes.features.map(element => {
          return <li key={element.props.id}>{element}</li>;
        })}
      </ul>
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
