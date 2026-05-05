function getTodayString() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

async function isTimeRestricted() {
    const data = await chrome.storage.local.get(['timeSlots', 'startTime', 'endTime']);
    let timeSlots = data.timeSlots;
    if (!timeSlots) {
        if (data.startTime && data.endTime) {
            timeSlots = [{ start: data.startTime, end: data.endTime }];
        } else {
            return false;
        }
    }
    if (timeSlots.length === 0) return false;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    for (const slot of timeSlots) {
        if (!slot.start || !slot.end) continue;
        const [startH, startM] = slot.start.split(':').map(Number);
        const [endH, endM] = slot.end.split(':').map(Number);
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;

        if (startMinutes <= endMinutes) {
            if (currentMinutes >= startMinutes && currentMinutes <= endMinutes) return true;
        } else {
            if (currentMinutes >= startMinutes || currentMinutes <= endMinutes) return true;
        }
    }
    return false;
}

async function getGlobalAttempts() {
    const data = await chrome.storage.local.get(['attemptsDate', 'globalAttempts']);
    const today = getTodayString();
    if (data.attemptsDate !== today) {
        return 0;
    }
    return data.globalAttempts || 0;
}

async function incrementGlobalAttempt() {
    const data = await chrome.storage.local.get(['attemptsDate', 'globalAttempts']);
    const today = getTodayString();
    let attempts = data.globalAttempts || 0;
    if (data.attemptsDate !== today) {
        attempts = 0;
    }
    attempts += 1;
    await chrome.storage.local.set({ attemptsDate: today, globalAttempts: attempts });
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (!changeInfo.url) return;
    const url = changeInfo.url;
    if (url.startsWith('chrome://') || url.startsWith('chrome-extension://')) return;

    try {
        const urlObj = new URL(url);
        let domain = urlObj.hostname.replace(/^www\./, '');

        const data = await chrome.storage.local.get(['blockedDomains', 'globalUnlockExpiry']);
        const blockedDomains = data.blockedDomains || [];
        
        const matchedDomain = blockedDomains.find(d => domain === d || domain.endsWith('.' + d));
        if (!matchedDomain) return;

        const restricted = await isTimeRestricted();
        if (!restricted) return;

        const unlockExpiry = data.globalUnlockExpiry || 0;
        if (unlockExpiry && Date.now() < unlockExpiry) {
            return;
        }

        const blockUrl = chrome.runtime.getURL(`block.html?target=${encodeURIComponent(url)}&domain=${encodeURIComponent(matchedDomain)}`);
        chrome.tabs.update(tabId, { url: blockUrl });

    } catch (e) {
        console.error("Invalid URL:", url);
    }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'CHECK_SETTINGS_ACCESS') {
        (async () => {
            const restricted = await isTimeRestricted();
            if (!restricted) {
                sendResponse({ allowed: true });
                return;
            }
            const data = await chrome.storage.local.get(['globalUnlockExpiry']);
            const unlockExpiry = data.globalUnlockExpiry || 0;
            
            if (unlockExpiry && Date.now() < unlockExpiry) {
                sendResponse({ allowed: true });
            } else {
                sendResponse({ allowed: false });
            }
        })();
        return true;
    }

    if (request.action === 'GET_WAIT_TIME') {
        getGlobalAttempts().then(attempts => {
            const waitMinutes = 2 + attempts;
            sendResponse({ waitMinutes });
        });
        return true; 
    }
    
    if (request.action === 'UNLOCK_DOMAIN') {
        const { durationMinutes } = request;
        const expiry = Date.now() + durationMinutes * 60 * 1000;
        
        chrome.storage.local.set({ globalUnlockExpiry: expiry }, async () => {
            await incrementGlobalAttempt();
            
            chrome.alarms.create('LOCK_GLOBAL', { delayInMinutes: parseInt(durationMinutes) });
            
            sendResponse({ success: true });
        });
        return true;
    }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'LOCK_GLOBAL') {
        const tabs = await chrome.tabs.query({});
        const restricted = await isTimeRestricted();
        
        if (!restricted) return; 

        const data = await chrome.storage.local.get(['blockedDomains']);
        const blockedDomains = data.blockedDomains || [];

        for (const tab of tabs) {
            if (!tab.url) continue;

            if (tab.url.includes(chrome.runtime.id) && tab.url.includes('options.html')) {
                const blockUrl = chrome.runtime.getURL(`block.html?target=${encodeURIComponent(tab.url)}&domain=__SETTINGS__`);
                chrome.tabs.update(tab.id, { url: blockUrl });
                continue;
            }

            if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) continue;

            try {
                const urlObj = new URL(tab.url);
                let tabDomain = urlObj.hostname.replace(/^www\./, '');
                const matchedDomain = blockedDomains.find(d => tabDomain === d || tabDomain.endsWith('.' + d));
                if (matchedDomain) {
                    const blockUrl = chrome.runtime.getURL(`block.html?target=${encodeURIComponent(tab.url)}&domain=${encodeURIComponent(matchedDomain)}`);
                    chrome.tabs.update(tab.id, { url: blockUrl });
                }
            } catch(e) {}
        }
    }
});

chrome.action.onClicked.addListener((tab) => {
    chrome.tabs.create({ url: 'options.html' });
});
