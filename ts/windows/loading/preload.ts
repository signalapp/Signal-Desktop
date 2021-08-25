// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcRenderer } from 'electron';
import * as url from 'url';
import * as i18n from '../../../js/modules/i18n';
import { strictAssert } from '../../util/assert';

const config = url.parse(window.location.toString(), true).query;

const { locale } = config;
strictAssert(
  typeof locale === 'string',
  'Expected to be configured with a string locale'
);

const localeMessages = ipcRenderer.sendSync('locale-data');

window.i18n = i18n.setup(locale, localeMessages);
