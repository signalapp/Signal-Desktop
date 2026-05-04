#include <stdlib.h>
#include "lame.h"

#define NUM_SAMPLES 128

static lame_t gf = NULL;

static float in[NUM_SAMPLES];

// NUM_SAMPLES * 1.25 + 7200 (see lame.h)
static unsigned char out[7360];

void wrapper_init(int q, int sample_rate, int bit_rate) {
  gf = lame_init();
  lame_set_in_samplerate(gf, sample_rate);
  lame_set_VBR(gf, vbr_mtrh);
  lame_set_VBR_q(gf, q);
  lame_set_VBR_max_bitrate_kbps(gf, bit_rate);
  lame_set_mode(gf, MONO);
  lame_set_num_channels(gf, 1);
  lame_init_params(gf);
}

int wrapper_get_num_samples() {
  return NUM_SAMPLES;
}

float* wrapper_get_in() {
  return in;
}

unsigned char* wrapper_get_out() {
  return out;
}

int wrapper_encode() {
  return lame_encode_buffer_ieee_float(
      gf, in, /* right channel */ NULL, NUM_SAMPLES, out, sizeof(out));
}

int wrapper_flush() {
  return lame_encode_flush(gf, out, sizeof(out));
}

int wrapper_get_lametag_frame() {
  return lame_get_lametag_frame(gf, out, sizeof(out));
}

void wrapper_close() {
  lame_close(gf);
  gf = NULL;
}
