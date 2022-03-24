// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as protobuf from 'protobufjs/minimal';
import Long from 'long';

protobuf.util.Long = Long;
protobuf.configure();

export default protobuf;
