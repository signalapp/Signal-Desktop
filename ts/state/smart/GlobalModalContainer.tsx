// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { connect } from 'react-redux';
import type { StateType } from '../reducer';
import { GlobalModalContainer } from '../../components/GlobalModalContainer';
import { SmartContactModal } from './ContactModal';
import { SmartForwardMessageModal } from './ForwardMessageModal';
import { SmartProfileEditorModal } from './ProfileEditorModal';
import { SmartSafetyNumberModal } from './SafetyNumberModal';
import { SmartSendAnywayDialog } from './SendAnywayDialog';
import { SmartStoriesSettingsModal } from './StoriesSettingsModal';
import { getConversationsStoppingSend } from '../selectors/conversations';
import { mapDispatchToProps } from '../actions';

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

function renderSendAnywayDialog(): JSX.Element {
  return <SmartSendAnywayDialog />;
}

const mapStateToProps = (state: StateType) => {
  const i18n = getIntl(state);

  return {
    ...state.globalModals,
    hasSafetyNumberChangeModal: getConversationsStoppingSend(state).length > 0,
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
    renderSendAnywayDialog,
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartGlobalModalContainer = smart(GlobalModalContainer);
