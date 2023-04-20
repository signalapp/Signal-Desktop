// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { useLoaderData, Outlet } from 'react-router-dom';

import { type LoadLocaleResult } from '../util/i18n';
import { I18n } from '../contexts/I18n';

export function Root(): JSX.Element {
  const { locale, messages } = useLoaderData() as LoadLocaleResult;

  if (messages.title && 'message' in messages.title) {
    document.title = messages.title.message ?? '';
  }

  return (
    <I18n messages={messages} locale={locale}>
      <Outlet />
    </I18n>
  );
}
