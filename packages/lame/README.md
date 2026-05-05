<!-- Copyright 2025 Signal Messenger, LLC -->
<!-- SPDX-License-Identifier: AGPL-3.0-only -->

# @signalapp/lame

Bindings for [LAME MP3 Encoder][0].

## Building

```sh
brew install emscripten
wget https://cytranet-dal.dl.sourceforge.net/project/lame/lame/3.100/lame-3.100.tar.gz
tar xzvf lame-3.100.tar.gz
cd lame-3.100
echo '{}' > package.json # Emscripten can't run in "type": "module" package
CFLAGS='-Oz -flto' emconfigure ./configure --disable-shared --disable-decoder \
  --disable-frontend --disable-gtktest \
  --disable-dependency-tracking --disable-analyzer-hooks --disable-cpml
emmake make clean
emmake make -j16
cd -
emcc -I lame-3.100/include -Oz -DNDEBUG -flto wrapper.c \
    ./lame-3.100/libmp3lame/.libs/libmp3lame.a -o wrapper.mjs \
    -sEXPORTED_FUNCTIONS=_wrapper_init,_wrapper_get_max_input_size,_wrapper_get_in,_wrapper_get_out,_wrapper_encode,_wrapper_flush,_wrapper_get_lametag_frame,_wrapper_close \
    -sEXPORTED_RUNTIME_METHODS=HEAPU8 -sDYNAMIC_EXECUTION=0 \
    -sENVIRONMENT=worklet -sWASM=0 -sWASM_ASYNC_COMPILATION=0
sed -I '' 's/^async //' wrapper.mjs
```

## License

Copyright 2025 Signal Messenger, LLC.

Licensed under the AGPLv3: http://www.gnu.org/licenses/agpl-3.0.html

[0]: https://lame.sourceforge.io/
