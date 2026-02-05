const toggle = document.getElementById('toggleSwitch');
const speedToggle = document.getElementById('speedToggle');
const statusText = document.getElementById('status-text');

// Handle Highlighting toggle
toggle.addEventListener('change', async () => {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (toggle.checked) {
        browser.tabs.sendMessage(tab.id, { action: "enable" });
    } else {
        browser.tabs.sendMessage(tab.id, { action: "disable" });
    }
});

// Handle smooth mode toggle (saved locally)
speedToggle.addEventListener('change', () => {
    browser.storage.local.set({ coolMode: speedToggle.checked });
});

// Load saved smoth mode state on popup open
browser.storage.local.get('coolMode').then(data => {
    speedToggle.checked = !!data.coolMode;
});

// Unified status refresh
async function refreshStatus() {
    const iconWrapper = document.getElementById('status-icon-wrapper');
    const statusText = document.getElementById('status-text');

    try {
        const status = await browser.runtime.sendMessage({ action: "queryStatus" });

        if (!status.isReady) {
            iconWrapper.innerHTML = '<div class="spinner"></div>';
            statusText.innerText = "Downloading Engine...";
            statusText.className = "engine-loading";
        } else if (status.isProcessing) {
            iconWrapper.innerHTML = '<div class="spinner"></div>';
            statusText.innerText = "Highlighting...";
            statusText.className = "engine-loading";
        } else {
            iconWrapper.innerHTML = '✅';
            statusText.innerText = "Engine Ready";
            statusText.className = "engine-ready";
        }
    } catch (e) {
        iconWrapper.innerHTML = '❌';
        statusText.innerText = "Engine Offline";
        statusText.className = "engine-offline";
    }


}

// Check status every second
setInterval(refreshStatus, 1000);
refreshStatus();