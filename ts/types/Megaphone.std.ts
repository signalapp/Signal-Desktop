// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export enum MegaphoneType {
  UsernameOnboarding = 'UsernameOnboarding',
}

export type UsernameOnboardingMegaphoneType = {
  type: MegaphoneType.UsernameOnboarding;
};

export type UsernameOnboardingActionableMegaphoneType =
  UsernameOnboardingMegaphoneType & {
    onLearnMore: () => void;
    onDismiss: () => void;
  };

export type AnyMegaphone = UsernameOnboardingMegaphoneType;

export type AnyActionableMegaphone = UsernameOnboardingActionableMegaphoneType;
