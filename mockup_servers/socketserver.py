#!/usr/bin/env python

# WS server example
import time
import asyncio
import websockets

async def hello(websocket, path):
    print(f"connection done {path}")

    # created by executing in js:
    # protomessage = new textsecure.protobuf.WebSocketMessage({type: textsecure.protobuf.WebSocketMessage.Type.REQUEST, request: {id:99, verb:'PUT', path:'/api/v1/queue/empty', body:null }})
    # new Uint8Array(encoded.encode().toArrayBuffer())

    signature = websocket.request_headers.get('signature')

    if not signature:
        print("no signature provided")

    keep_alive_bytes = bytes([8, 1, 18, 28, 10, 3, 80, 85, 84, 18, 19, 47, 97, 112, 105, 47, 118, 49, 47, 113, 117, 101, 117, 101, 47, 101, 109, 112, 116, 121, 32, 99])
    my_bytes = keep_alive_bytes
    counter = 0
    while(True):
        print("sending keepalive")
        await websocket.send(my_bytes)
        response = await websocket.recv()
        print(f"response: {response}")
        time.sleep(30)
        counter = counter + 1

start_server = websockets.serve(hello, 'localhost', 80)

asyncio.get_event_loop().run_until_complete(start_server)
asyncio.get_event_loop().run_forever()