// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';
import { GlobalModalContainer } from '../../components/GlobalModalContainer';
import type { StateType } from '../reducer';
import { SmartProfileEditorModal } from './ProfileEditorModal';
import { SmartContactModal } from './ContactModal';
import { SmartSafetyNumberModal } from './SafetyNumberModal';

import { getIntl } from '../selectors/user';

function renderProfileEditor(): JSX.Element {
  return <SmartProfileEditorModal />;
}

function renderContactModal(): JSX.Element {
  return <SmartContactModal />;
}

const mapStateToProps = (state: StateType) => {
  const i18n = getIntl(state);

  return {
    ...state.globalModals,
    i18n,
    renderContactModal,
    renderProfileEditor,
    renderSafetyNumber: () => (
      <SmartSafetyNumberModal
        contactID={String(state.globalModals.safetyNumberModalContactId)}
      />
    ),
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartGlobalModalContainer = smart(GlobalModalContainer);
