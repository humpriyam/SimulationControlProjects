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

# Placeholder routes for planned projects
@app.get("/pid-tuner", response_class=HTMLResponse)
async def pid_tuner_page(request: Request):
    return HTMLResponse("<h1>PID Tuner - Coming Soon</h1><p>We are building a P5.js interactive tuner for you!</p><a href='/'>Back to Home</a>")

@app.get("/state-space", response_class=HTMLResponse)
async def state_space_page(request: Request):
    return HTMLResponse("<h1>State-Space Simulator - Coming Soon</h1><p>Matrix input dashboard is under construction.</p><a href='/'>Back to Home</a>")

@app.get("/root-locus", response_class=HTMLResponse)
async def root_locus_page(request: Request):
    return HTMLResponse("<h1>Root Locus Plotter - Coming Soon</h1><p>Dynamic pole-zero migration tools are arriving soon.</p><a href='/'>Back to Home</a>")

@app.get("/bode-nyquist", response_class=HTMLResponse)
async def bode_page(request: Request):
    return HTMLResponse("<h1>Bode & Nyquist Plots - Coming Soon</h1><p>Frequency domain analysis tools are being calibrated.</p><a href='/'>Back to Home</a>")

@app.get("/logic-gates", response_class=HTMLResponse)
async def logic_home(request: Request):
    return templates.TemplateResponse(request=request, name="logic_gates_home.html")

@app.get("/logic-gates/basics", response_class=HTMLResponse)
async def logic_basics(request: Request):
    return templates.TemplateResponse(request=request, name="logic_gates_basics.html")

@app.get("/logic-gates/workspace", response_class=HTMLResponse)
async def logic_page(request: Request):
    return templates.TemplateResponse(request=request, name="logic_gates.html")

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
                    
                if "reset" in parsed:
                    pendulum.theta = 0.0
                    pendulum.omega = 0.0
                    pendulum.time = 0.0
                    pendulum.m = 1.0
                    pendulum.l = 1.0
                    pendulum.damping = 0.0
                    pendulum.g = 9.80
                    pendulum.solver = "modified_euler"
                    state["time_step"] = 0.025
                    state["time_rate"] = 1.0
                    state["paused"] = False

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
    pendulum = InvertedPendulum(mass=1.0, length=1.0, cart_mass=2.0)
    # Start with realistic PID tunings for a cart-pole balancing up
    pid = PIDController(kp=120.0, ki=2.5, kd=25.0)
    dt = 0.016
    
    state = {
        "running": True,
        "pid_on": False,
        "is_dragging_cart": False,
        "drag_cart_target": 0.0,
        "is_dragging_bob": False,
        "drag_bob_target": 0.0,
        "paused": False
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
                if "track_limit" in parsed:
                    pendulum.track_limit = float(parsed["track_limit"])
                if "cart_mass" in parsed:
                    pendulum.M = float(parsed["cart_mass"])
                if "mass" in parsed:
                    pendulum.m = float(parsed["mass"])
                if "length" in parsed:
                    pendulum.l = float(parsed["length"])
                    
                if "drag_cart_x" in parsed:
                    state["is_dragging_cart"] = True
                    state["drag_cart_target"] = max(-pendulum.track_limit, min(float(parsed["drag_cart_x"]), pendulum.track_limit))
                if "drag_bob_theta" in parsed:
                    state["is_dragging_bob"] = True
                    state["drag_bob_target"] = float(parsed["drag_bob_theta"])
                    
                if "release_drag" in parsed:
                    state["is_dragging_cart"] = False
                    state["is_dragging_bob"] = False
                    
                if "action" in parsed:
                    action = parsed["action"]
                    if action == "pause":
                        state["paused"] = True
                    elif action == "play":
                        state["paused"] = False
                    elif action == "reset":
                        state["paused"] = True
                        pendulum.x = 0.0
                        pendulum.x_dot = 0.0
                        pendulum.theta = 0.0
                        pendulum.theta_dot = 0.0
                        pid.reset()
                    
        except WebSocketDisconnect:
            state["running"] = False

    asyncio.create_task(listen_for_updates())

    try:
        while state["running"]:
            if state["paused"]:
                if state["is_dragging_cart"]:
                    pendulum.x = state["drag_cart_target"]
                    pendulum.x_dot = 0.0
                if state["is_dragging_bob"]:
                    pendulum.theta = state["drag_bob_target"]
                    pendulum.theta_dot = 0.0
                control_force = 0.0
            else:
                if state["is_dragging_cart"]:
                    cart_error = state["drag_cart_target"] - pendulum.x
                    limited_error = max(-2.0, min(cart_error, 2.0))
                    control_force = 500.0 * limited_error - 50.0 * pendulum.x_dot
                    effective_f = pendulum.step(dt, control_force)
                    # For dragging, we still want to show the 'control_force' as the intent, 
                    # but the effective force is what matters. Let's send effective_f.
                    control_force = effective_f
                    
                elif state["is_dragging_bob"]:
                    pendulum.theta = state["drag_bob_target"]
                    pendulum.theta_dot = 0.0
                    pendulum.step(dt, 0.0)
                    pendulum.theta = state["drag_bob_target"]
                    
                else:
                    if state["pid_on"]:
                        target_angle = 0.0
                        error = target_angle - pendulum.theta
                        pi_val = 3.141592653589793
                        while error > pi_val:  error -= 2 * pi_val
                        # Anti-windup check: If at limit and pushing into it, stop integrating
                        clamp = False
                        if (pendulum.at_limit_right and error < 0) or (pendulum.at_limit_left and error > 0):
                            # Note: error = target(0) - theta. 
                            # If theta is slightly right (positive) and we are at the right limit, 
                            # we want to move cart right to get under it. F > 0.
                            # So we check if the CONTROLLER would want to push further.
                            # Standard PID is F = Kp*e + Ki*Int + Kd*d.
                            # If error and integral have the same sign and we are at the limit, clamp.
                            clamp = True
                            
                        control_force = pid.update(error, dt, clamp_integral=clamp)
                        effective_f = pendulum.step(dt, control_force)
                        control_force = effective_f
                    else:
                        control_force = 0.0
                        pendulum.step(dt, control_force)
            
            A, B = pendulum.get_state_space()
            
            await websocket.send_json({
                "x": pendulum.x,
                "x_dot": pendulum.x_dot,
                "theta": pendulum.theta,
                "theta_dot": pendulum.theta_dot,
                "time": pendulum.time,
                "force": control_force,
                "A": A,
                "B": B
            })
            await asyncio.sleep(dt)
    except Exception as e:
        print(f"Inverted WS error: {e}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8001)
