from websockets.sync.client import connect

def test():
    try:
        with connect("ws://127.0.0.1:8000/ws/inverted") as websocket:
            print("Connected")
            message = websocket.recv(timeout=2)
            print("Received:", type(message))
            print("Message preview:", message[:100])
    except Exception as e:
        import traceback
        traceback.print_exc()

test()
