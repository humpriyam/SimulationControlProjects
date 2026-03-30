class PIDController:
    def __init__(self, kp=1.0, ki=0.0, kd=0.0):
        self.kp = kp
        self.ki = ki
        self.kd = kd
        self.integral = 0.0
        self.prev_error = 0.0

    def update(self, error, dt):
        self.integral += error * dt
        
        # Anti-windup
        max_integral = 50.0
        if self.integral > max_integral:
            self.integral = max_integral
        elif self.integral < -max_integral:
            self.integral = -max_integral
            
        derivative = (error - self.prev_error) / dt
        self.prev_error = error
        
        return self.kp * error + self.ki * self.integral + self.kd * derivative
        
    def reset(self):
        self.integral = 0.0
        self.prev_error = 0.0
