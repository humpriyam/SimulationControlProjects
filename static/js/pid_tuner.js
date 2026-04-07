/**
 * Advanced Interactive PID Tuner - Outdoor Drone Lab
 * Powered by P5.js and Chart.js
 */

const COLORS = {
    PRIMARY: '#3fb950',
    SECONDARY: '#2ea043',
    SETPOINT: '#ff0000',
    ERROR: '#f85149',
    SKY_DAY: '#87CEEB',
    SKY_STORM: '#4a4e69',
    GRID: 'rgba(255, 255, 255, 0.1)',
    STONE: '#8b949e',
    LEAF: '#2d6a4f',
    TRUNK: '#582f0e'
};

// --- PID Controller Class ---
class PIDController {
    constructor(kp, ki, kd) {
        this.kp = kp; this.ki = ki; this.kd = kd;
        this.integral = 0; this.prevError = 0; this.maxIntegral = 100;
    }
    update(error, dt) {
        const pEffort = this.kp * error;
        this.integral += error * dt;
        this.integral = Math.max(-this.maxIntegral, Math.min(this.integral, this.maxIntegral));
        const iEffort = this.ki * this.integral;
        const derivative = (error - this.prevError) / dt;
        this.prevError = error;
        const dEffort = this.kd * derivative;
        return { total: pEffort + iEffort + dEffort, p: pEffort, i: iEffort, d: dEffort };
    }
    reset() { this.integral = 0; this.prevError = 0; }
}

// --- Environment Classes ---
class Cloud {
    constructor(p, camX) {
        this.reset(p, camX, true);
    }
    reset(p, camX, initial = false) {
        this.x = initial ? camX + Math.random() * p.width : camX + p.width + 100;
        this.y = Math.random() * p.height * 0.4;
        this.w = Math.random() * 100 + 100;
        this.h = this.w * 0.6;
        this.speed = Math.random() * 0.5 + 0.2;
    }
    draw(p, camX) {
        this.x -= this.speed;
        if (this.x < camX - this.w) this.reset(p, camX);
        p.noStroke();
        p.fill(255, 255, 255, 200);
        p.ellipse(this.x, this.y, this.w, this.h);
        p.ellipse(this.x + 40, this.y + 10, this.w * 0.8, this.h * 0.8);
        p.ellipse(this.x - 40, this.y + 10, this.w * 0.8, this.h * 0.8);
    }
}

class Tree {
    constructor(p, x) {
        this.x = x;
        this.h = Math.random() * 60 + 80;
        this.w = this.h * 0.6;
    }
    draw(p, camX) {
        // Parallax: trees move slower than the background grid
        let drawX = this.x - (camX * 0.5); 
        p.noStroke();
        p.fill(COLORS.TRUNK);
        p.rect(drawX - 5, p.height - this.h * 0.2, 10, this.h * 0.2);
        p.fill(COLORS.LEAF);
        p.triangle(drawX - this.w/2, p.height - this.h * 0.2, drawX + this.w/2, p.height - this.h * 0.2, drawX, p.height - this.h);
    }
}

class Stone {
    constructor(startX, startY, targetX, targetY, power) {
        this.pos = { x: startX, y: startY };
        this.gravity = 0.25;
        this.radius = 8;
        this.hit = false;

        // Guaranteed Hit: Calculate Velocity components to reach (targetX, targetY)
        // Time of flight inversely proportional to power (Power 100 = 20 frames, Power 0 = 60 frames)
        const timeOfFlight = p5.prototype.map(power, 0, 100, 60, 20);
        
        const dx = targetX - startX;
        const dy = targetY - startY;

        this.vel = {
            x: dx / timeOfFlight,
            y: (dy - 0.5 * this.gravity * Math.pow(timeOfFlight, 2)) / timeOfFlight
        };
    }
    update() { this.vel.y += this.gravity; this.pos.x += this.vel.x; this.pos.y += this.vel.y; }
    draw(p) { p.fill(COLORS.STONE); p.noStroke(); p.circle(this.pos.x, this.pos.y, this.radius * 2); }
}

class Particle {
    constructor(type, w, h, camX) {
        this.type = type; this.reset(w, h, camX);
    }
    reset(w, h, camX) {
        this.x = camX + Math.random() * w + (this.type === 'wind' ? w : 0);
        this.y = Math.random() * h - (this.type === 'rain' || this.type === 'hail' ? h : 0);
        this.speed = Math.random() * 5 + 5;
        this.size = this.type === 'hail' ? Math.random() * 4 + 2 : 2;
    }
    update(w, h, camX, windX, windY) {
        if (this.type === 'rain') { this.x += windX; this.y += this.speed + windY; }
        else if (this.type === 'hail') { this.x += windX * 0.5; this.y += this.speed * 1.5 + windY; }
        else { this.x -= this.speed * 2 + windX; this.y += (Math.random() - 0.5) * 2 + windY; }
        if (this.y > h || this.x < camX - 100 || this.x > camX + w + 100) this.reset(w, h, camX);
    }
    draw(p) {
        p.noStroke();
        if (this.type === 'rain') { p.fill(0, 50, 255, 150); p.rect(this.x, this.y, 1, 10); }
        else if (this.type === 'hail') { p.fill(255); p.circle(this.x, this.y, this.size); }
    }
}

// --- Simulation State ---
let droneX, droneY, droneVX = 0, droneVY = 0;
let setpoint = 200;
let pid = new PIDController(1.5, 0.02, 0.4);
let dt = 0.1, gravity = 0.15, mass = 1.0;
let isRunning = false, cameraX = 0;

let weatherType = 'clear', windX = 0, windY = 0;
let randScaleX = 1, randScaleY = 1;
let particles = [], clouds = [], trees = [], stones = [];
let holdStartTime = 0, isCharging = false;
let chart;
const MAX_DATA_POINTS = 720;

const p5_sketch = (p) => {
    p.setup = () => {
        const container = document.getElementById('p5-container');
        const canvas = p.createCanvas(container.offsetWidth, container.offsetHeight);
        canvas.parent('p5-container');
        canvas.elt.oncontextmenu = (e) => e.preventDefault();
        
        droneX = p.width / 2; droneY = p.height - 100;
        for (let i = 0; i < 5; i++) clouds.push(new Cloud(p, 0));
        for (let i = 0; i < 40; i++) trees.push(new Tree(p, i * 150 - 1000));
        initChart();
    };

    p.draw = () => {
        weatherType = document.getElementById('weatherSelect').value;
        const skyColor = (weatherType.includes('rain') || weatherType.includes('hail')) ? COLORS.SKY_STORM : COLORS.SKY_DAY;
        p.background(skyColor);

        // Sky Gradient
        for (let y = 0; y < p.height; y += 4) {
            let inter = p.map(y, 0, p.height, 0, 1);
            let c = p.lerpColor(p.color(skyColor), p.color('#fff'), inter);
            p.stroke(c);
            p.line(0, y, p.width, y);
        }

        let targetCamX = droneX - p.width / 2;
        cameraX = p.lerp(cameraX, targetCamX, 0.1);

        p.push();
        p.translate(-cameraX, 0);

        // Background Elements
        clouds.forEach(c => c.draw(p, cameraX));
        trees.forEach(t => t.draw(p, cameraX));
        drawInfiniteGrid(p, cameraX);

        if (!isRunning) {
            drawState(p, cameraX);
            p.pop();
            return;
        }

        updateEnvironment(p);
        updatePhysics(p);
        drawSimulation(p);
        p.pop();

        if (isCharging) drawPowerMeter(p);
        updateMetrics();
    };

    function updateEnvironment(p) {
        let particleCount = 0;
        let pType = 'rain';

        // Base Magnitudes
        let magX = 0;
        let magY = 0;

        if (weatherType === 'slight_wind') { magX = 1.0; magY = 0.1; }
        else if (weatherType === 'wind') { magX = 3.5; magY = 0.6; }
        else if (weatherType === 'slight_rain') { magX = 0.8; magY = 1.2; particleCount = 40; pType = 'rain'; }
        else if (weatherType === 'rain') { magX = 2.0; magY = 3.5; particleCount = 120; pType = 'rain'; }
        else if (weatherType === 'slight_hail') { magX = 0.5; magY = 0.8; particleCount = 20; pType = 'hail'; }
        else if (weatherType === 'hail') { magX = 1.5; magY = 4.5; particleCount = 80; pType = 'hail'; }
        
        // Apply randomization scale
        windX = magX * randScaleX;
        windY = magY * randScaleY;

        // Clear Sky explicitly kills drift
        if (weatherType === 'clear') { 
            droneVX *= 0.85; 
            windX = 0; windY = 0;
        }

        while (particles.length < particleCount) particles.push(new Particle(pType, p.width, p.height, cameraX));
        while (particles.length > particleCount) particles.pop();

        particles.forEach(pt => {
            pt.update(p.width, p.height, cameraX, windX, windY);
            pt.draw(p);
        });
    }

    function updatePhysics(p) {
        pid.kp = parseFloat(document.getElementById('kpRange').value);
        pid.ki = parseFloat(document.getElementById('kiRange').value);
        pid.kd = parseFloat(document.getElementById('kdRange').value);
        setpoint = parseFloat(document.getElementById('setpointRange').value);

        const rawError = (p.height - setpoint) - (p.height - droneY);
        const normalizedError = rawError / 100.0;
        const signal = pid.update(normalizedError, dt);
        
        // Horizontal Physics
        if (weatherType !== 'clear') {
            droneVX += (windX * 0.05) / mass;
        }
        droneVX *= 0.98;
        droneX += droneVX;

        // Vertical Physics (including Rain/Hail Pressure & Jitter)
        let weatherImpact = (windY * 0.08); 
        if (weatherType.includes('rain')) weatherImpact += (Math.random() - 0.5) * 0.5;
        if (weatherType.includes('hail')) weatherImpact += (Math.random() - 0.5) * 1.5;

        const totalFY = (weatherImpact + gravity * mass - signal.total) / mass;
        droneVY += totalFY;
        droneVY *= 0.96;
        droneY += droneVY;

        if (droneY > p.height - 20) { droneY = p.height - 20; droneVY = 0; }
        if (droneY < 20) { droneY = 20; droneVY = 0; }

        // Stones & Collisions
        stones.forEach((s, idx) => {
            s.update(); s.draw(p);
            let sx = s.pos.x - cameraX; // stone is absolute, drone is absolute
            const d = Math.sqrt((s.pos.x - droneX)**2 + (s.pos.y - droneY)**2);
            if (!s.hit && d < 30) { 
                droneVY += s.vel.y * 0.4; 
                droneVX += s.vel.x * 0.2; 
                s.hit = true; 
            }
            if (s.pos.y > p.height + 100) stones.splice(idx, 1);
        });

        // UI Update
        updateComponentBar('pBar', signal.p);
        updateComponentBar('iBar', signal.i);
        updateComponentBar('dBar', signal.d);
        if (p.frameCount % 5 === 0) updateChartData(normalizedError * 10, signal.total);
        window.currentSignal = signal; window.currentError = normalizedError;
    }

    function drawSimulation(p) {
        p.stroke(COLORS.SETPOINT); p.strokeWeight(2);
        p.line(cameraX - 100, setpoint, cameraX + p.width + 100, setpoint);
        p.push(); p.translate(droneX, droneY); p.rotate(droneVX * 0.1); drawDroneModel(p); p.pop();
    }

    function updateMetrics() {
        if (!window.currentSignal) return;
        document.getElementById('kpVal').innerText = pid.kp.toFixed(2);
        document.getElementById('kiVal').innerText = pid.ki.toFixed(2);
        document.getElementById('kdVal').innerText = pid.kd.toFixed(3);
        document.getElementById('setpointVal').innerText = setpoint.toFixed(0);
        document.getElementById('errorMetric').innerText = (window.currentError * 10).toFixed(2);
        document.getElementById('effortMetric').innerText = window.currentSignal.total.toFixed(2);
    }

    p.mousePressed = (e) => {
        if (p.mouseX < 0 || p.mouseX > p.width || p.mouseY < 0 || p.mouseY > p.height) return;
        if (!isRunning) return;
        if (p.mouseButton === p.LEFT) {
            const dx = droneX - (p.mouseX + cameraX), dy = droneY - p.mouseY;
            const dist = Math.sqrt(dx*dx + dy*dy) || 1;
            droneVX += (dx/dist)*12; droneVY += (dy/dist)*12;
        } else if (p.mouseButton === p.RIGHT) { holdStartTime = p.millis(); isCharging = true; }
    };

    p.mouseReleased = (e) => {
        if (isCharging && p.mouseButton === p.RIGHT) {
            const power = Math.min((p.millis() - holdStartTime)/10, 100);
            stones.push(new Stone(p.mouseX + cameraX, p.mouseY, droneX, droneY, power));
            isCharging = false;
        }
    };
};

function drawInfiniteGrid(p, camX) {
    p.stroke(COLORS.GRID); const step = 40; const startX = Math.floor(camX / step) * step;
    for (let x = startX; x < startX + p.width + step; x += step) p.line(x, 0, x, p.height);
}

function drawState(p, camX) {
    p.fill(0, 0, 0, 100); p.rect(camX, 0, p.width, p.height);
    p.fill(255); p.textAlign(p.CENTER); p.textSize(24); p.text("PAUSED", camX + p.width/2, p.height/2);
    drawDroneModel(p, droneX, droneY);
}

function drawDroneModel(p, x=0, y=0) {
    p.push(); p.translate(x, y);
    p.stroke('#333'); p.strokeWeight(4); p.line(-30, 0, 30, 0);
    p.noStroke(); p.fill('#f0f6fc'); p.rectMode(p.CENTER); p.rect(0, 0, 20, 15, 4);
    p.stroke(COLORS.PRIMARY); p.strokeWeight(2);
    const propOffset = Math.sin(p.frameCount * 0.5) * 10;
    p.line(-30 - propOffset, -5, -30 + propOffset, -5); p.line(30 - propOffset, -5, 30 + propOffset, -5);
    p.pop();
}

function drawPowerMeter(p) {
    const power = Math.min((p.millis() - holdStartTime)/10, 100);
    p.noFill(); p.stroke(255, 100); p.circle(p.mouseX, p.mouseY, 40);
    p.stroke(COLORS.PRIMARY); p.strokeWeight(3); p.arc(p.mouseX, p.mouseY, 40, 40, -p.HALF_PI, -p.HALF_PI + (p.TWO_PI * power / 100));
}

function updateComponentBar(id, value) {
    const el = document.getElementById(id); if (!el) return;
    el.style.width = Math.min(Math.abs(value) * 50, 100) + '%';
    el.style.opacity = value === 0 ? 0.3 : 1.0;
}

function initChart() {
    const ctx = document.getElementById('pidChart').getContext('2d');
    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: Array(MAX_DATA_POINTS).fill(''),
            datasets: [
                { label: 'Error (m)', data: Array(MAX_DATA_POINTS).fill(null), borderColor: COLORS.ERROR, borderWidth: 2, tension: 0.4, pointRadius: 0 },
                { label: 'Control Effort (N)', data: Array(MAX_DATA_POINTS).fill(null), borderColor: COLORS.PRIMARY, borderWidth: 2, tension: 0.4, pointRadius: 0 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: { y: { grid: { color: 'rgba(255, 255, 255, 0.1)' }, ticks: { color: '#8b949e' } }, x: { display: false } },
            plugins: { legend: { labels: { color: '#f0f6fc', font: { size: 10 } } } }, animation: false
        }
    });
}

function updateChartData(error, effort) {
    chart.data.datasets[0].data.push(error); if (chart.data.datasets[0].data.length > MAX_DATA_POINTS) chart.data.datasets[0].data.shift();
    chart.data.datasets[1].data.push(effort); if (chart.data.datasets[1].data.length > MAX_DATA_POINTS) chart.data.datasets[1].data.shift();
    chart.update();
}

document.addEventListener('DOMContentLoaded', () => {
    new p5(p5_sketch);
    const playPauseBtn = document.getElementById('playPauseBtn');
    const randomizeBtn = document.getElementById('randomizeWind');
    const weatherSelect = document.getElementById('weatherSelect');

    weatherSelect.addEventListener('change', () => {
        weatherType = weatherSelect.value;
        const isClear = weatherType === 'clear';
        randomizeBtn.style.display = isClear ? 'none' : 'block';
        
        // Reset scale on change or keep it? Let's reset to defaults.
        randScaleX = 1;
        randScaleY = 1;
    });

    randomizeBtn.addEventListener('click', () => {
        // Random direction: 8-way roughly
        const angles = [0, 45, 90, 135, 180, 225, 270, 315];
        const angle = angles[Math.floor(Math.random() * angles.length)] * (Math.PI / 180);
        randScaleX = Math.cos(angle) * 1.5;
        randScaleY = Math.sin(angle) * 1.5;
    });

    playPauseBtn.addEventListener('click', () => {
        isRunning = !isRunning;
        playPauseBtn.innerHTML = isRunning ? '⏹ Stop Simulation' : '▶ Start Simulation';
        playPauseBtn.style.backgroundColor = isRunning ? '#f85149' : '#3fb950';
    });
    document.getElementById('resetSim').addEventListener('click', () => {
        droneX = 400; droneY = 300; droneVX = 0; droneVY = 0; cameraX = 0; pid.reset();
        const defaults = { 'kpRange': 1.5, 'kiRange': 0.02, 'kdRange': 0.4, 'setpointRange': 200 };
        Object.keys(defaults).forEach(id => document.getElementById(id).value = defaults[id]);
        chart.data.datasets[0].data = Array(MAX_DATA_POINTS).fill(null);
        chart.data.datasets[1].data = Array(MAX_DATA_POINTS).fill(null); chart.update();
    });
    document.getElementById('saveChart').addEventListener('click', () => {
        const link = document.createElement('a'); link.download = 'pid-tuning-results.png';
        link.href = chart.toBase64Image(); link.click();
    });
});
