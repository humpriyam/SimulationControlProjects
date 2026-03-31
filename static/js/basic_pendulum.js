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
const showAngleCheck = getElem('showAngleCheck');
const panZoomCheck = getElem('panZoomCheck');
const playPauseBtn = getElem('playPauseBtn');
const resetBtn = getElem('resetBtn');

let isPaused = false;
playPauseBtn.addEventListener('click', () => {
    isPaused = !isPaused;
    playPauseBtn.innerHTML = isPaused ? "▶ Start Simulation" : "⏹ Stop Simulation";
    playPauseBtn.style.backgroundColor = isPaused ? "#bc8cff" : "#d73a49";

    // Toggle reset button state
    resetBtn.disabled = !isPaused;
    resetBtn.style.opacity = isPaused ? "1" : "0.5";
    resetBtn.style.cursor = isPaused ? "pointer" : "not-allowed";

    sendVal('is_paused', isPaused);
});

resetBtn.addEventListener('click', () => {
    if (!isPaused) return; // Only allow reset when paused

    // Reset sliders and inputs
    lengthRange.value = "1.00"; lengthVal.textContent = "1.00";
    massRange.value = "1.00"; massVal.textContent = "1.00";
    dampingRange.value = "0.00"; dampingVal.textContent = "0.00";
    gravityRange.value = "9.80"; gravityVal.textContent = "9.80";
    
    solverSelect.value = "modified_euler";
    timeStepInput.value = "0.025";
    timeRateInput.value = "1.00";

    // Reset play/pause state
    isPaused = false;
    playPauseBtn.innerHTML = "⏹ Stop Simulation";
    playPauseBtn.style.backgroundColor = "#d73a49";
    resetBtn.disabled = true;
    resetBtn.style.opacity = "0.5";
    resetBtn.style.cursor = "not-allowed";

    // Clear chart
    if (typeof chart !== 'undefined') {
        chart.data.labels = [];
        chart.data.datasets[0].data = [];
        chart.update();
    }
    if (typeof degreeChart !== 'undefined') {
        degreeChart.data.labels = [];
        degreeChart.data.datasets[0].data = [];
        degreeChart.update();
    }
    
    // Clear visuals and camera
    rightClickVisuals = [];
    camera.x = width / 2;
    camera.y = 100;
    camera.zoom = 100;

    // Send reset message to backend
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ reset: true }));
    }
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
            label: 'Angular Velocity (rad/s)',
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
            x: { 
                display: true, 
                title: { display: true, text: 'Time (s)', color: '#c9d1d9' },
                grid: { color: '#30363d' },
                ticks: { color: '#c9d1d9', autoSkip: true, maxTicksLimit: 10 }
            },
            y: { 
                title: { display: true, text: 'Angular Velocity (rad/s)', color: '#c9d1d9' },
                grid: { color: '#30363d' }, 
                ticks: { color: '#c9d1d9' } 
            }
        },
        plugins: { legend: { labels: { color: '#c9d1d9' } } }
    }
});

const ctxDegreeChart = document.getElementById('degreeChartCanvas').getContext('2d');
const degreeChart = new Chart(ctxDegreeChart, {
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            label: 'Angle (degrees)',
            data: [],
            borderColor: '#ff7b72',
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
            x: { 
                display: true, 
                title: { display: true, text: 'Time (s)', color: '#c9d1d9' },
                grid: { color: '#30363d' },
                ticks: { color: '#c9d1d9', autoSkip: true, maxTicksLimit: 10 }
            },
            y: { 
                title: { display: true, text: 'Angle (degrees)', color: '#c9d1d9' },
                grid: { color: '#30363d' }, 
                ticks: { color: '#c9d1d9' } 
            }
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
        
        let rads = data.theta % (2 * Math.PI);
        if (rads > Math.PI) rads -= 2 * Math.PI;
        else if (rads < -Math.PI) rads += 2 * Math.PI;
        const degs = rads * 180 / Math.PI;

        chart.data.labels.push(data.time.toFixed(2));
        degreeChart.data.labels.push(data.time.toFixed(2));
        
        chart.data.datasets[0].data.push(data.omega);
        degreeChart.data.datasets[0].data.push(degs);
        
        if (chart.data.labels.length > maxDataPoints) {
            chart.data.labels.shift();
            chart.data.datasets[0].data.shift();
            degreeChart.data.labels.shift();
            degreeChart.data.datasets[0].data.shift();
        }
        chart.update();
        degreeChart.update();
    }

    drawSim();
};

// Save Chart Functionality
function downloadChart(canvasId, filename) {
    const canvas = document.getElementById(canvasId);
    
    // Create a temporary link and trigger download
    const link = document.createElement('a');
    link.download = filename;
    
    // To ensure the background isn't transparent (which looks bad in some viewers),
    // we take the canvas and draw it onto a new canvas with a background.
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

document.getElementById('saveVelocityChart').addEventListener('click', () => {
    downloadChart('chartCanvas', `pendulum_velocity_${new Date().toISOString().slice(0,10)}.png`);
});

document.getElementById('saveAngleChart').addEventListener('click', () => {
    downloadChart('degreeChartCanvas', `pendulum_angle_${new Date().toISOString().slice(0,10)}.png`);
});

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
        
        // Increased the scaling factor significantly so right click provides a satisfying, visible kick
        const impulse = tangentialForce * 0.05; 
        
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

    // Draw Compass (Protractor)
    ctx.strokeStyle = 'rgba(139, 148, 158, 0.2)';
    ctx.lineWidth = 1;
    const compassRadius = camera.zoom * 1.5; // 1.5m radius compass visually
    ctx.beginPath();
    ctx.arc(camera.x, camera.y, compassRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = 'rgba(139, 148, 158, 0.6)';
    ctx.font = '11px Inter';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    for (let angleDeg = -180; angleDeg < 180; angleDeg += 30) {
        let angleRad = angleDeg * Math.PI / 180;
        let cx = camera.x + compassRadius * Math.sin(angleRad);
        let cy = camera.y + compassRadius * Math.cos(angleRad);
        let ix = camera.x + (compassRadius - 10) * Math.sin(angleRad);
        let iy = camera.y + (compassRadius - 10) * Math.cos(angleRad);
        let tx = camera.x + (compassRadius + 18) * Math.sin(angleRad);
        let ty = camera.y + (compassRadius + 18) * Math.cos(angleRad);

        ctx.strokeStyle = 'rgba(139, 148, 158, 0.4)';
        ctx.beginPath();
        ctx.moveTo(ix, iy);
        ctx.lineTo(cx, cy);
        ctx.stroke();
        
        ctx.fillText(`${angleDeg}°`, tx, ty);
    }

    // Restore text align for UI elements
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

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

    // Draw clock and angle
    let textY = 30;
    ctx.fillStyle = '#c9d1d9';
    ctx.font = '16px Inter';

    if (showClockCheck.checked) {
        ctx.fillText(`Time: ${currentState.time.toFixed(2)} s`, 20, textY);
        textY += 24;
    }

    if (showAngleCheck && showAngleCheck.checked) {
        // Normalize theta to [-pi, pi] for display
        let rads = currentState.theta % (2 * Math.PI);
        if (rads > Math.PI) rads -= 2 * Math.PI;
        else if (rads < -Math.PI) rads += 2 * Math.PI;

        const degs = rads * 180 / Math.PI;
        // Using string interpolation for text
        ctx.fillText(`Angle: ${degs.toFixed(1)}° (${rads.toFixed(2)} rad)`, 20, textY);
    }
}
