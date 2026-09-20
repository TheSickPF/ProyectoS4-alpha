/*:
 * @plugindesc Emulador retro integrado con captura total de entrada
 * @author TuNombre
 *
 * @help
 * Comando de plugin:
 *   LanzarSnes mariones.nes
 */

(function() {
    let emulatorFrame = null;
    let botonSalir = null;
    let keydownListener = null;
    let keyupListener = null;

    function abrirEmulador(rom) {
        if (emulatorFrame) return;

        // 1. Congelar la entrada de RPG Maker MV
        Input.clear();
        TouchInput.clear();
        const updateInputBak = Input.update;
        Input.update = function() {};

        // 2. Crear el iframe del emulador
        emulatorFrame = document.createElement('iframe');
        emulatorFrame.id = 'snes-frame';
        // Forzamos timestamp (?t=...) para evitar cualquier problema de caché con player.html
        emulatorFrame.src = 'emulator/player.html?t=' + Date.now();
        emulatorFrame.style.position = 'fixed';
        emulatorFrame.style.top = '0';
        emulatorFrame.style.left = '0';
        emulatorFrame.style.width = '100vw';
        emulatorFrame.style.height = '100vh';
        emulatorFrame.style.zIndex = '99998';
        emulatorFrame.style.border = 'none';
        emulatorFrame.style.backgroundColor = '#000';
        document.body.appendChild(emulatorFrame);

        // 3. Captura prioritaria en la ventana principal de RPG Maker
        // Al usar 'true' (fase de captura), interceptamos la tecla ANTES que RPG Maker
        keydownListener = function(e) {
            if (emulatorFrame && emulatorFrame.contentWindow && emulatorFrame.contentWindow.enviarInput) {
                emulatorFrame.contentWindow.enviarInput(e.keyCode, true);
                e.preventDefault();
                e.stopPropagation();
            }
        };

        keyupListener = function(e) {
            if (emulatorFrame && emulatorFrame.contentWindow && emulatorFrame.contentWindow.enviarInput) {
                emulatorFrame.contentWindow.enviarInput(e.keyCode, false);
                e.preventDefault();
                e.stopPropagation();
            }
        };

        window.addEventListener('keydown', keydownListener, true);
        window.addEventListener('keyup', keyupListener, true);

        // 4. Botón flotante para cerrar
        botonSalir = document.createElement('button');
        botonSalir.innerText = 'Cerrar Emulador';
        botonSalir.style.position = 'fixed';
        botonSalir.style.top = '10px';
        botonSalir.style.right = '10px';
        botonSalir.style.zIndex = '99999';
        botonSalir.style.padding = '8px 16px';
        botonSalir.style.background = '#e74c3c';
        botonSalir.style.color = '#ffffff';
        botonSalir.style.border = 'none';
        botonSalir.style.borderRadius = '4px';
        botonSalir.style.fontWeight = 'bold';
        botonSalir.style.cursor = 'pointer';
        botonSalir.tabIndex = -1; // Evitar que robe el foco
        document.body.appendChild(botonSalir);

        function cerrar() {
            window.removeEventListener('keydown', keydownListener, true);
            window.removeEventListener('keyup', keyupListener, true);

            if (emulatorFrame && emulatorFrame.parentNode) {
                emulatorFrame.parentNode.removeChild(emulatorFrame);
                emulatorFrame = null;
            }
            if (botonSalir && botonSalir.parentNode) {
                botonSalir.parentNode.removeChild(botonSalir);
                botonSalir = null;
            }

            // Restaurar RPG Maker MV
            Input.update = updateInputBak;
            Input.clear();
        }

        botonSalir.onclick = cerrar;

        // Asegurar foco al cargar
        emulatorFrame.onload = function() {
            emulatorFrame.focus();
        };
    }

    const _Game_Interpreter_pluginCommand = Game_Interpreter.prototype.pluginCommand;
    Game_Interpreter.prototype.pluginCommand = function(command, args) {
        _Game_Interpreter_pluginCommand.call(this, command, args);
        if (command === 'LanzarSnes') {
            abrirEmulador(args[0] || 'mariones.nes');
        }
    };
})();