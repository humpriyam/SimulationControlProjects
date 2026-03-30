from fastapi import FastAPI, WebSocket, Request, WebSocketDisconnect
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import asyncio
import json
from physics.pendulum import BasicPendulum, InvertedPendulum
from physics.pid import PIDController

app = FastAPI()

app.mount("/static", StaticFiles(directory="static"), name="static")

templates = Jinja2Templates(directory="templates")

@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse(request=request, name="index.html")

@app.get("/basic", response_class=HTMLResponse)
async def basic_pendulum_page(request: Request):
    return templates.TemplateResponse(request=request, name="basic_pendulum.html")

@app.get("/inverted", response_class=HTMLResponse)
async def inverted_pendulum_page(request: Request):
    return templates.TemplateResponse(request=request, name="inverted_pendulum.html")

@app.websocket("/ws/basic")
async def websocket_basic(websocket: WebSocket):
    await websocket.accept()
    pendulum = BasicPendulum(mass=1.0, length=1.0)
    
    dt_real = 0.016
    
    state = {
        "running": True,
        "time_step": 0.0250,
        "time_rate": 1.0,
        "is_dragging": False,
        "paused": False
    }
    
    async def listen_for_updates():
        try:
            while True:
                data = await websocket.receive_text()
                parsed = json.loads(data)
                
                if "mass" in parsed: pendulum.m = float(parsed["mass"])
                if "length" in parsed: pendulum.l = float(parsed["length"])
                if "damping" in parsed: pendulum.damping = float(parsed["damping"])
                if "gravity" in parsed: pendulum.g = float(parsed["gravity"])
                if "solver" in parsed: pendulum.solver = str(parsed["solver"])
                
                if "time_step" in parsed: state["time_step"] = float(parsed["time_step"])
                if "time_rate" in parsed: state["time_rate"] = float(parsed["time_rate"])
                
                if "drag_theta" in parsed:
                    state["is_dragging"] = True
                    pendulum.theta = float(parsed["drag_theta"])
                    pendulum.omega = 0.0
                
                if "release_drag" in parsed:
                    state["is_dragging"] = False
                    
                if "push_impulse" in parsed:
                    pendulum.omega += float(parsed["push_impulse"])
                    
                if "is_paused" in parsed:
                    state["paused"] = bool(parsed["is_paused"])

        except WebSocketDisconnect:
            state["running"] = False

    asyncio.create_task(listen_for_updates())

    try:
        while state["running"]:
            if not state["is_dragging"] and not state["paused"]:
                dt_sim = state["time_step"] * state["time_rate"]
                pendulum.step(dt_sim)
            
            await websocket.send_json({
                "theta": pendulum.theta,
                "omega": pendulum.omega,
                "time": pendulum.time
            })
            await asyncio.sleep(dt_real)
    except Exception as e:
        print(f"Basic WS error: {e}")

@app.websocket("/ws/inverted")
async def websocket_inverted(websocket: WebSocket):
    await websocket.accept()
    pendulum = InvertedPendulum(mass=1.0, length=1.0)
    # Start with realistic PID tunings for a pendulum balancing up
    pid = PIDController(kp=50.0, ki=0.0, kd=10.0)
    dt = 0.016
    
    state = {
        "running": True,
        "pid_on": False,
        "disturbance": 0.0
    }
    
    async def listen_for_updates():
        try:
            while True:
                data = await websocket.receive_text()
                parsed = json.loads(data)
                if "kp" in parsed:
                    pid.kp = float(parsed["kp"])
                if "ki" in parsed:
                    pid.ki = float(parsed["ki"])
                if "kd" in parsed:
                    pid.kd = float(parsed["kd"])
                if "pid_on" in parsed:
                    state["pid_on"] = bool(parsed["pid_on"])
                    if not state["pid_on"]:
                        pid.reset()
                if "disturbance" in parsed:
                    pendulum.omega += float(parsed["disturbance"])
        except WebSocketDisconnect:
            state["running"] = False

    asyncio.create_task(listen_for_updates())

    try:
        while state["running"]:
            if state["pid_on"]:
                # Error is difference between target (pi) and current theta
                target_angle = 3.141592653589793
                error = target_angle - pendulum.theta
                
                # Normalize error to [-pi, pi]
                while error > 3.141592653589793:
                    error -= 2 * 3.141592653589793
                while error < -3.141592653589793:
                    error += 2 * 3.141592653589793
                
                control_torque = pid.update(error, dt)
            else:
                control_torque = 0.0
            
            pendulum.step(dt, control_torque)
            await websocket.send_json({
                "theta": pendulum.theta,
                "omega": pendulum.omega,
                "time": pendulum.time,
                "torque": control_torque
            })
            await asyncio.sleep(dt)
    except Exception as e:
        print(f"Inverted WS error: {e}")
