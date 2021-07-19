// Copyright 2018-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as protobuf from 'protobufjs/minimal';
import Long from 'long';

import { signalservice as SignalService } from './compiled';

protobuf.util.Long = Long;
protobuf.configure();

export { SignalService };
