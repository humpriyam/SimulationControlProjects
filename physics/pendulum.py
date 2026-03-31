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
    """ Cart-Pole Non-linear model. theta=0 is upright (unstable equilibrium). """
    def __init__(self, mass=1.0, length=1.0, cart_mass=2.0):
        self.m = mass       # pole mass
        self.M = cart_mass  # cart mass
        self.l = length     # pole length to point mass
        self.g = 9.81
        
        # State: x, x_dot, theta, theta_dot
        self.x = 0.0
        self.x_dot = 0.0
        self.theta = 0.0    # 0 is perfectly upright
        self.theta_dot = 0.0
        
        self.b_c = 1.0      # Cart friction
        self.b_p = 0.05     # Pole friction
        self.time = 0.0
        
        self.track_limit = 5.0 # default +/- 5 meters

    def _equations_of_motion(self, x, x_dot, theta, theta_dot, force):
        S = math.sin(theta)
        C = math.cos(theta)
        
        # Denominator for x_ddot
        denom = self.M + self.m * S**2
        
        x_ddot = (force + self.m * self.l * theta_dot**2 * S - self.m * self.g * S * C + (self.b_p / self.l) * C * theta_dot - self.b_c * x_dot) / denom
        theta_ddot = (self.g * S - x_ddot * C - (self.b_p / (self.m * self.l)) * theta_dot) / self.l
        return x_ddot, theta_ddot

    def step(self, dt, force=0.0):
        # Limit force realistically
        max_force = 500.0
        force = max(-max_force, min(force, max_force))

        # Euler step
        x_ddot, theta_ddot = self._equations_of_motion(self.x, self.x_dot, self.theta, self.theta_dot, force)
        
        self.x_dot += x_ddot * dt
        self.theta_dot += theta_ddot * dt
        
        self.x += self.x_dot * dt
        self.theta += self.theta_dot * dt
        
        # Keep theta within [-pi, pi] for cleanliness
        while self.theta > math.pi: self.theta -= 2 * math.pi
        while self.theta < -math.pi: self.theta += 2 * math.pi
        
        # Track limits (Inelastic collision)
        if self.x > self.track_limit:
            self.x = self.track_limit
            self.x_dot = 0.0
        elif self.x < -self.track_limit:
            self.x = -self.track_limit
            self.x_dot = 0.0

        self.time += dt

    def get_state_space(self):
        """ Returns the linearized A and B matrices (Python lists) at theta=0 """
        a22 = -self.b_c / self.M
        a23 = -self.m * self.g / self.M
        a24 = self.b_p / (self.M * self.l)
        
        a42 = self.b_c / (self.M * self.l)
        a43 = self.g * (self.M + self.m) / (self.M * self.l)
        a44 = -self.b_p * (self.M + self.m) / (self.M * self.m * self.l**2)
        
        A = [
            [0.0, 1.0, 0.0, 0.0],
            [0.0, a22, a23, a24],
            [0.0, 0.0, 0.0, 1.0],
            [0.0, a42, a43, a44]
        ]
        
        B = [
            [0.0],
            [1.0 / self.M],
            [0.0],
            [-1.0 / (self.M * self.l)]
        ]
        
        return A, B
