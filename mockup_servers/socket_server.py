#!/usr/bin/env python

# WS server example
import time
import asyncio
import websockets

async def hello(websocket, path):
    print(f"connection done {path}")

    keep_alive_bytes =  bytes([8, 1, 18, 28, 10, 3, 80, 85, 84, 18, 19, 47, 97, 112, 105, 47, 118, 49, 47, 113, 117, 101, 117, 101, 47, 101, 109, 112, 116, 121, 32, 99])
    # created by executing in js:
    # protomessage = new textsecure.protobuf.WebSocketMessage({type: textsecure.protobuf.WebSocketMessage.Type.REQUEST, request: {id:99, verb:'PUT', path:'/api/v1/queue/empty', body:null }})
    # new Uint8Array(protomessage.encode().toArrayBuffer())
    message =           bytes([8, 1, 18, 53, 10, 3, 80, 85, 84, 18, 15, 47, 97, 112, 105, 47, 118, 49, 47, 109, 101, 115, 115, 97, 103, 101, 26, 27, 8, 1, 18, 15, 109, 121, 115, 111, 117, 114, 99, 101, 97, 100, 100, 114, 101, 115, 115, 56, 1, 40, 166, 198, 208, 221, 5, 32, 99])
    # created by executing in js:
    # env = textsecure.protobuf.Envelope.encode({ type: textsecure.protobuf.Envelope.Type.CIPHERTEXT, source: "mysourceaddress", sourceDevice: 1, content: null, timestamp: Math.round((new Date()).getTime() / 1000) })
    # protomessage = new textsecure.protobuf.WebSocketMessage({type: textsecure.protobuf.WebSocketMessage.Type.REQUEST, request: {id:99, verb:'PUT', path:'/api/v1/message', body:env }})
    # new Uint8Array(protomessage.encode().toArrayBuffer())
    signature = websocket.request_headers.get('signature')

    if not signature:
        print("no signature provided")

    my_bytes = message
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