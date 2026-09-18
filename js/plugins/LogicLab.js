//=============================================================================
// LogicLab.js
//=============================================================================
/*:
 * @plugindesc [v3.8] Simulador logico con Fade-In de entrada y Fade-Out suave de salida.
 * @author Tu Asistente Tsundere
 *
 * @help
 * Ejecutar mediante comando Script en un evento:
 *    SceneManager.push(Scene_LogicLab);
 */

(function() {
    'use strict';

    const SIDEBAR_W = 180;
    const TAB_W = 28;
    const TAB_H = 64;
    const TAB_Y = 16;

    // ========================================================================
    // Clase: LogicPin
    // ========================================================================
    function LogicPin(type, parentNode, relX, relY) {
        this.type = type;
        this.parentNode = parentNode;
        this.relX = relX;
        this.relY = relY;
        this.radius = 9;
        this.connectedTo = null;
        this.value = false;
    }

    LogicPin.prototype.getX = function() {
        return this.parentNode.x + this.relX;
    };

    LogicPin.prototype.getY = function() {
        return this.parentNode.y + this.relY;
    };

    LogicPin.prototype.contains = function(wx, wy) {
        return Math.hypot(wx - this.getX(), wy - this.getY()) <= this.radius + 6;
    };

    // ========================================================================
    // Clase: LogicNode
    // ========================================================================
    function LogicNode(id, type, x, y, label) {
        this.id = id;
        this.type = type;
        this.x = x;
        this.y = y;
        this.width = 110;
        this.height = 56;
        this.label = label || type;
        this.inputs = [];
        this.outputs = [];
        this.state = false;
        this.setupPins();
    }

    LogicNode.prototype.setupPins = function() {
        if (this.type === 'SWITCH') {
            this.outputs.push(new LogicPin('OUT', this, this.width, this.height / 2));
        } else if (this.type === 'NOT') {
            this.inputs.push(new LogicPin('IN', this, 0, this.height / 2));
            this.outputs.push(new LogicPin('OUT', this, this.width, this.height / 2));
        } else if (['AND', 'OR', 'NAND', 'XOR'].includes(this.type)) {
            this.inputs.push(new LogicPin('IN', this, 0, this.height * 0.3));
            this.inputs.push(new LogicPin('IN', this, 0, this.height * 0.7));
            this.outputs.push(new LogicPin('OUT', this, this.width, this.height / 2));
        } else if (this.type === 'LAMP') {
            this.inputs.push(new LogicPin('IN', this, 0, this.height / 2));
        }
    };

    LogicNode.prototype.contains = function(wx, wy) {
        return wx >= this.x && wx <= this.x + this.width &&
               wy >= this.y && wy <= this.y + this.height;
    };

    LogicNode.prototype.isSwitchToggleArea = function(wx, wy) {
        if (this.type !== 'SWITCH') return false;
        const btnW = 40;
        const btnH = 22;
        const btnX = this.x + (this.width - btnW) / 2;
        const btnY = this.y + 26;
        return wx >= btnX && wx <= btnX + btnW && wy >= btnY && wy <= btnY + btnH;
    };

    LogicNode.prototype.evaluate = function() {
        const inA = this.inputs[0] && this.inputs[0].connectedTo ? this.inputs[0].connectedTo.value : false;
        const inB = this.inputs[1] && this.inputs[1].connectedTo ? this.inputs[1].connectedTo.value : false;

        if (this.type === 'SWITCH') {
            if (this.outputs[0]) this.outputs[0].value = this.state;
        } else if (this.type === 'NOT') {
            this.state = !inA;
            if (this.outputs[0]) this.outputs[0].value = this.state;
        } else if (this.type === 'AND') {
            this.state = Boolean(inA && inB);
            if (this.outputs[0]) this.outputs[0].value = this.state;
        } else if (this.type === 'OR') {
            this.state = Boolean(inA || inB);
            if (this.outputs[0]) this.outputs[0].value = this.state;
        } else if (this.type === 'NAND') {
            this.state = !Boolean(inA && inB);
            if (this.outputs[0]) this.outputs[0].value = this.state;
        } else if (this.type === 'XOR') {
            this.state = Boolean(inA !== inB);
            if (this.outputs[0]) this.outputs[0].value = this.state;
        } else if (this.type === 'LAMP') {
            this.state = inA;
        }
    };

    // ========================================================================
    // Clase: Scene_LogicLab
    // ========================================================================
    window.Scene_LogicLab = function() {
        this.initialize.apply(this, arguments);
    };

    Scene_LogicLab.prototype = Object.create(Scene_MenuBase.prototype);
    Scene_LogicLab.prototype.constructor = Scene_LogicLab;

    Scene_LogicLab.prototype.initialize = function() {
        Scene_MenuBase.prototype.initialize.call(this);
        this._nodes = [];
        this._nodeCount = 0;
        this._activePin = null;
        this._draggedNode = null;
        this._dragOffset = { x: 0, y: 0 };
        this._spawningType = null;

        this._camX = 0;
        this._camY = 0;
        this._zoom = 1.0;
        this._isPanning = false;
        this._panStartX = 0;
        this._panStartY = 0;

        this._sidebarOpen = true;
        this._sidebarX = 0;
        this._targetSidebarX = 0;

        this._isFirstVisit = !$gameSystem._logicLabVisited;
        this._modalActive = this._isFirstVisit;

        // Animación de entrada y salida
        this._spawnAnimProgress = 0;
        this._isAppearing = !this._isFirstVisit;
        this._isExiting = false;
        this._exitAnimProgress = 1;
    };

    Scene_LogicLab.prototype.create = function() {
        Scene_MenuBase.prototype.create.call(this);
        this.setupLayers();
        this.createSidebar();
        this.createExitNotice();
        this.loadDefaultLevel();
        this.evaluateCircuit();

        this.setupInitialIntroState();

        if (this._modalActive) {
            this.createWelcomeModal();
        }
    };

    Scene_LogicLab.prototype.setupInitialIntroState = function() {
        this._gridSprite.opacity = 0;
        this._wireGraphics.alpha = 0;
        this._nodesSprite.opacity = 0;
        this._exitNoticeSprite.opacity = 0;
        this._sidebarSprite.opacity = 0;
    };

    Scene_LogicLab.prototype.createWelcomeModal = function() {
        const mw = 480;
        const mh = 200;
        const mx = (Graphics.boxWidth - mw) / 2;
        const my = (Graphics.boxHeight - mh) / 2;

        this._modalSprite = new Sprite();
        this._modalSprite.bitmap = new Bitmap(Graphics.boxWidth, Graphics.boxHeight);
        this.addChild(this._modalSprite);

        const bmp = this._modalSprite.bitmap;
        const ctx = bmp.context;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.fillRect(0, 0, Graphics.boxWidth, Graphics.boxHeight);

        ctx.fillStyle = '#141724';
        ctx.fillRect(mx, my, mw, mh);
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = 2;
        ctx.strokeRect(mx, my, mw, mh);

        bmp.fontSize = 18;
        bmp.textColor = '#00ff88';
        bmp.drawText("MODO SANDBOX", mx, my + 24, mw, 28, 'center');

        bmp.fontSize = 14;
        bmp.textColor = '#ffffff';
        bmp.drawText("Bienvenido al modo Sandbox.", mx, my + 64, mw, 22, 'center');
        bmp.drawText("Presiona el boton OK para continuar.", mx, my + 90, mw, 22, 'center');

        this._okBtnRect = { x: mx + (mw - 100) / 2, y: my + 132, w: 100, h: 36 };
        ctx.fillStyle = '#212638';
        ctx.fillRect(this._okBtnRect.x, this._okBtnRect.y, this._okBtnRect.w, this._okBtnRect.h);
        ctx.strokeStyle = '#3d4663';
        ctx.strokeRect(this._okBtnRect.x, this._okBtnRect.y, this._okBtnRect.w, this._okBtnRect.h);

        bmp.fontSize = 16;
        bmp.textColor = '#00ff88';
        bmp.drawText("OK", this._okBtnRect.x, this._okBtnRect.y + 6, this._okBtnRect.w, 24, 'center');

        bmp._setDirty();
    };

    Scene_LogicLab.prototype.confirmWelcomeModal = function() {
        this._modalActive = false;
        this._isAppearing = true;
        $gameSystem._logicLabVisited = true;
        SoundManager.playOk();
    };

    Scene_LogicLab.prototype.startExitTransition = function() {
        this._isExiting = true;
        this._exitAnimProgress = 1;
        SoundManager.playCancel();
    };

    Scene_LogicLab.prototype.updateTransitions = function() {
        // Desvanecimiento del modal de bienvenida
        if (this._modalSprite && !this._modalActive) {
            this._modalSprite.opacity -= 18;
            if (this._modalSprite.opacity <= 0) {
                this.removeChild(this._modalSprite);
                this._modalSprite = null;
            }
        }

        // Animación de Fade-In (Aparición gradual)
        if (this._isAppearing) {
            this._spawnAnimProgress += 0.035;
            if (this._spawnAnimProgress >= 1) {
                this._spawnAnimProgress = 1;
                this._isAppearing = false;
            }

            this._gridSprite.opacity = Math.min(255, this._spawnAnimProgress * 300);
            this._sidebarSprite.opacity = Math.min(255, Math.max(0, (this._spawnAnimProgress - 0.15) * 350));
            this._nodesSprite.opacity = Math.min(255, Math.max(0, (this._spawnAnimProgress - 0.3) * 400));
            this._wireGraphics.alpha = Math.min(1, Math.max(0, (this._spawnAnimProgress - 0.45) * 2.5));
            this._exitNoticeSprite.opacity = Math.min(255, Math.max(0, (this._spawnAnimProgress - 0.6) * 400));
        }

        // Animación de Fade-Out (Salida suave)
        if (this._isExiting) {
            this._exitAnimProgress -= 0.05; // Velocidad de salida
            if (this._exitAnimProgress <= 0) {
                this._exitAnimProgress = 0;
                SceneManager.pop(); // Vuelve al mapa una vez que la pantalla quedó oscura
                return;
            }

            const alpha = this._exitAnimProgress;
            this._gridSprite.opacity = 255 * alpha;
            this._sidebarSprite.opacity = 255 * alpha;
            this._nodesSprite.opacity = 255 * alpha;
            this._wireGraphics.alpha = alpha;
            this._exitNoticeSprite.opacity = 255 * alpha;
        }
    };

    Scene_LogicLab.prototype.setupLayers = function() {
        const sw = Graphics.boxWidth;
        const sh = Graphics.boxHeight;

        this._gridSprite = new Sprite();
        this._gridSprite.bitmap = new Bitmap(sw, sh);
        this.addChild(this._gridSprite);

        this._wireGraphics = new PIXI.Graphics();
        this.addChild(this._wireGraphics);

        this._nodesSprite = new Sprite();
        this._nodesSprite.bitmap = new Bitmap(sw, sh);
        this.addChild(this._nodesSprite);
    };

    Scene_LogicLab.prototype.createSidebar = function() {
        this._sidebarSprite = new Sprite();
        this._sidebarSprite.bitmap = new Bitmap(SIDEBAR_W + TAB_W, Graphics.boxHeight);
        this.addChild(this._sidebarSprite);

        this._sidebarButtons = [
            { type: 'SWITCH', label: 'Entrada', y: 70 },
            { type: 'NOT',    label: 'NOT',     y: 125 },
            { type: 'AND',    label: 'AND',     y: 180 },
            { type: 'OR',     label: 'OR',      y: 235 },
            { type: 'NAND',   label: 'NAND',    y: 290 },
            { type: 'XOR',    label: 'XOR',     y: 345 },
            { type: 'LAMP',   label: 'Lampara', y: 400 }
        ];

        this.renderSidebar();
    };

    Scene_LogicLab.prototype.createExitNotice = function() {
        const boxW = 340;
        const boxH = 36;
        const padding = 16;

        this._exitNoticeSprite = new Sprite();
        this._exitNoticeSprite.bitmap = new Bitmap(boxW, boxH);
        this._exitNoticeSprite.x = Graphics.boxWidth - boxW - padding;
        this._exitNoticeSprite.y = Graphics.boxHeight - boxH - padding;
        this.addChild(this._exitNoticeSprite);

        const bmp = this._exitNoticeSprite.bitmap;
        const ctx = bmp.context;

        ctx.save();
        ctx.fillStyle = 'rgba(15, 17, 26, 0.65)';
        ctx.fillRect(0, 0, boxW, boxH);
        ctx.strokeStyle = 'rgba(79, 86, 107, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(0, 0, boxW, boxH);
        ctx.restore();

        bmp.fontSize = 13;
        bmp.textColor = '#a0a8c2';
        bmp.drawText("[ Presione ESC para cerrar esta ventana. ]", 0, 6, boxW, 24, 'center');
        bmp._setDirty();
    };

    Scene_LogicLab.prototype.renderSidebar = function() {
        const bmp = this._sidebarSprite.bitmap;
        bmp.clear();
        const ctx = bmp.context;

        bmp.fillRect(0, 0, SIDEBAR_W, Graphics.boxHeight, '#14161f');
        ctx.save();
        ctx.strokeStyle = '#2d3345';
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, SIDEBAR_W - 1, Graphics.boxHeight - 2);

        bmp.fontSize = 15;
        bmp.textColor = '#a0a8c2';
        bmp.drawText("Compuertas", 0, 16, SIDEBAR_W, 20, 'center');
        bmp.drawText("Logicas", 0, 34, SIDEBAR_W, 20, 'center');

        for (const btn of this._sidebarButtons) {
            bmp.fillRect(16, btn.y, SIDEBAR_W - 32, 38, '#212638');
            ctx.strokeStyle = '#3d4663';
            ctx.strokeRect(16, btn.y, SIDEBAR_W - 32, 38);

            bmp.fontSize = 13;
            bmp.textColor = '#ffffff';
            bmp.drawText(btn.label, 16, btn.y + 7, SIDEBAR_W - 32, 24, 'center');
        }

        bmp.fillRect(SIDEBAR_W, TAB_Y, TAB_W, TAB_H, '#212638');
        ctx.strokeStyle = '#3d4663';
        ctx.strokeRect(SIDEBAR_W, TAB_Y, TAB_W, TAB_H);

        bmp.fontSize = 18;
        bmp.textColor = '#00ff88';
        const arrow = this._sidebarOpen ? '<' : '>';
        bmp.drawText(arrow, SIDEBAR_W, TAB_Y + (TAB_H / 2) - 13, TAB_W, 26, 'center');

        ctx.restore();
        bmp._setDirty();
    };

    Scene_LogicLab.prototype.renderDynamicGrid = function() {
        const bmp = this._gridSprite.bitmap;
        bmp.fillAll('#0d0f14');

        const step = 28 * this._zoom;
        if (step < 10) return;

        const offsetX = (this._camX % step + step) % step;
        const offsetY = (this._camY % step + step) % step;

        for (let x = offsetX; x < bmp.width; x += step) {
            for (let y = offsetY; y < bmp.height; y += step) {
                bmp.fillRect(x, y, 2, 2, '#1c202e');
            }
        }
    };

    Scene_LogicLab.prototype.toggleSidebar = function() {
        this._sidebarOpen = !this._sidebarOpen;
        this._targetSidebarX = this._sidebarOpen ? 0 : -SIDEBAR_W;
        SoundManager.playCursor();
        this.renderSidebar();
    };

    Scene_LogicLab.prototype.updateSidebarAnimation = function() {
        if (this._sidebarX !== this._targetSidebarX) {
            this._sidebarX += (this._targetSidebarX - this._sidebarX) * 0.25;
            if (Math.abs(this._targetSidebarX - this._sidebarX) < 1) {
                this._sidebarX = this._targetSidebarX;
            }
            this._sidebarSprite.x = this._sidebarX;
        }
    };

    Scene_LogicLab.prototype.screenToWorld = function(sx, sy) {
        return {
            x: (sx - this._camX) / this._zoom,
            y: (sy - this._camY) / this._zoom
        };
    };

    Scene_LogicLab.prototype.worldToScreen = function(wx, wy) {
        return {
            x: wx * this._zoom + this._camX,
            y: wy * this._zoom + this._camY
        };
    };

    Scene_LogicLab.prototype.spawnNodeAt = function(type, wx, wy) {
        this._nodeCount++;
        const id = 'node_' + this._nodeCount;
        const labels = {
            'SWITCH': 'ENTRADA',
            'NOT': 'NOT',
            'AND': 'AND',
            'OR': 'OR',
            'NAND': 'NAND',
            'XOR': 'XOR',
            'LAMP': 'LAMPARA'
        };
        const node = new LogicNode(id, type, wx, wy, labels[type]);
        this._nodes.push(node);
        SoundManager.playEquip();
        this.evaluateCircuit();
        return node;
    };

    Scene_LogicLab.prototype.removeNode = function(node) {
        for (const other of this._nodes) {
            for (const inPin of other.inputs) {
                if (inPin.connectedTo && inPin.connectedTo.parentNode === node) {
                    inPin.connectedTo = null;
                }
            }
        }
        for (const inPin of node.inputs) {
            inPin.connectedTo = null;
        }

        const idx = this._nodes.indexOf(node);
        if (idx >= 0) {
            this._nodes.splice(idx, 1);
            SoundManager.playMiss();
            this.evaluateCircuit();
        }
    };

    Scene_LogicLab.prototype.loadDefaultLevel = function() {
        this.spawnNodeAt('SWITCH', 220, 200);
        this.spawnNodeAt('LAMP', 620, 200);
    };

    Scene_LogicLab.prototype.update = function() {
        Scene_MenuBase.prototype.update.call(this);

        if (this._modalActive) {
            if (Input.isTriggered('ok')) {
                this.confirmWelcomeModal();
            } else if (TouchInput.isTriggered()) {
                const tx = TouchInput.x;
                const ty = TouchInput.y;
                if (this._okBtnRect && tx >= this._okBtnRect.x && tx <= this._okBtnRect.x + this._okBtnRect.w &&
                    ty >= this._okBtnRect.y && ty <= this._okBtnRect.y + this._okBtnRect.h) {
                    this.confirmWelcomeModal();
                }
            }
            return;
        }

        this.updateTransitions();

        // Si ya está saliendo en Fade-Out, no procesar comandos
        if (this._isExiting) return;

        if (Input.isTriggered('cancel')) {
            this.startExitTransition();
            return;
        }

        this.updateSidebarAnimation();
        this.handleCameraInput();
        this.handleMouseInput();
        this.renderDynamicGrid();
        this.renderWires();
        this.renderNodes();
    };

    Scene_LogicLab.prototype.handleCameraInput = function() {
        if (this._isAppearing || this._isExiting) return;

        if (TouchInput.wheelY !== 0) {
            const oldZoom = this._zoom;
            if (TouchInput.wheelY < 0) {
                this._zoom = Math.min(2.0, this._zoom * 1.1);
            } else {
                this._zoom = Math.max(0.4, this._zoom / 1.1);
            }

            const mx = TouchInput.x;
            const my = TouchInput.y;
            this._camX = mx - (mx - this._camX) * (this._zoom / oldZoom);
            this._camY = my - (my - this._camY) * (this._zoom / oldZoom);
        }

        const isMiddleClick = TouchInput._middlePressed || false;
        const isSpacePanning = (Input.isPressed('ok') || Input.isPressed('shift')) && TouchInput.isPressed();

        if (isMiddleClick || isSpacePanning) {
            if (!this._isPanning) {
                this._isPanning = true;
                this._panStartX = TouchInput.x - this._camX;
                this._panStartY = TouchInput.y - this._camY;
            } else {
                this._camX = TouchInput.x - this._panStartX;
                this._camY = TouchInput.y - this._panStartY;
            }
        } else if (!TouchInput.isPressed() && !isMiddleClick) {
            this._isPanning = false;
        }
    };

    Scene_LogicLab.prototype.handleMouseInput = function() {
        if (this._isPanning || this._isAppearing || this._isExiting) return;

        const sx = TouchInput.x;
        const sy = TouchInput.y;
        const curSideX = this._sidebarSprite.x;
        const worldPos = this.screenToWorld(sx, sy);

        if (TouchInput.isCancelled()) {
            const pin = this.findPinAt(worldPos.x, worldPos.y);
            if (pin && pin.type === 'IN' && pin.connectedTo) {
                pin.connectedTo = null;
                SoundManager.playCancel();
                this.evaluateCircuit();
                return;
            }

            for (let i = this._nodes.length - 1; i >= 0; i--) {
                const node = this._nodes[i];
                if (node.contains(worldPos.x, worldPos.y)) {
                    this.removeNode(node);
                    return;
                }
            }
            return;
        }

        if (TouchInput.isTriggered()) {
            const tabScreenX = curSideX + SIDEBAR_W;
            if (sx >= tabScreenX && sx <= tabScreenX + TAB_W && sy >= TAB_Y && sy <= TAB_Y + TAB_H) {
                this.toggleSidebar();
                return;
            }

            if (sx >= curSideX && sx < curSideX + SIDEBAR_W) {
                const localX = sx - curSideX;
                for (const btn of this._sidebarButtons) {
                    if (localX >= 16 && localX <= SIDEBAR_W - 16 && sy >= btn.y && sy <= btn.y + 38) {
                        this._spawningType = btn.type;
                        return;
                    }
                }
                return;
            }

            const pin = this.findPinAt(worldPos.x, worldPos.y);
            if (pin && pin.type === 'OUT') {
                this._activePin = pin;
                SoundManager.playCursor();
                return;
            }

            for (let i = this._nodes.length - 1; i >= 0; i--) {
                const node = this._nodes[i];
                if (node.contains(worldPos.x, worldPos.y)) {
                    if (node.type === 'SWITCH' && node.isSwitchToggleArea(worldPos.x, worldPos.y)) {
                        node.state = !node.state;
                        SoundManager.playCursor();
                        this.evaluateCircuit();
                        return;
                    }

                    this._draggedNode = node;
                    this._dragOffset.x = worldPos.x - node.x;
                    this._dragOffset.y = worldPos.y - node.y;
                    this._nodes.splice(i, 1);
                    this._nodes.push(node);
                    return;
                }
            }
        }

        if (this._draggedNode && TouchInput.isPressed()) {
            this._draggedNode.x = worldPos.x - this._dragOffset.x;
            this._draggedNode.y = worldPos.y - this._dragOffset.y;
        }

        if (TouchInput.isReleased()) {
            if (this._spawningType) {
                const limitX = this._sidebarOpen ? SIDEBAR_W : 0;
                if (sx > limitX) {
                    const spawnX = worldPos.x - 55;
                    const spawnY = worldPos.y - 28;
                    this.spawnNodeAt(this._spawningType, spawnX, spawnY);
                }
                this._spawningType = null;
            }

            if (this._draggedNode) {
                this._draggedNode = null;
            }

            if (this._activePin) {
                const targetPin = this.findPinAt(worldPos.x, worldPos.y);
                if (targetPin && targetPin.type === 'IN' && targetPin.parentNode !== this._activePin.parentNode) {
                    targetPin.connectedTo = this._activePin;
                    SoundManager.playOk();
                    this.evaluateCircuit();
                }
                this._activePin = null;
            }
        }
    };

    Scene_LogicLab.prototype.findPinAt = function(wx, wy) {
        for (const node of this._nodes) {
            for (const pin of node.inputs.concat(node.outputs)) {
                if (pin.contains(wx, wy)) return pin;
            }
        }
        return null;
    };

    Scene_LogicLab.prototype.evaluateCircuit = function() {
        for (let i = 0; i < 6; i++) {
            for (const node of this._nodes) {
                node.evaluate();
            }
        }
    };

    Scene_LogicLab.prototype.renderWires = function() {
        const g = this._wireGraphics;
        g.clear();

        for (const node of this._nodes) {
            for (const inPin of node.inputs) {
                if (inPin.connectedTo) {
                    const start = this.worldToScreen(inPin.connectedTo.getX(), inPin.connectedTo.getY());
                    const end = this.worldToScreen(inPin.getX(), inPin.getY());

                    const active = inPin.connectedTo.value;
                    g.lineStyle(3 * this._zoom, active ? 0x00ff88 : 0x4f566b, 1);
                    g.moveTo(start.x, start.y);
                    g.bezierCurveTo(start.x + 50 * this._zoom, start.y, end.x - 50 * this._zoom, end.y, end.x, end.y);
                }
            }
        }

        if (this._activePin) {
            const start = this.worldToScreen(this._activePin.getX(), this._activePin.getY());
            g.lineStyle(2 * this._zoom, 0xffea00, 0.9);
            g.moveTo(start.x, start.y);
            g.lineTo(TouchInput.x, TouchInput.y);
        }
    };

    Scene_LogicLab.prototype.renderNodes = function() {
        const bmp = this._nodesSprite.bitmap;
        bmp.clear();
        const ctx = bmp.context;

        for (const node of this._nodes) {
            const sp = this.worldToScreen(node.x, node.y);
            const w = node.width * this._zoom;
            const h = node.height * this._zoom;

            if (sp.x + w < 0 || sp.x > Graphics.boxWidth || sp.y + h < 0 || sp.y > Graphics.boxHeight) {
                continue;
            }

            bmp.fillRect(sp.x, sp.y, w, h, '#1a1d29');

            ctx.save();
            ctx.strokeStyle = node.state ? '#00ff88' : '#3a4259';
            ctx.lineWidth = Math.max(1, 2 * this._zoom);
            ctx.strokeRect(sp.x, sp.y, w, h);

            if (node.type === 'SWITCH') {
                bmp.fontSize = Math.max(8, 12 * this._zoom);
                bmp.textColor = '#a0a8c2';
                bmp.drawText(node.label, sp.x, sp.y + 2 * this._zoom, w, 18 * this._zoom, 'center');

                const btnW = 40 * this._zoom;
                const btnH = 22 * this._zoom;
                const btnX = sp.x + (w - btnW) / 2;
                const btnY = sp.y + 26 * this._zoom;

                bmp.fillRect(btnX, btnY, btnW, btnH, node.state ? '#00703c' : '#282d3f');
                ctx.strokeStyle = node.state ? '#00ff88' : '#4f566b';
                ctx.strokeRect(btnX, btnY, btnW, btnH);

                bmp.fontSize = Math.max(9, 14 * this._zoom);
                bmp.textColor = node.state ? '#00ff88' : '#ffffff';
                bmp.drawText(node.state ? '1' : '0', btnX, btnY + 1, btnW, btnH, 'center');
            } else {
                bmp.fontSize = Math.max(9, 14 * this._zoom);
                bmp.textColor = '#ffffff';
                bmp.drawText(node.label, sp.x, sp.y + (h / 2) - 12 * this._zoom, w, 24 * this._zoom, 'center');
            }

            const allPins = node.inputs.concat(node.outputs);
            for (const pin of allPins) {
                const pinSp = this.worldToScreen(pin.getX(), pin.getY());
                const r = pin.radius * this._zoom;
                const active = pin.type === 'OUT' ? pin.value : (pin.connectedTo ? pin.connectedTo.value : false);

                ctx.beginPath();
                ctx.arc(pinSp.x, pinSp.y, r, 0, Math.PI * 2);
                ctx.fillStyle = active ? '#00ff88' : '#e63946';
                ctx.fill();
                ctx.lineWidth = Math.max(1, 2 * this._zoom);
                ctx.strokeStyle = '#ffffff';
                ctx.stroke();
            }
            ctx.restore();
        }

        if (this._spawningType) {
            const ghostW = 110 * this._zoom;
            const ghostH = 56 * this._zoom;
            const ghostX = TouchInput.x - ghostW / 2;
            const ghostY = TouchInput.y - ghostH / 2;
            ctx.save();
            ctx.fillStyle = 'rgba(33, 38, 56, 0.7)';
            ctx.fillRect(ghostX, ghostY, ghostW, ghostH);
            ctx.strokeStyle = 'rgba(0, 255, 136, 0.8)';
            ctx.lineWidth = 2;
            ctx.strokeRect(ghostX, ghostY, ghostW, ghostH);
            ctx.restore();
        }

        bmp._setDirty();
    };

    document.addEventListener('mousedown', function(event) {
        if (event.button === 1) {
            TouchInput._middlePressed = true;
            event.preventDefault();
        }
    });

    document.addEventListener('mouseup', function(event) {
        if (event.button === 1) {
            TouchInput._middlePressed = false;
        }
    });

})();