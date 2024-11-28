class YouTubeSubscriptionManager {
	constructor() {
		this.subscriptions = [];
		this.isRunning = false;
		this.shouldStop = false;
		this.processedCount = 0;
		this.failedCount = 0;
		this.delayBetweenUnsubscribes = 2000;
		Logger.log('YouTubeSubscriptionManager initialized');
	}

	async initialize() {
		try {
			await this.injectControls();
			this.attachEventListeners();
			Logger.log('YouTube Subscription Manager initialization complete');
		} catch (error) {
			ErrorHandler.handle(error, 'initialization');
		}
	}

	async injectControls() {
		const controls = document.createElement('div');
		controls.innerHTML = `
            <div id="yt-unsub-controls" style="
                position: fixed;
                top: 70px;
                right: 20px;
                background: white;
                border: 1px solid #ccc;
                padding: 15px;
                border-radius: 8px;
                z-index: 9999;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            ">
                <h3 style="margin: 0 0 10px 0;">Subscription Manager</h3>
                <button id="yt-scan-subs" class="yt-unsub-button">Scan Subscriptions</button>
                <button id="yt-start-unsub" class="yt-unsub-button" disabled>Start Unsubscribing</button>
                <button id="yt-stop-unsub" class="yt-unsub-button" disabled>Stop</button>
                <div id="yt-progress" style="margin-top: 10px;">
                    <div id="yt-status">Ready</div>
                    <div id="yt-count"></div>
                </div>
            </div>
        `;

		// Add styles
		const styles = document.createElement('style');
		styles.textContent = `
            .yt-unsub-button {
                margin: 5px;
                padding: 8px 15px;
                border: none;
                border-radius: 4px;
                background: #065fd4;
                color: white;
                cursor: pointer;
                font-size: 14px;
            }
            .yt-unsub-button:disabled {
                background: #ccc;
                cursor: not-allowed;
            }
            #yt-progress {
                font-size: 13px;
                color: #666;
            }
        `;

		document.head.appendChild(styles);
		document.body.appendChild(controls);
	}

	attachEventListeners() {
		document.getElementById('yt-scan-subs').addEventListener('click', () => {
			ErrorHandler.wrapAsync(() => this.scanSubscriptions(), 'scanSubscriptions');
		});

		document.getElementById('yt-start-unsub').addEventListener('click', () => {
			ErrorHandler.wrapAsync(() => this.startUnsubscribing(), 'startUnsubscribing');
		});

		document.getElementById('yt-stop-unsub').addEventListener('click', () => {
			this.stopUnsubscribing();
		});
	}

	async scanSubscriptions() {
		const status = document.getElementById('yt-status');
		status.textContent = 'Scanning subscriptions...';

		try {
			// Navigate to subscriptions page if not already there
			if (!window.location.href.includes('/feed/channels')) {
				window.location.href = 'https://www.youtube.com/feed/channels';
				return;
			}

			// Wait for the subscription elements to load
			await this.waitForSubscriptions();

			// Get all subscription elements
			const subElements = document.querySelectorAll('ytd-channel-renderer');
			this.subscriptions = Array.from(subElements);

			const count = document.getElementById('yt-count');
			count.textContent = `Found ${this.subscriptions.length} subscriptions`;

			document.getElementById('yt-start-unsub').disabled = false;
			status.textContent = 'Ready to unsubscribe';

			Logger.log(`Detected ${this.subscriptions.length} subscriptions`);
		} catch (error) {
			ErrorHandler.handle(error, 'scanSubscriptions');
			status.textContent = 'Error scanning subscriptions';
		}
	}

	async waitForSubscriptions() {
		return new Promise((resolve, reject) => {
			const maxAttempts = 10;
			let attempts = 0;

			const check = () => {
				const subs = document.querySelectorAll('ytd-channel-renderer');
				if (subs.length > 0) {
					resolve();
				} else if (attempts >= maxAttempts) {
					reject(new Error('Timeout waiting for subscriptions to load'));
				} else {
					attempts++;
					setTimeout(check, 1000);
				}
			};

			check();
		});
	}

	stopUnsubscribing() {
		Logger.log('Stop requested by user');
		this.shouldStop = true;
		this.isRunning = false;
		document.getElementById('yt-stop-unsub').disabled = true;
		document.getElementById('yt-start-unsub').disabled = false;
		document.getElementById('yt-status').textContent = 'Stopped';
	}

	async startUnsubscribing() {
		if (this.isRunning || this.subscriptions.length === 0) return;

		this.isRunning = true;
		this.shouldStop = false;
		this.processedCount = 0;
		this.failedCount = 0;

		document.getElementById('yt-stop-unsub').disabled = false;
		document.getElementById('yt-start-unsub').disabled = true;

		Logger.log('Starting unsubscribe process');

		try {
			await this.processSubscriptions();
		} catch (error) {
			ErrorHandler.handle(error, 'startUnsubscribing');
		}
	}

	async processSubscriptions() {
		const status = document.getElementById('yt-status');
		const count = document.getElementById('yt-count');

		for (let i = 0; i < this.subscriptions.length; i++) {
			if (this.shouldStop) {
				Logger.log('Unsubscribe process stopped by user');
				break;
			}

			const sub = this.subscriptions[i];
			status.textContent = `Processing ${i + 1}/${this.subscriptions.length}`;

			try {
				await this.unsubscribeFromChannel(sub);
				this.processedCount++;
				Logger.log(`Successfully unsubscribed ${this.processedCount}/${this.subscriptions.length}`);
			} catch (error) {
				if (this.shouldStop) break;
				this.failedCount++;
				ErrorHandler.handle(error, 'processSubscriptions');
			}

			count.textContent = `Processed: ${this.processedCount}, Failed: ${this.failedCount}`;

			if (this.shouldStop) break;
			await this.delay(this.delayBetweenUnsubscribes);
		}

		this.isRunning = false;
		document.getElementById('yt-stop-unsub').disabled = true;
		status.textContent = this.shouldStop ? 'Stopped' : 'Completed';
		Logger.log('Unsubscribe process ended');
	}

	async unsubscribeFromChannel(channelElement) {
		if (this.shouldStop) throw new Error('Process stopped by user');

		return await ErrorHandler.wrapAsync(async () => {
			const channelName = channelElement.querySelector('#channel-title')?.textContent || 'Unknown Channel';
			Logger.log(`Unsubscribing from: ${channelName}`);

			const subscribeButton = await this.findSubscribeButton(channelElement);
			if (!subscribeButton) {
				throw new Error('Subscribe button not found');
			}

			if (this.shouldStop) throw new Error('Process stopped by user');
			subscribeButton.click();
			await this.delay(1000);

			if (this.shouldStop) throw new Error('Process stopped by user');
			const unsubConfirmButton = await this.findUnsubscribeConfirmButton();
			if (!unsubConfirmButton) {
				throw new Error('Unsubscribe confirm button not found');
			}

			if (this.shouldStop) throw new Error('Process stopped by user');
			unsubConfirmButton.click();
			await this.delay(500);

			return true;
		}, 'unsubscribeFromChannel');
	}

	async findSubscribeButton(channelElement) {
		let attempts = 0;
		const maxAttempts = 5;

		while (attempts < maxAttempts) {
			const button = channelElement.querySelector('#subscribe-button button');
			if (button) return button;

			await this.delay(500);
			attempts++;
		}

		return null;
	}

	async findUnsubscribeConfirmButton() {
		let attempts = 0;
		const maxAttempts = 5;

		while (attempts < maxAttempts) {
			// Look for the confirmation dialog button
			const buttons = Array.from(document.querySelectorAll('yt-confirm-dialog-renderer button'));
			const confirmButton = buttons.find(button =>
				button.textContent.toLowerCase().includes('unsubscribe'));

			if (confirmButton) return confirmButton;

			await this.delay(500);
			attempts++;
		}

		return null;
	}

	delay(ms) {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	saveProgress() {
		const progress = {
			processedCount: this.processedCount,
			failedCount: this.failedCount,
			timestamp: new Date().toISOString()
		};

		chrome.storage.local.set({ unsubscribeProgress: progress }, () => {
			Logger.log('Progress saved');
		});
	}

	async loadProgress() {
		return new Promise((resolve) => {
			chrome.storage.local.get(['unsubscribeProgress'], (result) => {
				if (result.unsubscribeProgress) {
					Logger.log('Previous progress loaded');
					resolve(result.unsubscribeProgress);
				} else {
					resolve(null);
				}
			});
		});
	}
}

// Initialize when the page loads
const manager = new YouTubeSubscriptionManager();
manager.initialize();
