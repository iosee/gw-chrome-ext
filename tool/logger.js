VPLogger = {
    logEl: null,
    init: () => {
        if (!VPLogger.logEl) {
            VPLogger.logEl = document.createElement('div');
            VPLogger.logEl.className = 'vp-logger-container';
            document.body.appendChild(VPLogger.logEl);
        }
    },

    log: (text) => {
        const timeString = (new Date()).toTimeString().replace(/^(.+?)\s.+/i, '$1');
        const logLine = document.createElement('div');
        logLine.className = 'vp-logger-line';
        logLine.innerHTML = `${timeString} ${text}`;
        VPLogger.logEl.prepend(logLine);
    }
};

VPLogger.init();
