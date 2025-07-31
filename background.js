chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message.action === 'openManager') {
		chrome.storage.local.set({ channels: message.data });

		chrome.storage.local.set({ originTabId: sender.tab.id });

		chrome.tabs.create({
			url: chrome.runtime.getURL('manager/manager.html')
		});
	} else if (message.action === 'getChannels') {
		chrome.storage.local.get('channels', (data) => {
			sendResponse(data.channels);
		});
		return true;
	} else if (message.action === 'unsubscribe') {
		chrome.storage.local.get('originTabId', (data) => {
			if (data.originTabId) {
				chrome.tabs.sendMessage(data.originTabId, {
					action: 'unsubscribeSelected',
					channels: message.channels
				});
			}
		});
	}
});
