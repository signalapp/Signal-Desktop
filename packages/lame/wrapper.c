#include <stdlib.h>
#include "lame.h"

#define MAX_INPUT_SIZE 1024

static float in[MAX_INPUT_SIZE];

// MAX_INPUT_SIZE * 1.25 + 7200 (see lame.h)
static unsigned char out[8480];

lame_t wrapper_init(int q, int sample_rate, int bit_rate) {
  lame_t gf = lame_init();
  lame_set_in_samplerate(gf, sample_rate);
  lame_set_VBR(gf, vbr_mtrh);
  lame_set_VBR_q(gf, q);
  lame_set_VBR_max_bitrate_kbps(gf, bit_rate);
  lame_set_mode(gf, MONO);
  lame_set_num_channels(gf, 1);
  lame_init_params(gf);

  return gf;
}

int wrapper_get_max_input_size() {
  return MAX_INPUT_SIZE;
}

float* wrapper_get_in() {
  return in;
}

unsigned char* wrapper_get_out() {
  return out;
}

int wrapper_encode(lame_t gf, int size) {
  if (size > MAX_INPUT_SIZE) {
    return -1;
  }
  return lame_encode_buffer_ieee_float(
      gf, in, /* right channel */ NULL, size, out, sizeof(out));
}

int wrapper_flush(lame_t gf) {
  return lame_encode_flush(gf, out, sizeof(out));
}

int wrapper_get_lametag_frame(lame_t gf) {
  int size = lame_get_lametag_frame(gf, out, sizeof(out));
  if (size > sizeof(out)) {
    return -1;
  }
  return size;
}

void wrapper_close(lame_t gf) {
  lame_close(gf);
}
