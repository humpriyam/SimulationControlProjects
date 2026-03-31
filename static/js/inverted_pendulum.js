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
const fitScreenBtn = document.getElementById('fitScreenBtn');
const clearChartBtn = document.getElementById('clearChartBtn');
const trackCartBtn = document.getElementById('trackCartBtn');

let pidOn = false;
let isPaused = false;
let isTrackCart = false;

// Chart Setup
// Chart 0-360 Setup
const ctx360 = document.getElementById('chartCanvas360').getContext('2d');
const chart360 = new Chart(ctx360, {
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            label: 'Angle (0-360)',
            data: [],
            borderColor: '#58a6ff',
            borderWidth: 1.5,
            tension: 0.1,
            pointRadius: 0
        },
        {
            label: 'Target',
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
        animation: { duration: 0 },
        scales: {
            x: { 
                display: true, 
                title: { display: true, text: 'Time (s)', color: '#c9d1d9' },
                grid: { color: '#30363d' },
                ticks: { color: '#c9d1d9', autoSkip: true, maxTicksLimit: 10 }
            },
            y: {
                type: 'linear', min: -10, max: 370,
                title: { display: true, text: 'Degree (0-360°)', color: '#58a6ff' },
                grid: { color: '#30363d' }, 
                ticks: { color: '#58a6ff' }
            }
        },
        plugins: { legend: { labels: { color: '#c9d1d9', font: { size: 10 } } } }
    }
});

// Chart ±180 Setup 
const ctx180 = document.getElementById('chartCanvas180').getContext('2d');
const chart180 = new Chart(ctx180, {
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            label: 'Angle (±180)',
            data: [],
            borderColor: '#bc8cff',
            borderWidth: 2,
            tension: 0.3,
            pointRadius: 0
        },
        {
            label: 'Target (0)',
            data: [],
            borderColor: '#2ea043',
            borderWidth: 1,
            borderDash: [2, 2],
            pointRadius: 0,
            fill: false
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 0 },
        scales: {
            x: { 
                display: true, 
                title: { display: true, text: 'Time (s)', color: '#c9d1d9' },
                grid: { color: '#30363d' },
                ticks: { color: '#c9d1d9', autoSkip: true, maxTicksLimit: 10 }
            },
            y: {
                type: 'linear', min: -200, max: 200,
                title: { display: true, text: 'Angle (±180°)', color: '#bc8cff' },
                grid: { color: '#30363d' }, 
                ticks: { color: '#bc8cff' }
            }
        },
        plugins: { legend: { labels: { color: '#c9d1d9', font: { size: 10 } } } }
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
    isPaused = true;
    playPauseBtn.textContent = '▶ Play';
    playPauseBtn.style.backgroundColor = '#2ea043';

    // Auto-clear chart on reset
    clearChartData();
});

function clearChartData() {
    [chart360, chart180].forEach(ch => {
        ch.data.labels = [];
        ch.data.datasets.forEach(ds => ds.data = []);
        ch.update();
    });
}

clearChartBtn.addEventListener('click', clearChartData);

zoomInBtn.addEventListener('click', () => { zoom *= 1.2; drawSim(); });
zoomOutBtn.addEventListener('click', () => { zoom /= 1.2; drawSim(); });

trackCartBtn.addEventListener('click', () => {
    isTrackCart = !isTrackCart;
    trackCartBtn.textContent = `Track Cart: ${isTrackCart ? 'ON' : 'OFF'}`;
    trackCartBtn.style.backgroundColor = isTrackCart ? '#1f6feb' : '#21262d';
    drawSim();
});

fitScreenBtn.addEventListener('click', () => {
    const trackLimit = parseFloat(trackRange.value);
    const poleLength = parseFloat(lengthRange.value);

    // We want to fit the entire track and the full swing of the pendulum.
    // Total horizontal span: 2 * trackLimit
    // Total vertical span: 2 * poleLength

    const margin = 0.85; // Use 85% of screen for better aesthetics
    const zoomX = (width * margin) / (2 * trackLimit);
    const zoomY = (height * margin) / (2 * poleLength);

    zoom = Math.min(zoomX, zoomY);
    drawSim();
});

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

    // Update Charts (Only if not paused)
    if (!isPaused) {
        const currentTick = data.time.toFixed(1);
        const angle180 = normalizeTheta(data.theta) * 180 / Math.PI;
        const angle360 = (angle180 + 360) % 360;

        [chart360, chart180].forEach((ch, idx) => {
            ch.data.labels.push(currentTick);
            const val = (idx === 0) ? angle360 : angle180;
            ch.data.datasets[0].data.push(val);
            ch.data.datasets[1].data.push(0.0);

            const MAX_POINTS = 5000;
            if (ch.data.labels.length > MAX_POINTS) {
                ch.data.labels.shift();
                ch.data.datasets.forEach(ds => ds.data.shift());
            }

            if (ch.data.labels.length < 500 || ch.data.labels.length % 2 === 0) {
                ch.update('none');
            }
        });
    }

    drawSim();
};

// Save Chart Functionality
function downloadChart(canvasId, filename) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    
    // Create a temporary link and trigger download
    const link = document.createElement('a');
    link.download = filename;
    
    // Create temp canvas to add background
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    
    // Draw background
    tempCtx.fillStyle = '#0d1117'; // Match simulation panel background
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    
    // Draw original canvas over it
    tempCtx.drawImage(canvas, 0, 0);
    
    link.href = tempCanvas.toDataURL('image/png');
    link.click();
}

document.getElementById('save360Chart').addEventListener('click', () => {
    downloadChart('chartCanvas360', `inverted_pendulum_360_${new Date().toISOString().slice(0,10)}.png`);
});

document.getElementById('save180Chart').addEventListener('click', () => {
    downloadChart('chartCanvas180', `inverted_pendulum_180_${new Date().toISOString().slice(0,10)}.png`);
});

function drawSim() {
    ctx.clearRect(0, 0, width, height);

    const centerY = height / 2;
    const centerX = width / 2;
    
    // Viewport logic: if tracking, keep cart at centerX
    const viewportX = isTrackCart ? centerX - currentState.x * zoom : centerX;
    
    const trackLimitPx = trackRange.value * zoom;

    // Draw Track Limits
    ctx.strokeStyle = '#484f58';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(viewportX - trackLimitPx, centerY);
    ctx.lineTo(viewportX + trackLimitPx, centerY);
    ctx.stroke();

    // Draw Linear Scale (Meter Ticks)
    ctx.fillStyle = '#8b949e';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    const limitMeters = Math.floor(trackRange.value);
    
    // Optimize tick drawing for long tracks (only draw what's in viewport)
    const viewWidthMeters = (width / zoom) + 10;
    const startM = Math.max(-limitMeters, Math.floor(currentState.x - viewWidthMeters/2));
    const endM = Math.min(limitMeters, Math.ceil(currentState.x + viewWidthMeters/2));

    for (let i = -limitMeters; i <= limitMeters; i++) {
        // Only draw visible ticks if 100m track
        if (limitMeters > 20) {
            if (i < startM || i > endM) continue;
        }
        
        const tickX = viewportX + i * zoom;
        ctx.fillRect(tickX - 1, centerY, 2, 8);
        if (i % 2 === 0 || limitMeters <= 5) { // Show text on every tick if small, else every 2 meters
            ctx.fillText(i + "m", tickX, centerY + 20);
        }
    }

    // Draw Track Bounds (Stoppers)
    const isAtLeft = currentState.x <= -parseFloat(trackRange.value) + 0.001;
    const isAtRight = currentState.x >= parseFloat(trackRange.value) - 0.001;

    // Draw Left Stopper
    ctx.fillStyle = isAtLeft ? '#ff7b72' : '#da3633';
    if (isAtLeft) {
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ff7b72';
    }
    ctx.fillRect(viewportX - trackLimitPx - 5, centerY - 10, 10, 20);
    ctx.shadowBlur = 0;

    // Draw Right Stopper
    ctx.fillStyle = isAtRight ? '#ff7b72' : '#da3633';
    if (isAtRight) {
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ff7b72';
    }
    ctx.fillRect(viewportX + trackLimitPx - 5, centerY - 10, 10, 20);
    ctx.shadowBlur = 0;

    // Cart Params
    const cartX = viewportX + currentState.x * zoom;
    const cartW = 60;
    const cartH = 30;

    // Draw Cart
    ctx.fillStyle = '#8b949e';
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'rgba(139, 148, 158, 0.4)';
    ctx.fillRect(cartX - cartW / 2, centerY - cartH / 2, cartW, cartH);
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
        const angle180 = normalizeTheta(currentState.theta) * 180 / Math.PI;
        const angle360 = (angle180 + 360) % 360;

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
        const startAng = -Math.PI / 2;
        const endAng = -Math.PI / 2 + currentState.theta;
        ctx.arc(0, 0, radius, startAng, endAng, currentState.theta < 0);
        ctx.stroke();

        // Draw Angle Text (Consolidated format)
        ctx.fillStyle = '#58a6ff';
        ctx.font = 'bold 15px Inter';
        ctx.textAlign = 'center';

        ctx.fillText(`angle: ${angle180.toFixed(1)}° (${angle360.toFixed(1)}°)`, 0, -radius - 18);

        ctx.restore();
    }

    // Force Indicator
    if (pidOn && Math.abs(currentState.force) > 0.5) {
        ctx.strokeStyle = currentState.force > 0 ? '#2ea043' : '#da3633';
        ctx.lineWidth = 4;
        ctx.beginPath();

        const fScale = Math.min(Math.abs(currentState.force) * 2, 100);
        const dir = currentState.force > 0 ? 1 : -1;

        ctx.moveTo(cartX + (cartW / 2 + 5) * dir, centerY);
        ctx.lineTo(cartX + (cartW / 2 + 5 + fScale) * dir, centerY);

        // Arrow head
        ctx.lineTo(cartX + (cartW / 2 + 5 + fScale) * dir - 10 * dir, centerY - 5);
        ctx.moveTo(cartX + (cartW / 2 + 5 + fScale) * dir, centerY);
        ctx.lineTo(cartX + (cartW / 2 + 5 + fScale) * dir - 10 * dir, centerY + 5);

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

    const centerY = height / 2;
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

    const centerY = height / 2;
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
