// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';
import { GlobalModalContainer } from '../../components/GlobalModalContainer';
import type { StateType } from '../reducer';
import { SmartContactModal } from './ContactModal';
import { SmartForwardMessageModal } from './ForwardMessageModal';
import { SmartProfileEditorModal } from './ProfileEditorModal';
import { SmartSafetyNumberModal } from './SafetyNumberModal';
import { SmartStoriesSettingsModal } from './StoriesSettingsModal';

import { getIntl } from '../selectors/user';

function renderProfileEditor(): JSX.Element {
  return <SmartProfileEditorModal />;
}

function renderContactModal(): JSX.Element {
  return <SmartContactModal />;
}

function renderForwardMessageModal(): JSX.Element {
  return <SmartForwardMessageModal />;
}

function renderStoriesSettings(): JSX.Element {
  return <SmartStoriesSettingsModal />;
}

const mapStateToProps = (state: StateType) => {
  const i18n = getIntl(state);

  return {
    ...state.globalModals,
    i18n,
    renderContactModal,
    renderForwardMessageModal,
    renderProfileEditor,
    renderStoriesSettings,
    renderSafetyNumber: () => (
      <SmartSafetyNumberModal
        contactID={String(state.globalModals.safetyNumberModalContactId)}
      />
    ),
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartGlobalModalContainer = smart(GlobalModalContainer);
