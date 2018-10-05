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
    message =           bytes(
        #[8, 1, 18, 70, 10, 3, 80, 85, 84, 18, 15, 47, 97, 112, 105, 47, 118, 49, 47, 109, 101, 115, 115, 97, 103, 101, 26, 44, 8, 1, 18, 15, 109, 121, 115, 111, 117, 114, 99, 101, 97, 100, 100, 114, 101, 115, 115, 56, 1, 40, 184, 151, 213, 221, 5, 66, 15, 10, 13, 10, 11, 104, 101, 108, 108, 111, 32, 119, 111, 114, 108, 100, 32, 99]
        [
            8,1,18,117,10,3,80,85,84,18,15,47,97,112,105,47,118,49,47,109,101,115,115,97,103,101,26,91,8,1,18,66,48,53,55,51,57,102,51,54,55,50,100,55,57,52,51,56,101,57,53,53,97,55,99,99,55,55,56,52,100,98,97,53,101,97,52,98,102,56,50,55,52,54,54,53,55,55,51,99,97,102,51,101,97,98,55,48,97,50,98,57,100,98,102,101,50,99,56,1,40,0,66,15,10,13,10,11,104,101,108,108,111,32,119,111,114,108,100,32,99
        ])
    # created by executing in js:
    # dataMessage = new textsecure.protobuf.DataMessage({body: "hello world", attachments:[], contact:[]})
    # content = new textsecure.protobuf.Content({ dataMessage })
    # contentBytes = content.encode().toArrayBuffer()
    # - skipped encryption -
    # messageEnvelope = new textsecure.protobuf.Envelope({ type:1, source:"0596395a7f0a6ca6379d49c5a584103a49274973cf57ab1b6301330cc33ea6f94c", sourceDevice:1, timestamp:0, content: contentBytes})
    # requestMessage = new textsecure.protobuf.WebSocketRequestMessage({id:99, verb:'PUT', path:'/api/v1/message', body: messageEnvelope.encode().toArrayBuffer()})
    # protomessage = new textsecure.protobuf.WebSocketMessage({type: textsecure.protobuf.WebSocketMessage.Type.REQUEST, request: requestMessage})
    # bytes = new Uint8Array(protomessage.encode().toArrayBuffer())
    # bytes.toString()
    signature = websocket.request_headers.get('signature')

    if not signature:
        print("no signature provided")

    counter = 0
    while(True):
        print("sending keepalive")
        await websocket.send(keep_alive_bytes)
        response = await websocket.recv()
        print(f"response: {response}")
        if counter % 5 == 0:
            await websocket.send(message)
            response = await websocket.recv()
            print(f"response: {response}")
        time.sleep(30)
        counter = counter + 1

start_server = websockets.serve(hello, 'localhost', 80)

asyncio.get_event_loop().run_until_complete(start_server)
asyncio.get_event_loop().run_forever()