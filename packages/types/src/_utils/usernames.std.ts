// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { BigUint64 } from '../index.std.ts';
import { Result } from '../Result.std.ts';
import type { Username } from '../service/Username.std.ts';
import type { UsernameDiscriminator } from '../service/UsernameDiscriminator.std.ts';
import type { UsernameNickname } from '../service/UsernameNickname.std.ts';
import { safeParseBigInt } from './numbers.std.ts';

const USERNAME_NICKNAME_START = /^[a-zA-Z_]/;
const USERNAME_NICKNAME_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]+$/;
const USERNAME_DISCRIMINATOR_DIGITS = /^[0-9]+$/;

/** @internal */
export function parseUsernameNickname(input: string): Result<UsernameNickname> {
  if (input.length === 0) {
    return Result.err('must not be empty');
  }

  if (!USERNAME_NICKNAME_START.test(input)) {
    return Result.err('must start with letter or underscore');
  }

  if (!USERNAME_NICKNAME_PATTERN.test(input)) {
    return Result.err('must only contain letters, numbers, or underscores');
  }

  return Result.ok(input as UsernameNickname);
}

/** @internal */
export function parseUsernameDiscriminator(
  input: string
): Result<UsernameDiscriminator> {
  // ""
  if (input.length === 0) {
    return Result.err('must not be empty');
  }

  // "-1", "+1", "a", etc
  if (!USERNAME_DISCRIMINATOR_DIGITS.test(input)) {
    return Result.err('must only have 0-9 digits');
  }

  // "0", "1"..."9"
  if (input.length === 1) {
    return Result.err('cannot be single digit');
  }

  const parsed = safeParseBigInt(input);
  if (parsed == null) {
    return Result.err('invalid bigint');
  }

  // "0", "00", "000", etc
  if (parsed === 0n) {
    return Result.err('cannot be zero');
  }

  // "18446744073709551616"
  if (parsed > BigUint64.MAX) {
    return Result.err('too large');
  }

  // "01"..."09", "10"..."99"
  if (input.length === 2) {
    return Result.ok(input as UsernameDiscriminator);
  }

  // "001"..."099", "0001"..."0999", etc
  if (input.startsWith('0')) {
    return Result.err('cannot have leading zeroes');
  }

  return Result.ok(input as UsernameDiscriminator);
}

/** @internal */
export function parseUsername(input: string): Result<Username.Params> {
  const parts = input.split('.');
  if (parts.length !== 2) {
    return Result.err('must have format "<nickname>.<discriminator>"');
  }

  const [nicknamePart, discriminatorPart] = parts;

  if (nicknamePart == null) {
    return Result.err('missing nickname');
  }
  if (discriminatorPart == null) {
    return Result.err('missing discriminator');
  }

  const nicknameResult = parseUsernameNickname(nicknamePart);
  if (!nicknameResult.ok) {
    return Result.err(nicknameResult.error);
  }

  const discriminatorResult = parseUsernameDiscriminator(input);
  if (!discriminatorResult.ok) {
    return Result.err(discriminatorResult.error);
  }

  return Result.ok({
    nickname: nicknameResult.value,
    discriminator: discriminatorResult.value,
  });
}

/** @internal */
export function joinUsernameParams(input: Username.Params): Username {
  return `${input.nickname}.${input.discriminator}` as Username;
}
