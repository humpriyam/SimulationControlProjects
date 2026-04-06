/**
 * Logic Fundamentals Interactive Engine - Decentralized Version
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Global State (for Top Level Gate Cards)
    const globalState = { A: false, B: false };
    const btnA = document.getElementById('btnA');
    const btnB = document.getElementById('btnB');

    // 2. Local State Registry (for SVG Schematics)
    const schematicStates = {};

    // Logic Functions
    const logic = {
        AND: (a, b) => a && b,
        OR: (a, b) => a || b,
        NOT: (a) => !a,
        NAND: (a, b) => !(a && b),
        NOR: (a, b) => !(a || b),
        XOR: (a, b) => a !== b,
        XNOR: (a, b) => a === b
    };

    /**
     * Calculates all intermediate signals for a given set of inputs
     */
    function getSignalPropagation(A, B) {
        const s = { A, B };

        // --- NAND Constructions ---
        s.NOT_OUT = logic.NAND(A, A);
        s.AND_S1 = logic.NAND(A, B);
        s.AND_OUT = logic.NAND(s.AND_S1, s.AND_S1);
        s.OR_S1 = logic.NAND(A, A);
        s.OR_S2 = logic.NAND(B, B);
        s.OR_OUT = logic.NAND(s.OR_S1, s.OR_S2);
        s.XOR_S1 = logic.NAND(A, B);
        s.XOR_S2 = logic.NAND(A, s.XOR_S1);
        s.XOR_S3 = logic.NAND(B, s.XOR_S1);
        s.XOR_OUT = logic.NAND(s.XOR_S2, s.XOR_S3);

        // --- NOR Constructions ---
        s.NOR_NOT_OUT = logic.NOR(A, A);
        s.NOR_OR_S1 = logic.NOR(A, B);
        s.NOR_OR_OUT = logic.NOR(s.NOR_OR_S1, s.NOR_OR_S1);
        s.NOR_AND_S1 = logic.NOR(A, A);
        s.NOR_AND_S2 = logic.NOR(B, B);
        s.NOR_AND_OUT = logic.NOR(s.NOR_AND_S1, s.NOR_AND_S2);
        s.XNOR_S1 = logic.NOR(A, B);
        s.XNOR_S2 = logic.NOR(A, s.XNOR_S1);
        s.XNOR_S3 = logic.NOR(B, s.XNOR_S1);
        s.XNOR_OUT = logic.NOR(s.XNOR_S2, s.XNOR_S3);

        // --- Analysis ---
        s.ANA_S1 = !A;
        s.ANA_S2 = !B;
        s.ANA_S3 = A && !B;
        s.ANA_S4 = !A && B;
        s.ANA_OUT = s.ANA_S3 || s.ANA_S4;

        return s;
    }

    /**
     * Updates the main gate cards at the top
     */
    function updateGlobalCards() {
        document.querySelectorAll('.gate-card').forEach(card => {
            const gateType = card.dataset.gate;
            if (!gateType) return;
            const led = card.querySelector('.led-indicator');
            const result = (gateType === 'NOT') ? logic.NOT(globalState.A) : logic[gateType](globalState.A, globalState.B);
            
            if (result) {
                led.classList.add('glow-red');
                card.classList.add('active-glow');
            } else {
                led.classList.remove('glow-red');
                card.classList.remove('active-glow');
            }
        });
    }

    /**
     * Updates a specific schematic's visuals (Signals & Gate Bodies)
     */
    function updateSchematic(container) {
        const id = container.dataset.schematic;
        const state = schematicStates[id];
        const sigs = getSignalPropagation(state.A, state.B);

        // Update Signals
        container.querySelectorAll('[data-signal]').forEach(el => {
            const sigName = el.dataset.signal;
            if (sigs[sigName] !== undefined) {
                el.classList.toggle('signal-active', sigs[sigName]);
            }
        });

        // Update Gate Bodies
        const gateBodyMap = {
            'NOT_NAND1': sigs.NOT_OUT,
            'AND_NAND1': sigs.AND_S1, 'AND_NAND2': sigs.AND_OUT,
            'OR_NAND1': sigs.OR_S1, 'OR_NAND2': sigs.OR_S2, 'OR_NAND3': sigs.OR_OUT,
            'XOR_NAND1': sigs.XOR_S1, 'XOR_NAND2': sigs.XOR_S2, 'XOR_NAND3': sigs.XOR_S3, 'XOR_NAND4': sigs.XOR_OUT,
            'NOR_NOT1': sigs.NOR_NOT_OUT,
            'NOR_OR1': sigs.NOR_OR_S1, 'NOR_OR2': sigs.NOR_OR_OUT,
            'NOR_AND1': sigs.NOR_AND_S1, 'NOR_AND2': sigs.NOR_AND_S2, 'NOR_AND3': sigs.NOR_AND_OUT,
            'XNOR_NOR1': sigs.XNOR_S1, 'XNOR_NOR2': sigs.XNOR_S2, 'XNOR_NOR3': sigs.XNOR_S3, 'XNOR_NOR4': sigs.XNOR_OUT,
            'ANA_NOT1': sigs.ANA_S1, 'ANA_NOT2': sigs.ANA_S2,
            'ANA_AND1': sigs.ANA_S3, 'ANA_AND2': sigs.ANA_S4,
            'ANA_OR1': sigs.ANA_OUT
        };

        container.querySelectorAll('[data-gate-body]').forEach(el => {
            const bodyId = el.dataset.gateBody;
            if (gateBodyMap[bodyId]) {
                el.classList.add('gate-active-body');
            } else {
                el.classList.remove('gate-active-body');
            }
        });
    }

    // --- Initialization ---

    // 1. Initialize Global Buttons
    if (btnA && btnB) {
        btnA.addEventListener('click', () => {
            globalState.A = !globalState.A;
            btnA.classList.toggle('active', globalState.A);
            updateGlobalCards();
        });
        btnB.addEventListener('click', () => {
            globalState.B = !globalState.B;
            btnB.classList.toggle('active', globalState.B);
            updateGlobalCards();
        });
    }

    // 2. Initialize Mini-Controls for each Schematic
    document.querySelectorAll('.schematic-svg-container').forEach(container => {
        const id = container.dataset.schematic;
        if (!id) return;

        // Default state
        schematicStates[id] = { A: false, B: false };

        // Handle button clicks
        container.querySelectorAll('.mini-toggle').forEach(btn => {
            const input = btn.dataset.input; // 'A' or 'B'
            
            btn.addEventListener('click', () => {
                const newState = !schematicStates[id][input];
                schematicStates[id][input] = newState;
                
                // Update button text and class
                btn.textContent = `${input} ${newState ? 'ON' : 'OFF'}`;
                btn.classList.toggle('active', newState);
                
                // Trigger logic update for this schematic
                updateSchematic(container);
            });
        });

        // Initial render for this schematic
        updateSchematic(container);
    });

    // Initial global render
    updateGlobalCards();
});
