const simCanvas = document.getElementById('simCanvas');
const ctx = simCanvas.getContext('2d');
let width = simCanvas.width = simCanvas.offsetWidth;
let height = simCanvas.height = simCanvas.offsetHeight;

window.addEventListener('resize', () => {
    width = simCanvas.width = simCanvas.offsetWidth;
    height = simCanvas.height = simCanvas.offsetHeight;
});

const togglePIDBtn = document.getElementById('togglePIDBtn');
const kpRange = document.getElementById('kpRange');
const kpVal = document.getElementById('kpVal');
const kiRange = document.getElementById('kiRange');
const kiVal = document.getElementById('kiVal');
const kdRange = document.getElementById('kdRange');
const kdVal = document.getElementById('kdVal');
const trackRange = document.getElementById('trackRange');
const trackVal = document.getElementById('trackVal');
const cartMassRange = document.getElementById('cartMassRange');
const cartMassVal = document.getElementById('cartMassVal');
const bobMassRange = document.getElementById('bobMassRange');
const bobMassVal = document.getElementById('bobMassVal');
const lengthRange = document.getElementById('lengthRange');
const lengthVal = document.getElementById('lengthVal');

const torqueDisplay = document.getElementById('torqueDisplay');
const stateSpaceDisplay = document.getElementById('stateSpaceDisplay');

const playPauseBtn = document.getElementById('playPauseBtn');
const resetBtn = document.getElementById('resetBtn');
const zoomInBtn = document.getElementById('zoomInBtn');
const zoomOutBtn = document.getElementById('zoomOutBtn');
const showAngleCheck = document.getElementById('showAngleCheck');

let pidOn = false;
let isPaused = false;

// Chart Setup
const ctxChart = document.getElementById('chartCanvas').getContext('2d');
const chart = new Chart(ctxChart, {
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            label: 'Angle (deg)',
            data: [],
            borderColor: '#bc8cff',
            borderWidth: 2,
            tension: 0.4,
            pointRadius: 0
        },
        {
            label: 'Target (0 deg)',
            data: [],
            borderColor: '#2ea043',
            borderWidth: 1,
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        scales: {
            x: { display: false },
            y: { grid: { color: '#30363d' }, ticks: { color: '#c9d1d9' } }
        },
        plugins: { legend: { labels: { color: '#c9d1d9' } } }
    }
});

// WebSocket Connection
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const ws = new WebSocket(`${protocol}//${window.location.host}/ws/inverted`);

ws.onopen = () => console.log("Connected to cart-pole physics engine");

// UI Events
togglePIDBtn.addEventListener('click', () => {
    pidOn = !pidOn;
    togglePIDBtn.textContent = `PID: ${pidOn ? 'ON' : 'OFF'}`;
    togglePIDBtn.className = `btn ${pidOn ? 'on' : 'off'}`;
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ pid_on: pidOn }));
    }
});

playPauseBtn.addEventListener('click', () => {
    isPaused = !isPaused;
    playPauseBtn.textContent = isPaused ? '▶ Play' : '⏸ Pause';
    playPauseBtn.style.backgroundColor = isPaused ? '#2ea043' : '#d29922';
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: isPaused ? 'pause' : 'play' }));
    }
});

resetBtn.addEventListener('click', () => {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: 'reset' }));
    }
    // Clear chart
    chart.data.labels = [];
    chart.data.datasets[0].data = [];
    chart.data.datasets[1].data = [];
    chart.update();
    
    isPaused = true;
    playPauseBtn.textContent = '▶ Play';
    playPauseBtn.style.backgroundColor = '#2ea043';
});

zoomInBtn.addEventListener('click', () => { zoom *= 1.2; drawSim(); });
zoomOutBtn.addEventListener('click', () => { zoom /= 1.2; drawSim(); });

const sendFloatParam = (key, val) => {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ [key]: parseFloat(val) }));
    }
};

kpRange.addEventListener('input', e => { kpVal.textContent = e.target.value; sendFloatParam('kp', e.target.value); });
kiRange.addEventListener('input', e => { kiVal.textContent = e.target.value; sendFloatParam('ki', e.target.value); });
kdRange.addEventListener('input', e => { kdVal.textContent = e.target.value; sendFloatParam('kd', e.target.value); });
trackRange.addEventListener('input', e => { trackVal.textContent = e.target.value; sendFloatParam('track_limit', e.target.value); });

cartMassRange.addEventListener('input', e => { cartMassVal.textContent = e.target.value; sendFloatParam('cart_mass', e.target.value); });
bobMassRange.addEventListener('input', e => { bobMassVal.textContent = e.target.value; sendFloatParam('mass', e.target.value); });
lengthRange.addEventListener('input', e => { 
    lengthVal.textContent = e.target.value; 
    l_vis = parseFloat(e.target.value);
    sendFloatParam('length', e.target.value); 
});

let currentState = { x: 0, x_dot: 0, theta: 0, theta_dot: 0, time: 0, force: 0, A: [], B: [] };
let zoom = 50; // 50 pixels per meter
let l_vis = parseFloat(lengthRange.value); // dynamic visual scale

function normalizeTheta(th) {
    let res = th % (2 * Math.PI);
    if (res > Math.PI) res -= 2 * Math.PI;
    else if (res < -Math.PI) res += 2 * Math.PI;
    return res;
}

function formatMatrix(mat) {
    if (!mat || mat.length === 0) return "";
    return mat.map(row => "  [" + row.map(v => v.toFixed(3).padStart(8)).join(", ") + "]").join("\n");
}

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    currentState = data;

    torqueDisplay.textContent = data.force.toFixed(2) + " N";

    // Update State Space HUD
    const stateStr = `X = [${data.x.toFixed(3)}, ${data.x_dot.toFixed(3)}, ${data.theta.toFixed(3)}, ${data.theta_dot.toFixed(3)}]^T`;
    const aStr = formatMatrix(data.A);
    const bStr = formatMatrix(data.B);
    stateSpaceDisplay.textContent = `A = [\n${aStr}\n]\n\nB = [\n${bStr}\n]\n\n${stateStr}`;

    // Update Chart
    const maxDataPoints = 150;
    chart.data.labels.push(data.time.toFixed(1));
    const angleDeg = normalizeTheta(data.theta) * 180 / Math.PI;
    chart.data.datasets[0].data.push(angleDeg);
    chart.data.datasets[1].data.push(0.0); // Target line is 0 (upright)
    
    if (chart.data.labels.length > maxDataPoints) {
        chart.data.labels.shift();
        chart.data.datasets[0].data.shift();
        chart.data.datasets[1].data.shift();
    }
    chart.update();

    drawSim();
};

function drawSim() {
    ctx.clearRect(0, 0, width, height);

    const centerY = height - 80;
    const centerX = width / 2;
    const trackLimitPx = trackRange.value * zoom;

    // Draw Track Limits
    ctx.strokeStyle = '#484f58';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(centerX - trackLimitPx, centerY);
    ctx.lineTo(centerX + trackLimitPx, centerY);
    ctx.stroke();
    
    // Draw Linear Scale (Meter Ticks)
    ctx.fillStyle = '#8b949e';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    const limitMeters = Math.floor(trackRange.value);
    for (let i = -limitMeters; i <= limitMeters; i++) {
        const tickX = centerX + i * zoom;
        ctx.fillRect(tickX - 1, centerY, 2, 8);
        if (i % 2 === 0 || limitMeters <= 5) { // Show text on every tick if small, else every 2 meters
            ctx.fillText(i + "m", tickX, centerY + 20);
        }
    }

    // Draw Track Bounds (Stoppers)
    ctx.fillStyle = '#da3633';
    ctx.fillRect(centerX - trackLimitPx - 5, centerY - 10, 10, 20);
    ctx.fillRect(centerX + trackLimitPx - 5, centerY - 10, 10, 20);

    // Cart Params
    const cartX = centerX + currentState.x * zoom;
    const cartW = 60;
    const cartH = 30;

    // Draw Cart
    ctx.fillStyle = '#8b949e';
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'rgba(139, 148, 158, 0.4)';
    ctx.fillRect(cartX - cartW/2, centerY - cartH/2, cartW, cartH);
    ctx.shadowBlur = 0;

    // Pole Params (theta=0 is straight up)
    const px = cartX + zoom * l_vis * Math.sin(currentState.theta);
    const py = centerY - zoom * l_vis * Math.cos(currentState.theta);

    // Draw Pole
    ctx.strokeStyle = '#c9d1d9';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(cartX, centerY);
    ctx.lineTo(px, py);
    ctx.stroke();

    // Draw Bob / Mass
    ctx.fillStyle = '#bc8cff';
    ctx.shadowBlur = 20;
    ctx.shadowColor = 'rgba(188, 140, 255, 0.7)';
    ctx.beginPath();
    ctx.arc(px, py, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    
    ctx.strokeStyle = '#a371f7';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Angle Overlay (Compass/Protractor)
    if (showAngleCheck.checked) {
        const angleDeg = normalizeTheta(currentState.theta) * 180 / Math.PI;
        
        ctx.save();
        ctx.translate(cartX, centerY);
        
        // Draw vertical reference line
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = 'rgba(201, 209, 217, 0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -100);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw Arc
        ctx.strokeStyle = '#58a6ff';
        ctx.lineWidth = 2;
        const radius = 60;
        ctx.beginPath();
        // Canvas angles start at 3 o'clock (0 rad), clockwise.
        // theta=0 is straight up (-Math.PI/2)
        const startAng = -Math.PI/2;
        const endAng = -Math.PI/2 + currentState.theta;
        ctx.arc(0, 0, radius, startAng, endAng, currentState.theta < 0);
        ctx.stroke();

        // Draw Angle Text
        ctx.fillStyle = '#58a6ff';
        ctx.font = 'bold 14px Inter';
        ctx.textAlign = 'center';
        ctx.fillText(`${angleDeg.toFixed(1)}°`, 0, -radius - 15);
        
        ctx.restore();
    }

    // Force Indicator
    if (pidOn && Math.abs(currentState.force) > 0.5) {
        ctx.strokeStyle = currentState.force > 0 ? '#2ea043' : '#da3633';
        ctx.lineWidth = 4;
        ctx.beginPath();
        
        const fScale = Math.min(Math.abs(currentState.force) * 2, 100);
        const dir = currentState.force > 0 ? 1 : -1;
        
        ctx.moveTo(cartX + (cartW/2 + 5) * dir, centerY);
        ctx.lineTo(cartX + (cartW/2 + 5 + fScale) * dir, centerY);
        
        // Arrow head
        ctx.lineTo(cartX + (cartW/2 + 5 + fScale) * dir - 10 * dir, centerY - 5);
        ctx.moveTo(cartX + (cartW/2 + 5 + fScale) * dir, centerY);
        ctx.lineTo(cartX + (cartW/2 + 5 + fScale) * dir - 10 * dir, centerY + 5);
        
        ctx.stroke();
    }
}

// Interactive Disturbances
let isDraggingCart = false;
let isDraggingBob = false;

simCanvas.addEventListener('mousedown', (e) => {
    const rect = simCanvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const centerY = height - 80;
    const centerX = width / 2;
    const cartX = centerX + currentState.x * zoom;
    const px = cartX + zoom * l_vis * Math.sin(currentState.theta);
    const py = centerY - zoom * l_vis * Math.cos(currentState.theta);

    // Check Bob click (dist < 25)
    if (Math.hypot(mx - px, my - py) < 25) {
        isDraggingBob = true;
    } 
    // Check Cart click 
    else if (Math.abs(mx - cartX) < 40 && Math.abs(my - centerY) < 25) {
        isDraggingCart = true;
    }
});

simCanvas.addEventListener('mousemove', (e) => {
    if (!isDraggingCart && !isDraggingBob) return;

    const rect = simCanvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const centerY = height - 80;
    const centerX = width / 2;

    if (isDraggingCart) {
        let desiredX = (mx - centerX) / zoom;
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ drag_cart_x: desiredX }));
        }
    } else if (isDraggingBob) {
        const cartX = centerX + currentState.x * zoom;
        // atan2(dx, dy) where dy = (centerY - my) because y is inverted
        let desiredTheta = Math.atan2(mx - cartX, centerY - my);
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ drag_bob_theta: desiredTheta }));
        }
    }
});

const endDrag = () => {
    if ((isDraggingCart || isDraggingBob) && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ release_drag: true }));
    }
    isDraggingCart = false;
    isDraggingBob = false;
};

simCanvas.addEventListener('mouseup', endDrag);
simCanvas.addEventListener('mouseleave', endDrag);
