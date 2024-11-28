class YouTubeSubscriptionManager {
	constructor() {
		this.subscriptions = [];
		this.isRunning = false;
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

	async startUnsubscribing() {
		if (this.isRunning || this.subscriptions.length === 0) return;

		this.isRunning = true;
		document.getElementById('yt-stop-unsub').disabled = false;
		document.getElementById('yt-start-unsub').disabled = true;

		Logger.log('Starting unsubscribe process');
		// Actual unsubscribe functionality will be implemented in the next step
	}

	stopUnsubscribing() {
		this.isRunning = false;
		document.getElementById('yt-stop-unsub').disabled = true;
		document.getElementById('yt-start-unsub').disabled = false;

		const status = document.getElementById('yt-status');
		status.textContent = 'Stopped';

		Logger.log('Unsubscribe process stopped by user');
	}
}

// Initialize when the page loads
const manager = new YouTubeSubscriptionManager();
manager.initialize();
