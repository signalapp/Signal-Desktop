// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo, useState, useEffect, useCallback } from 'react';
import lodash from 'lodash';
import { useSelector } from 'react-redux';
import { SafetyNumberViewer } from '../../components/SafetyNumberViewer.dom.js';
import type { SafetyNumberProps } from '../../components/SafetyNumberChangeDialog.dom.js';
import { getContactSafetyNumberSelector } from '../selectors/safetyNumber.std.js';
import { getConversationSelector } from '../selectors/conversations.dom.js';
import { getIntl } from '../selectors/user.std.js';
import { getItems, getKeyTransparencyEnabled } from '../selectors/items.dom.js';
import { useSafetyNumberActions } from '../ducks/safetyNumber.preload.js';
import { keyTransparency } from '../../services/keyTransparency.preload.js';
import { isFeaturedEnabledSelector } from '../../util/isFeatureEnabled.dom.js';
import { drop } from '../../util/drop.std.js';
import type { KeyTransparencyStatusType } from '../../types/KeyTransparency.d.ts';

const { noop } = lodash;

export const SmartSafetyNumberViewer = memo(function SmartSafetyNumberViewer({
  contactID,
  onClose,
}: SafetyNumberProps) {
  const i18n = useSelector(getIntl);
  const contactSafetyNumberSelector = useSelector(
    getContactSafetyNumberSelector
  );
  const safetyNumberContact = contactSafetyNumberSelector(contactID);
  const conversationSelector = useSelector(getConversationSelector);
  const hasKeyTransparencyEnabled = useSelector(getKeyTransparencyEnabled);
  const contact = conversationSelector(contactID);
  const items = useSelector(getItems);

  const version = window.SignalContext.getVersion();

  const isKeyTransparencyEnabled =
    hasKeyTransparencyEnabled &&
    isFeaturedEnabledSelector({
      betaKey: 'desktop.keyTransparency.beta',
      prodKey: 'desktop.keyTransparency.prod',
      currentVersion: version,
      remoteConfig: items.remoteConfig,
    });

  const isKeyTransparencyAvailable = contact.e164 != null;

  const [keyTransparencyStatus, setKeyTransparencyStatus] =
    useState<KeyTransparencyStatusType>(
      isKeyTransparencyAvailable ? 'idle' : 'unavailable'
    );

  const { generateSafetyNumber, toggleVerified } = useSafetyNumberActions();

  useEffect(() => {
    generateSafetyNumber(contact);
  }, [contact, generateSafetyNumber]);

  useEffect(() => {
    if (keyTransparencyStatus !== 'running') {
      return noop;
    }

    const abortController = new AbortController();

    drop(
      (async () => {
        try {
          await keyTransparency.check(contactID, abortController.signal);
          setKeyTransparencyStatus('ok');
        } catch (error) {
          if (abortController.signal.aborted) {
            return;
          }
          setKeyTransparencyStatus('fail');
        }
      })()
    );

    return () => {
      abortController.abort();
    };
  }, [contactID, keyTransparencyStatus]);

  const checkKeyTransparency = useCallback(async () => {
    if (!isKeyTransparencyEnabled || !isKeyTransparencyAvailable) {
      return;
    }
    setKeyTransparencyStatus('running');
  }, [isKeyTransparencyEnabled, isKeyTransparencyAvailable]);

  return (
    <SafetyNumberViewer
      contact={contact}
      i18n={i18n}
      onClose={onClose}
      isKeyTransparencyEnabled={isKeyTransparencyEnabled}
      keyTransparencyStatus={keyTransparencyStatus}
      safetyNumber={safetyNumberContact?.safetyNumber ?? null}
      toggleVerified={toggleVerified}
      checkKeyTransparency={checkKeyTransparency}
      verificationDisabled={safetyNumberContact?.verificationDisabled ?? null}
    />
  );
});
