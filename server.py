#!/usr/bin/env python3
import http.server
import socketserver

PORT = 8080

Handler = http.server.SimpleHTTPRequestHandler

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"Server pokrenut na http://localhost:{PORT}")
    print("Pritisni Ctrl+C za zaustavljanje.")
    httpd.serve_forever()
