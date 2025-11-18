// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { _isFeatureEnabledInner } from '../../util/isFeatureEnabled.dom.js';

const isTestEnvironment = () => false;

describe('isFeatureEnabled', () => {
  it('returns false if nothing triggers', async () => {
    assert.isFalse(
      _isFeatureEnabledInner({
        betaValue: 'v2.0.0-beta.1',
        currentVersion: 'v1.0.0',
        isInternalUser: false,
        isTestEnvironment,
        prodValue: 'v1.1.0',
      })
    );
  });
  it('returns false if current version is invalid semver', async () => {
    assert.isFalse(
      _isFeatureEnabledInner({
        betaValue: 'v2.0.0-beta.1',
        currentVersion: 'broken',
        isInternalUser: false,
        isTestEnvironment,
        prodValue: 'v1.1.0',
      })
    );
  });
  it('returns true if internal', async () => {
    assert.isTrue(
      _isFeatureEnabledInner({
        betaValue: 'v2.0.0-beta.1',
        currentVersion: 'v1.1.0',
        isInternalUser: true,
        isTestEnvironment,
        prodValue: 'v1.1.0',
      })
    );
  });
  it('returns true if isAlpha', async () => {
    assert.isTrue(
      _isFeatureEnabledInner({
        betaValue: 'v2.0.0-beta.1',
        currentVersion: 'v1.0.0-alpha.1',
        isInternalUser: false,
        isTestEnvironment,
        prodValue: 'v1.1.0',
      })
    );
  });
  it('returns true if isStaging', async () => {
    assert.isTrue(
      _isFeatureEnabledInner({
        betaValue: 'v2.0.0-beta.1',
        currentVersion: 'v1.0.0-staging.1',
        isInternalUser: false,
        isTestEnvironment,
        prodValue: 'v1.1.0',
      })
    );
  });
  it('returns true if isTestEnvironment', async () => {
    assert.isTrue(
      _isFeatureEnabledInner({
        betaValue: 'v2.0.0-beta.1',
        currentVersion: 'v1.0.0',
        isInternalUser: false,
        isTestEnvironment: () => true,
        prodValue: 'v1.1.0',
      })
    );
  });
  it('returns true if beta and beta version is greater', async () => {
    assert.isTrue(
      _isFeatureEnabledInner({
        betaValue: 'v2.0.0-beta.1',
        currentVersion: 'v2.0.0-beta.2',
        isInternalUser: false,
        isTestEnvironment,
        prodValue: 'v1.1.0',
      })
    );
  });
  it('returns true if beta and beta version is equal', async () => {
    assert.isTrue(
      _isFeatureEnabledInner({
        betaValue: 'v2.0.0-beta.1',
        currentVersion: 'v2.0.0-beta.1',
        isInternalUser: false,
        isTestEnvironment,
        prodValue: 'v1.1.0',
      })
    );
  });
  it('returns false if beta and beta version is lesser', async () => {
    assert.isFalse(
      _isFeatureEnabledInner({
        betaValue: 'v2.0.0-beta.1',
        currentVersion: 'v1.0.0-beta.1',
        isInternalUser: false,
        isTestEnvironment,
        prodValue: 'v1.1.0',
      })
    );
  });
  it('returns false if beta and no beta value', async () => {
    assert.isFalse(
      _isFeatureEnabledInner({
        betaValue: undefined,
        currentVersion: 'v1.0.0-beta.1',
        isInternalUser: false,
        isTestEnvironment,
        prodValue: 'v1.1.0',
      })
    );
  });
  it('returns false if beta and beta value is not valid semver', async () => {
    assert.isFalse(
      _isFeatureEnabledInner({
        betaValue: 'broken',
        currentVersion: 'v1.0.0-beta.1',
        isInternalUser: false,
        isTestEnvironment,
        prodValue: 'v1.1.0',
      })
    );
  });

  it('returns true if prod and prod version is greater', async () => {
    assert.isTrue(
      _isFeatureEnabledInner({
        betaValue: 'v2.0.0-beta.1',
        currentVersion: 'v2.0.0',
        isInternalUser: false,
        isTestEnvironment,
        prodValue: 'v1.1.0',
      })
    );
  });
  it('returns true if prod and prod version is equal', async () => {
    assert.isTrue(
      _isFeatureEnabledInner({
        betaValue: 'v2.0.0-beta.1',
        currentVersion: 'v1.1.0',
        isInternalUser: false,
        isTestEnvironment,
        prodValue: 'v1.1.0',
      })
    );
  });
  it('returns false if prod and prod version is lesser', async () => {
    assert.isFalse(
      _isFeatureEnabledInner({
        betaValue: 'v2.0.0-beta.1',
        currentVersion: 'v1.0.0',
        isInternalUser: false,
        isTestEnvironment,
        prodValue: 'v1.1.0',
      })
    );
  });
  it('returns false if prod and no prod value', async () => {
    assert.isFalse(
      _isFeatureEnabledInner({
        betaValue: 'v2.0.0-beta.1',
        currentVersion: 'v1.0.0-beta.1',
        isInternalUser: false,
        isTestEnvironment,
        prodValue: undefined,
      })
    );
  });
  it('returns false if prod and prod value is not valid semver', async () => {
    assert.isFalse(
      _isFeatureEnabledInner({
        betaValue: 'v2.0.0-beta.1',
        currentVersion: 'v1.0.0-beta.1',
        isInternalUser: false,
        isTestEnvironment,
        prodValue: 'broken',
      })
    );
  });
});
