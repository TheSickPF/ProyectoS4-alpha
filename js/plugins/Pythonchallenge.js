(function () {
    function loadScript(src, callback) {
        var script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = src;
        script.onload = callback;
        document.body.appendChild(script);
    }

    if (typeof Sk === 'undefined') {
        loadScript('js/libs/skulpt/skulpt.min.js', function() {
            loadScript('js/libs/skulpt/skulpt-stdlib.js', function () {
                console.log('Skulpt cargado correctamente.');
            });
        });
    }

    var _Game_Interpreter_pluginCommand = Game_Interpreter.prototype.pluginCommand;
    Game_Interpreter.prototype.pluginCommand = function(command, args) {
        _Game_Interpreter_pluginCommand.call(this, command, args);
        if (command === 'PythonChallenge') {
            var switchId = Number(args[0]);
            var expected = args.slice(1).join(' ');
        }
    }
})