// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import ReactDOM from 'react-dom';

import { PermissionsPopup } from '../../components/PermissionsPopup';
import { i18n } from '../sandboxedInit';
import { strictAssert } from '../../util/assert';
import { FunDefaultEnglishEmojiLocalizationProvider } from '../../components/fun/FunEmojiLocalizationProvider';

const { PermissionsWindowProps } = window.Signal;

strictAssert(PermissionsWindowProps, 'window values not provided');

const { forCalling, forCamera } = PermissionsWindowProps;

let message;
if (forCalling) {
  if (forCamera) {
    message = i18n('icu:videoCallingPermissionNeeded');
  } else {
    message = i18n('icu:audioCallingPermissionNeeded');
  }
} else {
  message = i18n('icu:audioPermissionNeeded');
}

ReactDOM.render(
  <FunDefaultEnglishEmojiLocalizationProvider>
    <PermissionsPopup
      i18n={i18n}
      message={message}
      onAccept={PermissionsWindowProps.onAccept}
      onClose={PermissionsWindowProps.onClose}
    />
  </FunDefaultEnglishEmojiLocalizationProvider>,
  document.getElementById('app')
);
