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

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (!changeInfo.url) return;
    const url = changeInfo.url;
    if (url.startsWith('chrome://') || url.startsWith('chrome-extension://')) return;

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
        chrome.tabs.update(tabId, { url: 'http://127.0.0.1:17423/block' });

    } catch (e) {}
});
