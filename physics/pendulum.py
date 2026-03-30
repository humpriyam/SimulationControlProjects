import math

class BasicPendulum:
    def __init__(self, mass=1.0, length=1.0):
        self.m = mass
        self.l = length
        self.g = 9.80
        self.damping = 0.00
        self.solver = "rk4"

        self.theta = 0.5  # start at 0.5 rad
        self.omega = 0.0
        self.time = 0.0

    def acceleration(self, theta, omega, t):
        gravity_term = - (self.g / self.l) * math.sin(theta)
        damping_term = - self.damping * omega
        return gravity_term + damping_term

    def step(self, dt):
        if self.solver == "euler":
            alpha = self.acceleration(self.theta, self.omega, self.time)
            new_theta = self.theta + self.omega * dt
            new_omega = self.omega + alpha * dt
            self.theta = new_theta
            self.omega = new_omega
        elif self.solver == "rk4":
            k1_o = self.acceleration(self.theta, self.omega, self.time)
            k1_t = self.omega
            k2_o = self.acceleration(self.theta + 0.5*dt*k1_t, self.omega + 0.5*dt*k1_o, self.time + 0.5*dt)
            k2_t = self.omega + 0.5*dt*k1_o
            k3_o = self.acceleration(self.theta + 0.5*dt*k2_t, self.omega + 0.5*dt*k2_o, self.time + 0.5*dt)
            k3_t = self.omega + 0.5*dt*k2_o
            k4_o = self.acceleration(self.theta + dt*k3_t, self.omega + dt*k3_o, self.time + dt)
            k4_t = self.omega + dt*k3_o
            self.theta += (dt / 6.0) * (k1_t + 2*k2_t + 2*k3_t + k4_t)
            self.omega += (dt / 6.0) * (k1_o + 2*k2_o + 2*k3_o + k4_o)
        else: # modified_euler (semi-implicit)
            alpha = self.acceleration(self.theta, self.omega, self.time)
            self.omega += alpha * dt
            self.theta += self.omega * dt
            
        self.time += dt

class InvertedPendulum:
    def __init__(self, mass=1.0, length=1.0):
        self.m = mass
        self.l = length
        self.g = 9.81
        self.theta = math.pi + 0.1  # slightly off-balance
        self.omega = 0.0
        self.time = 0.0
        self.damping = 0.05

    def step(self, dt, torque=0.0):
        # Limit torque realistically to prevent exploding physics
        max_torque = 500.0
        if torque > max_torque: torque = max_torque
        if torque < -max_torque: torque = -max_torque

        inertia = self.m * self.l**2
        gravity_torque = self.m * self.g * self.l * math.sin(self.theta)
        
        alpha = (torque - gravity_torque - self.damping * self.omega) / inertia
        self.omega += alpha * dt
        self.theta += self.omega * dt
        self.time += dt
