use emscripten to convert c to javascript:
`emcc sc_reduce32.c -o sc_reduce32.js -s EXPORTED_FUNCTIONS="['_sc_reduce32']" -s WASM=0 -s ENVIRONMENT=node -s EXTRA_EXPORTED_RUNTIME_METHODS='["ccall"]'`