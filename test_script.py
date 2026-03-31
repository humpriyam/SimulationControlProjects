from physics.pendulum import InvertedPendulum
from physics.pid import PIDController

pendulum = InvertedPendulum(mass=1.0, length=1.0, cart_mass=2.0)
pid = PIDController(kp=100.0, ki=0.0, kd=20.0)
dt = 0.016

try:
    target_angle = 0.0
    error = target_angle - pendulum.theta
    pi_val = 3.141592653589793
    while error > pi_val:  error -= 2 * pi_val
    while error < -pi_val: error += 2 * pi_val
    
    control_force = pid.update(error, dt)
    pendulum.step(dt, control_force)
    
    A, B = pendulum.get_state_space()
    
    print("SUCCESS!")
    print(pendulum.x, pendulum.theta)
except Exception as e:
    import traceback
    traceback.print_exc()
