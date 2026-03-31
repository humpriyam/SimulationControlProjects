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
        self.at_limit_left = False
        self.at_limit_right = False

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
        
        # 1. Physical Constraint: If the cart is at a limit and the actuator tries 
        # to push further, the stopper cancels the actuator's component completely.
        self.at_limit_left = self.x <= -self.track_limit
        self.at_limit_right = self.x >= self.track_limit
        
        effective_force = force
        if (self.at_limit_right and force > 0) or (self.at_limit_left and force < 0):
            effective_force = 0.0

        # Equations of motion use 'effective_force' (Net Force including stopper reaction)
        S = math.sin(self.theta)
        C = math.cos(self.theta)
        denom = self.M + self.m * S**2
        
        # Acceleration purely from effective_force (Net Result)
        x_ddot = (effective_force + self.m * self.l * self.theta_dot**2 * S - self.m * self.g * S * C + (self.b_p / self.l) * C * self.theta_dot - self.b_c * self.x_dot) / denom
        
        # 2. Collision constraint: If we are at the limit and still have residual velocity 
        # (e.g. from an impact), zero that out to simulate a perfectly inelastic stop.
        if (self.at_limit_right and x_ddot > 0) or (self.at_limit_left and x_ddot < 0):
            x_ddot = 0.0
            if (self.at_limit_right and self.x_dot > 0) or (self.at_limit_left and self.x_dot < 0):
                self.x_dot = 0.0

        # 3. Calculate theta_ddot based on the (possibly constrained) x_ddot
        theta_ddot = (self.g * S - x_ddot * C - (self.b_p / (self.m * self.l)) * self.theta_dot) / self.l

        # 4. Integrate
        self.x_dot += x_ddot * dt
        self.theta_dot += theta_ddot * dt
        
        self.x += self.x_dot * dt
        self.theta += self.theta_dot * dt
        
        # Keep theta within [-pi, pi] for cleanliness
        while self.theta > math.pi: self.theta -= 2 * math.pi
        while self.theta < -math.pi: self.theta += 2 * math.pi
        
        # Safety hard-clamp for track limits
        if self.x > self.track_limit:
            self.x = self.track_limit
            self.x_dot = 0.0
            self.at_limit_right = True
        elif self.x < -self.track_limit:
            self.x = -self.track_limit
            self.x_dot = 0.0
            self.at_limit_left = True
        else:
            # Re-check flags if we aren't hard-clamping to avoid 'stickiness' 
            # if we are just slightly within the limit.
            self.at_limit_left = self.x <= -self.track_limit
            self.at_limit_right = self.x >= self.track_limit

        self.time += dt
        return effective_force

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
