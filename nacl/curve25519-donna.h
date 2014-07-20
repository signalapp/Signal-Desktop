#ifndef CURVE25519_DONNA_H
#define CURVE25519_DONNA_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

int curve25519_donna(uint8_t *, const uint8_t *, const uint8_t *);

#ifdef __cplusplus
}
#endif

#endif
