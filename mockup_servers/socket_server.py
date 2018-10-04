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
        [8,1,18,117,10,3,80,85,84,18,15,47,97,112,105,47,118,49,47,109,101,115,115,97,103,101,26,91,8,1,18,66,48,53,57,54,51,57,53,97,55,102,48,97,54,99,97,54,51,55,57,100,52,57,99,53,97,53,56,52,49,48,51,97,52,57,50,55,52,57,55,51,99,102,53,55,97,98,49,98,54,51,48,49,51,51,48,99,99,51,51,101,97,54,102,57,52,99,56,1,40,0,66,15,10,13,10,11,104,101,108,108,111,32,119,111,114,108,100,32,99]
        )
    # created by executing in js:
    # dataMessage = new textsecure.protobuf.DataMessage({body: "hello world", attachments:[], contact:[]})
    # content = new textsecure.protobuf.Content({ dataMessage })
    # contentBytes = content.encode().toArrayBuffer()
    # messageEnvelope = new textsecure.protobuf.Envelope({ type:1, source:"0596395a7f0a6ca6379d49c5a584103a49274973cf57ab1b6301330cc33ea6f94c", sourceDevice:1, timestamp:0, content: contentBytes})
    # requestMessage = new textsecure.protobuf.WebSocketRequestMessage({id:99, verb:'PUT', path:'/api/v1/message', body: messageEnvelope.encode().toArrayBuffer()})
    # protomessage = new textsecure.protobuf.WebSocketMessage({type: textsecure.protobuf.WebSocketMessage.Type.REQUEST, request: requestMessage})
    # bytes = new Uint8Array(protomessage.encode().toArrayBuffer())
    # bytes.toString()
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