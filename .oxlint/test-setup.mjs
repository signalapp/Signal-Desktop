// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import * as mocha from 'mocha';
import { RuleTester } from '@typescript-eslint/rule-tester';

RuleTester.afterAll = mocha.after;
