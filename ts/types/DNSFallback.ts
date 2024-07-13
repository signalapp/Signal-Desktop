// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import z from 'zod';

export const DNSFallbackSchema = z.array(
  z.object({
    domain: z.string(),
    endpoints: z.array(
      z.object({
        family: z.enum(['ipv4', 'ipv6']),
        address: z.string(),
      })
    ),
  })
);

export type DNSFallbackType = z.infer<typeof DNSFallbackSchema>;
