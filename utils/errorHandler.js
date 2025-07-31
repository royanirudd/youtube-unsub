class ErrorHandler {
	static handle(error, context) {
		const timestamp = new Date().toISOString();
		console.error(`[${timestamp}] [error]: Error in ${context}:`, error.message);
		console.error(error);
		Logger.log(`[error]: Error in ${context}: ${error.message}`);
	}

	static async wrapAsync(asyncFn, context) {
		try {
			return await asyncFn();
		} catch (error) {
			this.handle(error, context);
			throw error;
		}
	}
}
