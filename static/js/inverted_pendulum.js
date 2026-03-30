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
const torqueDisplay = document.getElementById('torqueDisplay');

let pidOn = false;

// Chart Setup
const ctxChart = document.getElementById('chartCanvas').getContext('2d');
const chart = new Chart(ctxChart, {
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            label: 'Angle (rad)',
            data: [],
            borderColor: '#bc8cff',
            borderWidth: 2,
            tension: 0.4,
            pointRadius: 0
        },
        {
            label: 'Target (π)',
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
            x: {
                display: false
            },
            y: {
                min: 0,
                max: 6.28,
                grid: { color: '#30363d' },
                ticks: { color: '#c9d1d9' }
            }
        },
        plugins: {
            legend: { labels: { color: '#c9d1d9' } }
        }
    }
});

// WebSocket Connection
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const ws = new WebSocket(`${protocol}//${window.location.host}/ws/inverted`);

ws.onopen = () => {
    console.log("Connected to inverted pendulum physics engine");
};

// UI Events
togglePIDBtn.addEventListener('click', () => {
    pidOn = !pidOn;
    togglePIDBtn.textContent = `PID: ${pidOn ? 'ON' : 'OFF'}`;
    togglePIDBtn.className = `btn ${pidOn ? 'on' : 'off'}`;
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ pid_on: pidOn }));
    }
});

const sendFloatParam = (key, val) => {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ [key]: parseFloat(val) }));
    }
};

kpRange.addEventListener('input', (e) => {
    kpVal.textContent = e.target.value;
    sendFloatParam('kp', e.target.value);
});
kiRange.addEventListener('input', (e) => {
    kiVal.textContent = e.target.value;
    sendFloatParam('ki', e.target.value);
});
kdRange.addEventListener('input', (e) => {
    kdVal.textContent = e.target.value;
    sendFloatParam('kd', e.target.value);
});

let currentState = { theta: Math.PI, time: 0, torque: 0 };
let l_vis = 1.0; 

function normalizeTheta(th) {
    let res = th % (2 * Math.PI);
    if (res < 0) res += 2 * Math.PI;
    return res;
}

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    currentState = data;

    torqueDisplay.textContent = data.torque.toFixed(2);

    // Update Chart
    const maxDataPoints = 150;
    chart.data.labels.push(data.time.toFixed(1));
    
    let plotTheta = normalizeTheta(data.theta);
    
    chart.data.datasets[0].data.push(plotTheta);
    chart.data.datasets[1].data.push(Math.PI); // Target line
    
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

    const pivotX = width / 2;
    const pivotY = height - 50; // Pin at bottom
    
    const scale = 180; 
    const px = pivotX + scale * l_vis * Math.sin(currentState.theta);
    const py = pivotY + scale * l_vis * Math.cos(currentState.theta);

    // Base
    ctx.fillStyle = '#8b949e';
    ctx.fillRect(pivotX - 30, pivotY - 10, 60, 20);

    // Rod
    ctx.strokeStyle = '#c9d1d9';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(pivotX, pivotY);
    ctx.lineTo(px, py);
    ctx.stroke();

    // Mass
    ctx.fillStyle = '#bc8cff';
    ctx.shadowBlur = 20;
    ctx.shadowColor = 'rgba(188, 140, 255, 0.7)';
    ctx.beginPath();
    ctx.arc(px, py, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    
    ctx.strokeStyle = '#a371f7';
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // Torque visual indicator (wheel/arrow at pivot)
    if (pidOn && Math.abs(currentState.torque) > 0.5) {
        ctx.strokeStyle = currentState.torque > 0 ? '#2ea043' : '#da3633';
        ctx.lineWidth = 4;
        ctx.beginPath();
        const r = 30;
        if (currentState.torque > 0) {
            ctx.arc(pivotX, pivotY, r, Math.PI, Math.PI + 1.5);
            // Arrow head
            ctx.lineTo(pivotX - r + 10, pivotY - 5);
        } else {
            ctx.arc(pivotX, pivotY, r, 0, -1.5, true);
            // Arrow head
            ctx.lineTo(pivotX + r - 10, pivotY - 5);
        }
        ctx.stroke();
    }
}

// Interactive Disturbances
let isDragging = false;
let lastMouseX = 0;

simCanvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    lastMouseX = e.clientX;
});
simCanvas.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - lastMouseX;
    lastMouseX = e.clientX;
    
    if (ws.readyState === WebSocket.OPEN && Math.abs(dx) > 0) {
        ws.send(JSON.stringify({ disturbance: dx * 0.1 }));
    }
});
simCanvas.addEventListener('mouseup', () => {
    isDragging = false;
});
simCanvas.addEventListener('mouseleave', () => {
    isDragging = false;
});
