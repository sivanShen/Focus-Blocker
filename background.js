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

        // If blocked, we inject a simple HTML page that tells the user to unlock via the Desktop App
        const html = `
            <html>
                <body style="background-color: #000; color: #fff; display: flex; justify-content: center; align-items: center; height: 100vh; font-family: sans-serif; text-align: center; flex-direction: column;">
                    <h1>此網站已被 Focus Blocker 封鎖</h1>
                    <p style="color: #aaa; margin-top: 1rem; font-size: 1.2rem;">請開啟電腦上的 <b>Focus Blocker Desktop App</b> 以解除限制。</p>
                </body>
            </html>
        `;
        const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
        chrome.tabs.update(tabId, { url: dataUrl });

    } catch (e) {}
});
