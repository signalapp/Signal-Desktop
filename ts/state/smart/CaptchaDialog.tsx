// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { CaptchaDialog } from '../../components/CaptchaDialog';
import { getIntl } from '../selectors/user';
import { isChallengePending } from '../selectors/network';
import { getChallengeURL } from '../../challenge';
import * as log from '../../logging/log';

export type SmartCaptchaDialogProps = Readonly<{
  onSkip: () => void;
}>;

export const SmartCaptchaDialog = memo(function SmartCaptchaDialog({
  onSkip,
}: SmartCaptchaDialogProps) {
  const i18n = useSelector(getIntl);
  const isPending = useSelector(isChallengePending);
  const handleContinue = useCallback(() => {
    const url = getChallengeURL('chat');
    log.info(`CaptchaDialog: navigating to ${url}`);
    document.location.href = url;
  }, []);
  return (
    <CaptchaDialog
      i18n={i18n}
      isPending={isPending}
      onSkip={onSkip}
      onContinue={handleContinue}
    />
  );
});
