(function() {
    'use strict';

    const GATES = {
        AND: (a, b) => (a && b) ? 1 : 0,
        OR: (a, b) => (a || b) ? 1 : 0,
        NOT: (a) => a ? 0 : 1,
        XOR: (a, b) => (a !== b) ? 1 : 0,
        NAND: (a, b) => (a && b) ? 0 : 1,
        NOR: (a, b) => (a || b) ? 0 : 1,
        XNOR: (a, b) => (a !== b) ? 0 : 1
    };

    class Circuit {
        constructor() {
            this.inputs = {};
            this.gates = {};
            this.order = [];
            this.values = {};
        }

        addInput(name, value) {
            this.inputs[name] = value ? 1 : 0;
        }

        setInput(name, value) {
            if (!(name in this.inputs)) {
                console.warn('LogicCircuit: La entrada "${name}" no existe.');
                return;
            }
            this.inputs[name] = value ? 1 : 0;
        }

        addGate(name, type, a, b) {
            if (!GATES[type]) {
                console.warn('LogicCircuit: Tipo de compuerta "${type}" no existe.');
                return;
            }
            this.gates[name] = { type: type, a: a, b: b };
            this.order.push(name);
        }

        _resolve(name) {
            if (name in this.inputs) return this.inputs[name];
            if (name in this.values) return this.values[name];
            console.warn('LogicCircuit: No se pudo resolver "${name}".');
            return 0;
        }


        evaluate() {
            this.values = {};
            for (const name of this.order) {
                const gate = this.gates[name];
                const a = this._resolve(gate.a);
                const b = (gate.b && gate.b !== '-') ? this._resolve(gate, b) : undefined;
                this.values[name] = GATES[gate.type](a, b);
            }
            return this.values;
        }

        getValue(name) {
            if (name in this.values) return this.values[name];
            if (name in this.inputs) return this.inputs[name];
            return 0;
        }
    }


    const circuits = {};

    window.LogicCircuit = {
        GATES: GATES,
        Circuit: Circuit,
        circuits: circuits,

        define(id) {
            circuits[id] = new Circuit();
            return circuits[id];
        },
        get(id) {
            if (!circuits[id]) {
                console.warn('LogicCircuit: El circuito "${id}" no existe.');
            }
            return circuits[id];
        }
    };

    const _Game_Interpreter_pluginCommand = Game_Interpreter.prototype.pluginCommand;

    Game_Interpreter.prototype.pluginCommand = function(command, args) {
        _Game_Interpreter_pluginCommand.call(this, command, args);
        if (command !== 'LogicCircuit') return;

        const sub = args[0];
        const circuitId = args[1];

        switch (sub) {
            case 'define':
                window.LogicCircuit.define(circuitId);
                break;
            
            case 'addInput': {
                const circuit = window.LogicCircuit.get(circuitId);
                if (circuit) circuit.addInput(args[2], Number(args[3]));
                break;
            }

            case 'setInput': {
                const circuit = window.LogicCircuit.get(circuitId);
                if (circuit) circuit.setInput(args[2], Number(args[3]));
                break;
            }

            case 'addGate': {
                const circuit = window.LogicCircuit.get(circuitId);
                if (circuit) circuit.setInput(args[2], args[3], args[4], args[5]);
                break;
            }

            case 'evaluate': {
                const circuit = window.LogicCircuit.get(circuitId);
                if (circuit) circuit.evaluate();
                break;
            }

            case 'toVariable': {
                
            }
        }
    }
})