class Logger {
	static log(message, type = 'info') {
		const timestamp = new Date().toISOString();
		const logMessage = `[${timestamp}] [${type}]: ${message}`;

		console.log(logMessage);

		// Store logs in extension storage
		chrome.storage.local.get(['logs'], function(result) {
			const logs = result.logs || [];
			logs.push(logMessage);
			chrome.storage.local.set({ logs: logs });
		});
	}

	static error(message, error) {
		this.log(`${message}: ${error.message}`, 'error');
		console.error(error);
	}

	static warn(message) {
		this.log(message, 'warning');
	}

	static debug(message) {
		if (process.env.NODE_ENV === 'development') {
			this.log(message, 'debug');
		}
	}
}

window.Logger = Logger;
