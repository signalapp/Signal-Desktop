#!/usr/bin/env python
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
 
# HTTPRequestHandler class
class testHTTPServer_RequestHandler(BaseHTTPRequestHandler):
  def do_POST(self):
    print('got POST request to ' + self.path)
    # add some latency
    time.sleep(2)
    # Send response status code
    self.send_response(201)

    # Send headers
    #self.send_header()
    self.end_headers()

    message = self.rfile.read(int(self.headers.get('Content-Length'))).decode('UTF-8')

    print(message)

    # Send message back to client
    #message = "ok"
    # Write content as utf-8 data
    #self.wfile.write(bytes(message, "utf8"))

  # GET
  def do_GET(self):
    # Send response status code
    time.sleep(1)
    self.send_response(200)

    # Send headers
    self.send_header('Content-type','text/html')
    self.end_headers()

    # Send message back to client
    message = "Hello world!"
    # Write content as utf-8 data
    self.wfile.write(bytes(message, "utf8"))
    return
 
def run():
  print('starting server...')
 
  # Server settings
  # Choose port 8080, for port 80, which is normally used for a http server, you need root access
  server_address = ('127.0.0.1', 80)
  httpd = HTTPServer(server_address, testHTTPServer_RequestHandler)
  print('running server...')
  httpd.serve_forever()
 
 
run()