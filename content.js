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
			this.listenForCommands();
			Logger.log('YouTube Subscription Manager initialization complete');
		} catch (error) {
			ErrorHandler.handle(error, 'initialization');
		}
	}

	listenForCommands() {
		chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
			if (message.action === 'unsubscribeSelected') {
				ErrorHandler.wrapAsync(async () => {
					await this.startSelectiveUnsubscribing(message.channels);
				}, 'startSelectiveUnsubscribing');
			}
		});
	}

	async injectControls() {
		const controls = document.createElement('div');
		controls.innerHTML = `
            <div id="yt-unsub-controls" style="position: fixed; top: 70px; right: 20px; background: white; border: 1px solid #ccc; padding: 15px; border-radius: 8px; z-index: 9999; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                <h3 style="margin: 0 0 10px 0;">Subscription Manager</h3>
                <button id="yt-selective-unsub" class="yt-unsub-button">Selective Unsubscribe</button>
                <hr style="margin: 10px 0;">
                <button id="yt-start-unsub" class="yt-unsub-button">Bulk Unsubscribe All</button>
                <button id="yt-stop-unsub" class="yt-unsub-button" disabled>Stop</button>
                <div id="yt-progress" style="margin-top: 10px;">
                    <div id="yt-status">Ready</div>
                    <div id="yt-count"></div>
                </div>
            </div>
        `;
		const styles = document.createElement('style');
		styles.textContent = `
            .yt-unsub-button { margin: 5px; padding: 8px 15px; border: none; border-radius: 4px; background: #065fd4; color: white; cursor: pointer; font-size: 14px; width: calc(100% - 10px); }
            .yt-unsub-button:disabled { background: #ccc; cursor: not-allowed; }
            #yt-progress { font-size: 13px; color: #666; }
        `;
		document.head.appendChild(styles);
		document.body.appendChild(controls);
	}

	attachEventListeners() {
		document.getElementById('yt-selective-unsub').addEventListener('click', () => {
			ErrorHandler.wrapAsync(() => this.scanAndOpenManager(), 'scanAndOpenManager');
		});
		document.getElementById('yt-start-unsub').addEventListener('click', () => {
			ErrorHandler.wrapAsync(() => this.startBulkUnsubscribing(), 'startBulkUnsubscribing');
		});
		document.getElementById('yt-stop-unsub').addEventListener('click', () => {
			this.stopUnsubscribing();
		});
	}

	async scanAndOpenManager() {
		const status = document.getElementById('yt-status');
		status.textContent = 'Scanning subscriptions...';
		if (!window.location.href.includes('/feed/channels')) {
			window.location.href = 'https://www.youtube.com/feed/channels';
			return;
		}
		await this.waitForSubscriptions();
		const subElements = document.querySelectorAll('ytd-channel-renderer');
		const channelsData = Array.from(subElements).map(el => this.scrapeChannelData(el)).filter(c => c.name !== 'Unknown Channel');
		status.textContent = `Found ${channelsData.length} channels. Opening manager...`;
		chrome.runtime.sendMessage({ action: 'openManager', data: channelsData });
	}

	scrapeChannelData(channelElement) {
		const name = channelElement.querySelector('#channel-title')?.textContent.trim() || 'Unknown Channel';
		const linkElement = channelElement.querySelector('a#main-link');
		const link = linkElement ? linkElement.href : '#';
		const iconUrl = channelElement.querySelector('img#img')?.src || '';
		return { name, link, iconUrl };
	}

	async startBulkUnsubscribing() {
		const status = document.getElementById('yt-status');
		status.textContent = 'Scanning all subscriptions...';
		if (!window.location.href.includes('/feed/channels')) {
			window.location.href = 'https://www.youtube.com/feed/channels';
			return;
		}
		await this.waitForSubscriptions();
		this.subscriptions = Array.from(document.querySelectorAll('ytd-channel-renderer'));
		document.getElementById('yt-count').textContent = `Found ${this.subscriptions.length} subscriptions`;
		status.textContent = 'Ready to unsubscribe from ALL';
		await this.startUnsubscribing();
	}

	async startSelectiveUnsubscribing(channelNames) {
		const status = document.getElementById('yt-status');
		status.textContent = 'Preparing selective unsubscribe...';
		if (!window.location.href.includes('/feed/channels')) {
			alert("Please navigate back to the YouTube subscriptions page and try again.");
			return;
		}
		await this.waitForSubscriptions();
		const allSubElements = Array.from(document.querySelectorAll('ytd-channel-renderer'));
		this.subscriptions = allSubElements.filter(el => {
			const name = el.querySelector('#channel-title')?.textContent.trim();
			return channelNames.includes(name);
		});
		if (this.subscriptions.length !== channelNames.length) {
			console.warn("Could not find all selected channels on the page. Some may have been loaded out of view.");
		}
		document.getElementById('yt-count').textContent = `Targeting ${this.subscriptions.length} channels.`;
		await this.startUnsubscribing();
	}

	async waitForSubscriptions() {
		return new Promise((resolve, reject) => {
			const maxAttempts = 10; let attempts = 0;
			const check = () => {
				const subs = document.querySelectorAll('ytd-channel-renderer');
				if (subs.length > 0) resolve();
				else if (attempts >= maxAttempts) reject(new Error('Timeout waiting for subscriptions to load'));
				else { attempts++; setTimeout(check, 1000); }
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
		document.getElementById('yt-selective-unsub').disabled = false;
		document.getElementById('yt-status').textContent = 'Stopped';
	}

	async startUnsubscribing() {
		if (this.isRunning || this.subscriptions.length === 0) return;
		this.isRunning = true; this.shouldStop = false; this.processedCount = 0; this.failedCount = 0;
		document.getElementById('yt-stop-unsub').disabled = false;
		document.getElementById('yt-start-unsub').disabled = true;
		document.getElementById('yt-selective-unsub').disabled = true;
		Logger.log('Starting unsubscribe process');
		try { await this.processSubscriptions(); } catch (error) { ErrorHandler.handle(error, 'startUnsubscribing'); }
	}

	async processSubscriptions() {
		const status = document.getElementById('yt-status');
		const count = document.getElementById('yt-count');
		for (let i = 0; i < this.subscriptions.length; i++) {
			if (this.shouldStop) { Logger.log('Unsubscribe process stopped by user'); break; }
			const sub = this.subscriptions[i];
			status.textContent = `Processing ${i + 1}/${this.subscriptions.length}`;
			try {
				await this.unsubscribeFromChannel(sub);
				this.processedCount++;
				Logger.log(`Successfully unsubscribed from ${sub.querySelector('#channel-title')?.textContent.trim()}`);
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
		document.getElementById('yt-start-unsub').disabled = false;
		document.getElementById('yt-selective-unsub').disabled = false;
		status.textContent = this.shouldStop ? 'Stopped' : 'Completed';
		Logger.log('Unsubscribe process ended');
	}

	async unsubscribeFromChannel(channelElement) {
		if (this.shouldStop) throw new Error('Process stopped by user');
		return await ErrorHandler.wrapAsync(async () => {
			const channelName = channelElement.querySelector('#channel-title')?.textContent.trim() || 'Unknown Channel';
			Logger.log(`Attempting to unsubscribe from: ${channelName}`);

			const externalUnsubButton = await this.findExternalUnsubscribeButton(channelElement);
			if (!externalUnsubButton) throw new Error('External unsubscribe button not found');
			if (this.shouldStop) throw new Error('Process stopped by user');

			externalUnsubButton.click();
			await this.delay(1000);

			return true;
		}, 'unsubscribeFromChannel');
	}

	async findExternalUnsubscribeButton(channelElement) {
		let attempts = 0;
		const maxAttempts = 5;
		while (attempts < maxAttempts) {
			const button = channelElement.querySelector('button.unsubscribe-from');
			if (button) {
				return button;
			}
			await this.delay(500);
			attempts++;
		}
		return null;
	}

	delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
}

const manager = new YouTubeSubscriptionManager();
manager.initialize();
