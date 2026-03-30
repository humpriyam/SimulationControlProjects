const simCanvas = document.getElementById('simCanvas');
const ctx = simCanvas.getContext('2d');
let width = simCanvas.width = simCanvas.offsetWidth;
let height = simCanvas.height = simCanvas.offsetHeight;

window.addEventListener('resize', () => {
    width = simCanvas.width = simCanvas.offsetWidth;
    height = simCanvas.height = simCanvas.offsetHeight;
});

// UI Elements
const getElem = id => document.getElementById(id);
const lengthRange = getElem('lengthRange'), lengthVal = getElem('lengthVal');
const massRange = getElem('massRange'), massVal = getElem('massVal');
const dampingRange = getElem('dampingRange'), dampingVal = getElem('dampingVal');
const gravityRange = getElem('gravityRange'), gravityVal = getElem('gravityVal');

const solverSelect = getElem('solverSelect');
const timeStepInput = getElem('timeStepInput');
const timeRateInput = getElem('timeRateInput');

const showClockCheck = getElem('showClockCheck');
const panZoomCheck = getElem('panZoomCheck');
const playPauseBtn = getElem('playPauseBtn');

let isPaused = false;
playPauseBtn.addEventListener('click', () => {
    isPaused = !isPaused;
    playPauseBtn.innerHTML = isPaused ? "▶ Start Simulation" : "⏹ Stop Simulation";
    playPauseBtn.style.backgroundColor = isPaused ? "#bc8cff" : "#d73a49";
    sendVal('is_paused', isPaused);
});

// Network
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const ws = new WebSocket(`${protocol}//${window.location.host}/ws/basic`);

ws.onopen = () => { console.log("Connected to basic pendulum"); };

// Helpers
const sendVal = (key, val) => {
    if (ws.readyState === WebSocket.OPEN) {
        let obj = {}; obj[key] = val;
        ws.send(JSON.stringify(obj));
    }
};

const bindSlider = (range, textElem, key) => {
    range.addEventListener('input', (e) => {
        textElem.textContent = e.target.value;
        sendVal(key, parseFloat(e.target.value));
    });
};

bindSlider(lengthRange, lengthVal, 'length');
bindSlider(massRange, massVal, 'mass');
bindSlider(dampingRange, dampingVal, 'damping');
bindSlider(gravityRange, gravityVal, 'gravity');

solverSelect.addEventListener('change', e => sendVal('solver', e.target.value));
timeStepInput.addEventListener('change', e => sendVal('time_step', parseFloat(e.target.value)));
timeRateInput.addEventListener('change', e => sendVal('time_rate', parseFloat(e.target.value)));

// Chart Setup
const ctxChart = document.getElementById('chartCanvas').getContext('2d');
const chart = new Chart(ctxChart, {
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            label: 'Angle (rad)',
            data: [],
            borderColor: '#58a6ff',
            borderWidth: 2,
            tension: 0.4,
            pointRadius: 0
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

let currentState = { theta: 0.5, omega: 0, time: 0 };
let camera = { zoom: 100, x: width / 2, y: 100 }; // 1 meter = 100px

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    const timeChanged = currentState ? (data.time > currentState.time) : true;
    currentState = data;

    // Chart update only if time advances (simulation is running)
    if (timeChanged || isDraggingBob) {
        const maxDataPoints = 3125; // Store 50 seconds at ~60fps
        chart.data.labels.push(data.time.toFixed(2));
        
        chart.data.datasets[0].data.push(data.theta);
        if (chart.data.labels.length > maxDataPoints) {
            chart.data.labels.shift();
            chart.data.datasets[0].data.shift();
        }
        chart.update();
    }

    drawSim();
};

// Pan and Zoom logic
simCanvas.addEventListener('wheel', (e) => {
    if (!panZoomCheck.checked) return;
    e.preventDefault();
    const zoomFactor = 1.1;
    if (e.deltaY < 0) camera.zoom *= zoomFactor;
    else camera.zoom /= zoomFactor;
});

let isPanning = false;
let isDraggingBob = false;

// Right-click pushes visuals
let rightClickVisuals = [];

function getMousePos(e) {
    const rect = simCanvas.getBoundingClientRect();
    return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
}

// Disable context menu for clean right clicking
simCanvas.addEventListener('contextmenu', e => e.preventDefault());

simCanvas.addEventListener('mousedown', (e) => {
    const pos = getMousePos(e);
    
    if (panZoomCheck.checked && e.button === 1) { // Middle click pan
        isPanning = true;
        return;
    }
    
    if (e.button === 0) { // Left click: drag bob directly
        const l = parseFloat(lengthRange.value);
        const massScaled = parseFloat(massRange.value) * 8 + 12;
        const bobPx = camera.x + camera.zoom * l * Math.sin(currentState.theta);
        const bobPy = camera.y + camera.zoom * l * Math.cos(currentState.theta);
        
        const distToBob = Math.hypot(pos.x - bobPx, pos.y - bobPy);
        if (distToBob <= massScaled + 15) { // Hitbox generosity
            isDraggingBob = true;
            const dx = pos.x - camera.x;
            const dy = pos.y - camera.y;
            const angle = Math.atan2(dx, dy); 
            sendVal('drag_theta', angle);
            currentState.theta = angle;
        }
    } else if (e.button === 2) { // Right click: apply force towards mouse
        // True tangential force calculation based on cursor vector
        const dx = pos.x - camera.x;
        const dy = pos.y - camera.y;

        // Tangent vector for increasing theta is (cos(theta), -sin(theta))
        const tangentialForce = dx * Math.cos(currentState.theta) - dy * Math.sin(currentState.theta);
        const impulse = tangentialForce * 0.005; // Scaling factor
        
        rightClickVisuals.push({x: pos.x, y: pos.y, alpha: 1.0, rad: 0});

        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ push_impulse: impulse }));
        }
    }
});

simCanvas.addEventListener('mousemove', (e) => {
    const pos = getMousePos(e);
    
    if (isPanning) {
        camera.x += e.movementX;
        camera.y += e.movementY;
    }

    if (isDraggingBob) {
        // Calculate new theta based on mouse relative to pivot
        const dx = pos.x - camera.x;
        const dy = pos.y - camera.y;
        const angle = Math.atan2(dx, dy); // dy is positive downwards
        sendVal('drag_theta', angle);
        currentState.theta = angle;
    }
});

window.addEventListener('mouseup', (e) => {
    if (e.button === 1) isPanning = false;

    if (e.button === 0 && isDraggingBob) {
        isDraggingBob = false;
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ release_drag: true }));
        }
    }
});

function drawSim() {
    ctx.clearRect(0, 0, width, height);

    const l_vis = parseFloat(lengthRange.value);
    const massScaled = parseFloat(massRange.value) * 8 + 12;
    
    const px = camera.x + camera.zoom * l_vis * Math.sin(currentState.theta);
    const py = camera.y + camera.zoom * l_vis * Math.cos(currentState.theta);

    // Draw reference line optionally
    ctx.strokeStyle = 'rgba(139, 148, 158, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(camera.x, camera.y);
    ctx.lineTo(camera.x, camera.y + camera.zoom * 3);
    ctx.stroke();

    // Draw pivot
    ctx.fillStyle = '#8b949e';
    ctx.beginPath();
    ctx.arc(camera.x, camera.y, 8, 0, Math.PI * 2);
    ctx.fill();

    // Draw rod
    ctx.strokeStyle = '#c9d1d9';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(camera.x, camera.y);
    ctx.lineTo(px, py);
    ctx.stroke();

    // Draw right-click visuals (expanding circle)
    for (let i = rightClickVisuals.length - 1; i >= 0; i--) {
        let v = rightClickVisuals[i];
        ctx.strokeStyle = `rgba(46, 160, 67, ${v.alpha})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(v.x, v.y, v.rad, 0, Math.PI * 2);
        ctx.stroke();
        
        v.rad += 2;
        v.alpha -= 0.05;
        if (v.alpha <= 0) rightClickVisuals.splice(i, 1);
    }

    // Draw mass
    ctx.fillStyle = isDraggingBob ? '#bc8cff' : '#58a6ff';
    ctx.shadowBlur = isDraggingBob ? 25 : 15;
    ctx.shadowColor = isDraggingBob ? 'rgba(188, 140, 255, 0.8)' : 'rgba(88, 166, 255, 0.6)';
    ctx.beginPath();
    ctx.arc(px, py, massScaled, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    
    ctx.strokeStyle = isDraggingBob ? '#a371f7' : '#3182ce';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw clock
    if (showClockCheck.checked) {
        ctx.fillStyle = '#c9d1d9';
        ctx.font = '16px Inter';
        ctx.fillText(`Time: ${currentState.time.toFixed(2)} s`, 20, 30);
    }
}
