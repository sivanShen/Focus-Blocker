// Focus Blocker Drone Extension
// This extension now relies entirely on the Desktop App server running at http://127.0.0.1:17423

async function fetchStatus() {
    try {
        const res = await fetch('http://127.0.0.1:17423/status');
        if (!res.ok) return null;
        return await res.json();
    } catch (e) {
        // Desktop app not running or unreachable
        return null;
    }
}

async function checkNavigation(details) {
    if (details.frameId !== 0) return; // Only apply to top-level main frame
    const url = details.url;
    if (url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('http://127.0.0.1:17423/')) return;

    try {
        const urlObj = new URL(url);
        let domain = urlObj.hostname.replace(/^www\./, '');

        const status = await fetchStatus();
        // If desktop app is dead or says not restricted, allow access.
        if (!status || !status.restricted) return;

        const blockedDomains = status.blockedDomains || [];
        const whitelist = status.whitelist || [];

        const matchedDomain = blockedDomains.find(d => domain === d || domain.endsWith('.' + d));
        if (!matchedDomain) return;

        if (whitelist.some(kw => url.includes(kw))) {
            return; 
        }

        // Redirect to the local server's block page to avoid Chrome's data: URI restrictions
        chrome.tabs.update(details.tabId, { url: 'http://127.0.0.1:17423/block' });

    } catch (e) {}
}

chrome.webNavigation.onBeforeNavigate.addListener(checkNavigation);
chrome.webNavigation.onHistoryStateUpdated.addListener(checkNavigation);

// --- Heartbeat System ---
function sendHeartbeat() {
    fetch('http://127.0.0.1:17423/heartbeat').catch(() => {});
}
// Send immediately, then every 5 seconds while SW is awake
sendHeartbeat();
setInterval(sendHeartbeat, 5000);

// Use alarms to wake up the SW periodically if it sleeps
chrome.alarms.create('heartbeat_wakeup', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'heartbeat_wakeup') {
        sendHeartbeat();
    }
});
