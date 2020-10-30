// Copyright 2018-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import libphonenumber from 'google-libphonenumber';

const instance = libphonenumber.PhoneNumberUtil.getInstance();
const { PhoneNumberFormat } = libphonenumber;

export { instance, PhoneNumberFormat };
