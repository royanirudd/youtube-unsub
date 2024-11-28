class ErrorHandler {
	static handle(error, context) {
		Logger.error(`Error in ${context}`, error);

		// You can customize error handling based on error types
		if (error instanceof TypeError) {
			return { success: false, message: 'Invalid operation performed' };
		}

		return { success: false, message: 'An unexpected error occurred' };
	}

	static async wrapAsync(fn, context) {
		try {
			return await fn();
		} catch (error) {
			return this.handle(error, context);
		}
	}
}

window.ErrorHandler = ErrorHandler;
