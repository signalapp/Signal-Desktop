// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';
import { GlobalModalContainer } from '../../components/GlobalModalContainer';
import { StateType } from '../reducer';
import { SmartProfileEditorModal } from './ProfileEditorModal';
import { SmartContactModal } from './ContactModal';

const FilteredSmartProfileEditorModal = SmartProfileEditorModal;

function renderProfileEditor(): JSX.Element {
  return <FilteredSmartProfileEditorModal />;
}

function renderContactModal(): JSX.Element {
  return <SmartContactModal />;
}

const mapStateToProps = (state: StateType) => {
  return {
    ...state.globalModals,
    renderContactModal,
    renderProfileEditor,
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartGlobalModalContainer = smart(GlobalModalContainer);
