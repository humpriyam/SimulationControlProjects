/**
 * Logic Gate Simulator Engine
 * Vanilla JS Canvas Implementation with Pan & Zoom
 */

const PIN_RADIUS = 6;
const GATE_WIDTH = 80;
const GATE_HEIGHT = 60;
const GRID_SIZE = 20;

const COLORS = {
    HIGH: '#3fb950',
    LOW: '#6e7681',
    WIRE: '#30363d',
    GATE_BG: 'rgba(22, 27, 34, 0.8)',
    HIGHLIGHT: 'rgba(168, 224, 99, 0.3)',
    LED_RED: '#ff2c2c',
    LED_GLOW: 'rgba(255, 44, 44, 0.6)'
};

class Pin {
    constructor(parent, x, y, isOutput) {
        this.parent = parent;
        this.x = x; // Relative to parent
        this.y = y;
        this.isOutput = isOutput;
        this.state = false;
        this.connectedTo = []; // Array of Wires
    }

    getGlobalPos() {
        return {
            x: this.parent.x + this.x,
            y: this.parent.y + this.y
        };
    }

    draw(ctx, isActive) {
        const pos = this.getGlobalPos();
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, PIN_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = this.state ? COLORS.HIGH : COLORS.LOW;
        ctx.fill();
        if (isActive) {
            ctx.strokeStyle = COLORS.HIGH;
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    }

    isMouseOver(mx, my) {
        const pos = this.getGlobalPos();
        const dist = Math.sqrt((pos.x - mx) ** 2 + (pos.y - my) ** 2);
        return dist < PIN_RADIUS * 2;
    }
}

class Gate {
    constructor(type, x, y) {
        this.type = type;
        this.x = Math.round(x / GRID_SIZE) * GRID_SIZE;
        this.y = Math.round(y / GRID_SIZE) * GRID_SIZE;
        this.inputs = [];
        this.outputs = [];
        this.frequency = 1.0; 
        this.initPins();
    }

    initPins() {
        switch (this.type) {
            case 'SWITCH':
                this.outputs.push(new Pin(this, GATE_WIDTH, GATE_HEIGHT / 2, true));
                break;
            case 'LED':
                this.inputs.push(new Pin(this, 0, GATE_HEIGHT / 2, false));
                break;
            case 'NOT':
                this.inputs.push(new Pin(this, 0, GATE_HEIGHT / 2, false));
                this.outputs.push(new Pin(this, GATE_WIDTH, GATE_HEIGHT / 2, true));
                break;
            case 'AND':
            case 'OR':
            case 'NAND':
            case 'NOR':
            case 'XOR':
            case 'XNOR':
                this.inputs.push(new Pin(this, 0, GATE_HEIGHT / 3, false));
                this.inputs.push(new Pin(this, 0, (GATE_HEIGHT / 3) * 2, false));
                this.outputs.push(new Pin(this, GATE_WIDTH, GATE_HEIGHT / 2, true));
                break;
            case 'CLOCK':
                this.outputs.push(new Pin(this, GATE_WIDTH, GATE_HEIGHT / 2, true));
                break;
        }
    }

    update() {
        const inStates = this.inputs.map(p => p.state);
        let outState = false;

        switch (this.type) {
            case 'SWITCH':
                outState = this.active || false;
                break;
            case 'CLOCK':
                const period = 1000 / this.frequency;
                outState = (Math.floor(Date.now() / (period / 2)) % 2 === 0);
                break;
            case 'AND': outState = inStates[0] && inStates[1]; break;
            case 'OR':  outState = inStates[0] || inStates[1]; break;
            case 'NOT': outState = !inStates[0]; break;
            case 'NAND': outState = !(inStates[0] && inStates[1]); break;
            case 'NOR':  outState = !(inStates[0] || inStates[1]); break;
            case 'XOR':  outState = inStates[0] !== inStates[1]; break;
            case 'XNOR': outState = inStates[0] === inStates[1]; break;
            case 'LED':  this.active = inStates[0]; break;
        }

        if (this.outputs.length > 0) {
            this.outputs[0].state = outState;
        }
    }

    draw(ctx, isSelected) {
        ctx.fillStyle = COLORS.GATE_BG;
        ctx.strokeStyle = isSelected ? COLORS.HIGH : COLORS.WIRE;
        ctx.lineWidth = 2;
        
        ctx.beginPath();
        ctx.roundRect(this.x, this.y, GATE_WIDTH, GATE_HEIGHT, 8);
        ctx.fill();
        ctx.stroke();

        if (this.type === 'LED' && this.active) {
            ctx.save();
            ctx.shadowBlur = 20;
            ctx.shadowColor = COLORS.LED_GLOW;
            ctx.fillStyle = COLORS.LED_RED;
            ctx.beginPath();
            ctx.arc(this.x + GATE_WIDTH / 2, this.y + GATE_HEIGHT / 2, 10, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        ctx.fillStyle = (this.type === 'LED' && this.active) ? COLORS.LED_RED : (this.type === 'SWITCH' && this.active ? COLORS.HIGH : '#fff');
        ctx.font = 'bold 13px Inter';
        ctx.textAlign = 'center';
        ctx.fillText(this.type, this.x + GATE_WIDTH / 2, this.y + GATE_HEIGHT / 2 + 5);

        this.inputs.forEach(p => p.draw(ctx));
        this.outputs.forEach(p => p.draw(ctx));
    }

    isMouseOver(mx, my) {
        return mx >= this.x && mx <= this.x + GATE_WIDTH &&
               my >= this.y && my <= this.y + GATE_HEIGHT;
    }
}

class Wire {
    constructor(startPin, endPin) {
        this.startPin = startPin;
        this.endPin = endPin;
    }

    update() {
        if (this.startPin.isOutput) {
            this.endPin.state = this.startPin.state;
        } else {
            this.startPin.state = this.endPin.state;
        }
    }

    draw(ctx, animOffset) {
        const start = this.startPin.getGlobalPos();
        const end = this.endPin.getGlobalPos();
        const isActive = this.startPin.state;
        
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.bezierCurveTo(
            start.x + 50, start.y,
            end.x - 50, end.y,
            end.x, end.y
        );
        
        if (isActive) {
            ctx.strokeStyle = COLORS.HIGH;
            ctx.lineWidth = 3;
            ctx.setLineDash([10, 8]);
            ctx.lineDashOffset = -animOffset;
            ctx.shadowBlur = 8;
            ctx.shadowColor = 'rgba(63, 185, 80, 0.4)';
        } else {
            ctx.strokeStyle = COLORS.WIRE;
            ctx.lineWidth = 2;
            ctx.setLineDash([]);
        }
        
        ctx.stroke();
        ctx.restore();
    }
}

class LogicEngine {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        this.gates = [];
        this.wires = [];
        
        this.selectedGate = null;
        this.selectedPin = null;
        this.draggedGate = null;
        this.tempWire = null;
        this.animOffset = 0;

        // Infinite Canvas State
        this.zoom = 1.0;
        this.pan = { x: 0, y: 0 };
        this.isPanning = false;
        this.lastMouse = { x: 0, y: 0 };

        // UI References
        this.propPanel = document.getElementById('propertiesPanel');
        this.propType = document.getElementById('propType');
        this.freqControl = document.getElementById('freqControl');
        this.freqSlider = document.getElementById('freqSlider');
        this.freqVal = document.getElementById('freqVal');
        this.zoomDisplay = document.getElementById('zoomLevel');
        this.deleteBtn = document.getElementById('deleteGate');

        this.init();
    }

    init() {
        this.resize();
        window.addEventListener('resize', () => this.resize());
        
        // Input Handling
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });
        
        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.handleRightClick(e);
        });

        if (this.freqSlider) {
            this.freqSlider.addEventListener('input', (e) => {
                if (this.selectedGate && this.selectedGate.type === 'CLOCK') {
                    this.selectedGate.frequency = parseFloat(e.target.value);
                    this.freqVal.textContent = this.selectedGate.frequency.toFixed(1);
                }
            });
        }
        
        if (this.deleteBtn) {
            this.deleteBtn.addEventListener('click', () => this.deleteSelected());
        }

        const container = document.getElementById('canvasContainer');
        if (container) {
            container.addEventListener('dragover', (e) => e.preventDefault());
            container.addEventListener('drop', (e) => this.handleDrop(e));
        }

        requestAnimationFrame(() => this.loop());
    }

    resize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
    }

    // Convert screen pixel to workspace pixel
    toWorkspace(mx, my) {
        return {
            x: (mx - this.pan.x) / this.zoom,
            y: (my - this.pan.y) / this.zoom
        };
    }

    handleWheel(e) {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        const zoomSpeed = 0.001;
        const oldZoom = this.zoom;
        this.zoom = Math.min(Math.max(this.zoom - e.deltaY * zoomSpeed, 0.2), 3.0);

        // Zoom towards mouse
        this.pan.x = mx - (mx - this.pan.x) * (this.zoom / oldZoom);
        this.pan.y = my - (my - this.pan.y) * (this.zoom / oldZoom);

        if (this.zoomDisplay) {
            this.zoomDisplay.textContent = `Zoom: ${Math.round(this.zoom * 100)}%`;
        }
    }

    handleDrop(e) {
        e.preventDefault();
        const type = e.dataTransfer.getData('type');
        const rect = this.canvas.getBoundingClientRect();
        const wsPos = this.toWorkspace(e.clientX - rect.left, e.clientY - rect.top);
        this.gates.push(new Gate(type, wsPos.x - GATE_WIDTH / 2, wsPos.y - GATE_HEIGHT / 2));
    }

    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const rawX = e.clientX - rect.left;
        const rawY = e.clientY - rect.top;
        const ws = this.toWorkspace(rawX, rawY);

        // Panning Detection (Middle Click or Alt+Click)
        if (e.button === 1 || (e.button === 0 && e.altKey)) {
            this.isPanning = true;
            this.lastMouse = { x: rawX, y: rawY };
            this.canvas.style.cursor = 'grabbing';
            return;
        }

        // Check for pin selection 
        for (const g of this.gates) {
            for (const p of [...g.inputs, ...g.outputs]) {
                if (p.isMouseOver(ws.x, ws.y)) {
                    this.selectedPin = p;
                    this.tempWire = { x: ws.x, y: ws.y };
                    return;
                }
            }
        }

        // Check for gate selection
        for (const g of this.gates) {
            if (g.isMouseOver(ws.x, ws.y)) {
                if (g.type === 'SWITCH') {
                    g.active = !g.active;
                }
                this.selectedGate = g;
                this.draggedGate = g;
                this.dragOffset = { x: ws.x - g.x, y: ws.y - g.y };
                this.showProperties(g);
                return;
            }
        }

        this.selectedGate = null;
        this.hideProperties();
    }

    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const rawX = e.clientX - rect.left;
        const rawY = e.clientY - rect.top;
        const ws = this.toWorkspace(rawX, rawY);

        if (this.isPanning) {
            this.pan.x += rawX - this.lastMouse.x;
            this.pan.y += rawY - this.lastMouse.y;
            this.lastMouse = { x: rawX, y: rawY };
            return;
        }

        if (this.draggedGate) {
            this.draggedGate.x = Math.round((ws.x - this.dragOffset.x) / GRID_SIZE) * GRID_SIZE;
            this.draggedGate.y = Math.round((ws.y - this.dragOffset.y) / GRID_SIZE) * GRID_SIZE;
        }

        if (this.tempWire) {
            this.tempWire.x = ws.x;
            this.tempWire.y = ws.y;
        }
    }

    handleMouseUp(e) {
        if (this.isPanning) {
            this.isPanning = false;
            this.canvas.style.cursor = 'crosshair';
            return;
        }

        const rect = this.canvas.getBoundingClientRect();
        const ws = this.toWorkspace(e.clientX - rect.left, e.clientY - rect.top);

        if (this.selectedPin) {
            for (const g of this.gates) {
                for (const p of [...g.inputs, ...g.outputs]) {
                    if (p !== this.selectedPin && p.isMouseOver(ws.x, ws.y)) {
                        const start = this.selectedPin;
                        const end = p;
                        if (start.isOutput !== end.isOutput) {
                             const inputPin = start.isOutput ? end : start;
                             this.wires = this.wires.filter(w => w.endPin !== inputPin && w.startPin !== inputPin);
                             this.wires.push(new Wire(start, end));
                        }
                    }
                }
            }
        }

        this.draggedGate = null;
        this.selectedPin = null;
        this.tempWire = null;
    }

    handleRightClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const ws = this.toWorkspace(e.clientX - rect.left, e.clientY - rect.top);

        this.gates = this.gates.filter(g => {
            if (g.isMouseOver(ws.x, ws.y)) {
                this.wires = this.wires.filter(w => w.startPin.parent !== g && w.endPin.parent !== g);
                if (this.selectedGate === g) {
                    this.selectedGate = null;
                    this.hideProperties();
                }
                return false;
            }
            return true;
        });
    }

    showProperties(gate) {
        if (!this.propPanel) return;
        this.propPanel.classList.add('show');
        this.propType.textContent = gate.type;
        
        if (gate.type === 'CLOCK') {
            this.freqControl.style.display = 'block';
            this.freqSlider.value = gate.frequency;
            this.freqVal.textContent = gate.frequency.toFixed(1);
        } else {
            this.freqControl.style.display = 'none';
        }
    }

    hideProperties() {
        if (this.propPanel) this.propPanel.classList.remove('show');
    }

    loop() {
        this.update();
        this.draw();
        this.animOffset = (this.animOffset + 0.6) % 32;
        requestAnimationFrame(() => this.loop());
    }

    update() {
        this.gates.forEach(g => {
            g.inputs.forEach(p => p.state = false);
        });

        for (let i = 0; i < 5; i++) {
            this.gates.forEach(g => g.update());
            this.wires.forEach(w => w.update());
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.save();
        this.ctx.translate(this.pan.x, this.pan.y);
        this.ctx.scale(this.zoom, this.zoom);

        // Infinite Grid Rendering
        const viewScale = 1 / this.zoom;
        const startX = -this.pan.x * viewScale;
        const startY = -this.pan.y * viewScale;
        const endX = startX + this.canvas.width * viewScale;
        const endY = startY + this.canvas.height * viewScale;

        this.ctx.beginPath();
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
        this.ctx.lineWidth = 1 * viewScale;

        for (let x = Math.floor(startX / GRID_SIZE) * GRID_SIZE; x < endX; x += GRID_SIZE) {
            this.ctx.moveTo(x, startY);
            this.ctx.lineTo(x, endY);
        }
        for (let y = Math.floor(startY / GRID_SIZE) * GRID_SIZE; y < endY; y += GRID_SIZE) {
            this.ctx.moveTo(startX, y);
            this.ctx.lineTo(endX, y);
        }
        this.ctx.stroke();

        // Components
        this.wires.forEach(w => w.draw(this.ctx, this.animOffset));
        
        if (this.selectedPin && this.tempWire) {
            const pos = this.selectedPin.getGlobalPos();
            this.ctx.beginPath();
            this.ctx.moveTo(pos.x, pos.y);
            this.ctx.lineTo(this.tempWire.x, this.tempWire.y);
            this.ctx.strokeStyle = COLORS.HIGH;
            this.ctx.setLineDash([5, 5]);
            this.ctx.stroke();
            this.ctx.setLineDash([]);
        }

        this.gates.forEach(g => g.draw(this.ctx, g === this.selectedGate));
        if (this.selectedPin) this.selectedPin.draw(this.ctx, true);

        this.ctx.restore();
    }

    clear() {
        this.gates = [];
        this.wires = [];
        this.hideProperties();
    }

    reset() {
        this.gates.forEach(g => {
            g.active = false;
        });
    }

    deleteSelected() {
        if (!this.selectedGate) return;
        const gateToDelete = this.selectedGate;
        this.gates = this.gates.filter(g => g !== gateToDelete);
        this.wires = this.wires.filter(w => w.startPin.parent !== gateToDelete && w.endPin.parent !== gateToDelete);
        this.selectedGate = null;
        this.hideProperties();
    }
}

window.addEventListener('load', () => {
    const engine = new LogicEngine('logicCanvas');
    
    const clearBtn = document.getElementById('clearCanvas');
    const resetBtn = document.getElementById('resetSim');
    
    if (clearBtn) clearBtn.addEventListener('click', () => engine.clear());
    if (resetBtn) resetBtn.addEventListener('click', () => engine.reset());

    document.querySelectorAll('.gate-tool').forEach(tool => {
        tool.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('type', tool.dataset.type);
        });
    });
});
