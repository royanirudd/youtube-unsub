document.addEventListener('DOMContentLoaded', () => {
	const channelList = document.getElementById('channel-list');
	const unsubSelectedBtn = document.getElementById('unsub-selected-btn');
	const unsubAllBtn = document.getElementById('unsub-all-btn');

	chrome.runtime.sendMessage({ action: 'getChannels' }, (channels) => {
		if (channels && channels.length > 0) {
			renderChannels(channels);
		} else {
			channelList.innerHTML = '<li>No channels found or an error occurred.</li>';
		}
	});

	function renderChannels(channels) {
		channelList.innerHTML = '';
		channels.forEach(channel => {
			const listItem = document.createElement('li');
			listItem.className = 'channel-item';
			listItem.innerHTML = `
                <input type="checkbox" data-channel-name="${channel.name}">
                <img src="${channel.iconUrl}" class="channel-icon" alt="${channel.name} icon">
                <div class="channel-info">
                    <div class="channel-name">${channel.name}</div>
                    <a href="${channel.link}" target="_blank" class="channel-link">${channel.link}</a>
                </div>
            `;
			channelList.appendChild(listItem);
		});
	}

	unsubSelectedBtn.addEventListener('click', () => {
		const selectedChannels = [];
		document.querySelectorAll('.channel-item input[type="checkbox"]:checked').forEach(checkbox => {
			selectedChannels.push(checkbox.dataset.channelName);
		});

		if (selectedChannels.length > 0) {
			chrome.runtime.sendMessage({ action: 'unsubscribe', channels: selectedChannels });
			window.close();
		} else {
			alert('Please select at least one channel.');
		}
	});

	unsubAllBtn.addEventListener('click', () => {
		const allChannels = [];
		document.querySelectorAll('.channel-item input[type="checkbox"]').forEach(checkbox => {
			allChannels.push(checkbox.dataset.channelName);
		});

		if (allChannels.length > 0) {
			chrome.runtime.sendMessage({ action: 'unsubscribe', channels: allChannels });
			window.close();
		}
	});
});
