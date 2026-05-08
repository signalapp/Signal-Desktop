// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX } from 'react';
import type { LocalizerType } from '../types/Util.std.ts';
import { AxoConfirmDialog } from '../axo/AxoConfirmDialog.dom.tsx';

export function AddGroupMemberMaximumGroupSizeErrorDialog(props: {
  i18n: LocalizerType;
  onClose: () => void;
  maximumNumberOfContacts: number;
}): JSX.Element {
  const { i18n } = props;
  return (
    <AxoConfirmDialog.Root
      open
      onOpenChange={props.onClose}
      title={i18n('icu:chooseGroupMembers__maximum-group-size__title')}
      description={i18n('icu:chooseGroupMembers__maximum-group-size__body', {
        max: props.maximumNumberOfContacts,
      })}
    >
      <AxoConfirmDialog.Cancel>{i18n('icu:ok')}</AxoConfirmDialog.Cancel>
    </AxoConfirmDialog.Root>
  );
}

export function AddGroupMemberRecommendedMaximumGroupSizeErrorDialog(props: {
  i18n: LocalizerType;
  onClose: () => void;
  recommendedMaximumNumberOfContacts: number;
}): JSX.Element {
  const { i18n } = props;
  return (
    <AxoConfirmDialog.Root
      open
      onOpenChange={props.onClose}
      title={i18n(
        'icu:chooseGroupMembers__maximum-recommended-group-size__title'
      )}
      description={i18n(
        'icu:chooseGroupMembers__maximum-recommended-group-size__body',
        { max: props.recommendedMaximumNumberOfContacts }
      )}
    >
      <AxoConfirmDialog.Cancel>{i18n('icu:ok')}</AxoConfirmDialog.Cancel>
    </AxoConfirmDialog.Root>
  );
}
