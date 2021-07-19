// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';
import { GlobalModalContainer } from '../../components/GlobalModalContainer';
import { StateType } from '../reducer';
import { getIntl } from '../selectors/user';
import { SmartChatColorPicker } from './ChatColorPicker';
import { SmartProfileEditorModal } from './ProfileEditorModal';

// Workaround: A react component's required properties are filtering up through connect()
//   https://github.com/DefinitelyTyped/DefinitelyTyped/issues/31363
/* eslint-disable @typescript-eslint/no-explicit-any */
const FilteredSmartProfileEditorModal = SmartProfileEditorModal as any;
/* eslint-enable @typescript-eslint/no-explicit-any */

function renderChatColorPicker(): JSX.Element {
  return <SmartChatColorPicker />;
}

function renderProfileEditor(): JSX.Element {
  return <FilteredSmartProfileEditorModal />;
}

const mapStateToProps = (state: StateType) => {
  return {
    ...state.globalModals,
    i18n: getIntl(state),
    renderChatColorPicker,
    renderProfileEditor,
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartGlobalModalContainer = smart(GlobalModalContainer);
