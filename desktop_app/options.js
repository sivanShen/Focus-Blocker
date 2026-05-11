document.addEventListener('DOMContentLoaded', async () => {
    // Check if we are allowed to view settings
    const access = await window.electronAPI.checkAccess();
    if (!access.allowed) {
        // Technically handled by main.js, but just in case
        document.body.innerHTML = '<h1 style="color:white; text-align:center; margin-top:20vh;">Settings are currently locked. Please wait until the restriction is over or globally unlock.</h1>';
        return;
    }
    
    initOptions();
});

async function initOptions() {
    let config = await window.electronAPI.getConfig();

    const timeSlotsList = document.getElementById('timeSlotsList');
    const domainList = document.getElementById('domainList');
    const appList = document.getElementById('appList');
    const whitelistList = document.getElementById('whitelistList');

    renderTimeSlots(config.timeSlots || []);
    renderList(domainList, config.blockedDomains || [], 'blockedDomains');
    renderList(appList, config.blockedApps || [], 'blockedApps');
    renderList(whitelistList, config.whitelist || [], 'whitelist');

    // Add Time Slot
    document.getElementById('addTimeSlotBtn').addEventListener('click', async () => {
        const start = document.getElementById('startTime').value;
        const end = document.getElementById('endTime').value;
        if (!config.timeSlots.some(t => t.start === start && t.end === end)) {
            config.timeSlots.push({ start, end });
            await window.electronAPI.saveConfig({ timeSlots: config.timeSlots });
            renderTimeSlots(config.timeSlots);
        }
    });

    window.removeTimeSlot = async (index) => {
        config.timeSlots.splice(index, 1);
        await window.electronAPI.saveConfig({ timeSlots: config.timeSlots });
        renderTimeSlots(config.timeSlots);
    };

    function renderTimeSlots(slots) {
        timeSlotsList.innerHTML = '';
        slots.forEach((slot, index) => {
            const li = document.createElement('li');
            li.className = 'domain-item';
            li.innerHTML = `<span>${slot.start} ~ ${slot.end}</span> <button class="btn danger" onclick="removeTimeSlot(${index})">刪除</button>`;
            timeSlotsList.appendChild(li);
        });
    }

    // Generic Add to List
    function setupAddList(inputId, btnId, configKey, listEl) {
        document.getElementById(btnId).addEventListener('click', async () => {
            let val = document.getElementById(inputId).value.trim();
            if (!val) return;
            
            if (configKey === 'blockedDomains') {
                try {
                    if (val.startsWith('http')) val = new URL(val).hostname;
                } catch(e) {}
                val = val.replace(/^www\./, '').replace(/\/$/, '');
            }

            if (!config[configKey]) config[configKey] = [];
            if (!config[configKey].includes(val)) {
                config[configKey].push(val);
                await window.electronAPI.saveConfig({ [configKey]: config[configKey] });
                renderList(listEl, config[configKey], configKey);
                document.getElementById(inputId).value = '';
            }
        });
    }

    setupAddList('domainInput', 'addDomainBtn', 'blockedDomains', domainList);
    setupAddList('appInput', 'addAppBtn', 'blockedApps', appList);
    setupAddList('whitelistInput', 'addWhitelistBtn', 'whitelist', whitelistList);

    window.removeFromList = async (item, configKey, listId) => {
        config[configKey] = config[configKey].filter(i => i !== item);
        await window.electronAPI.saveConfig({ [configKey]: config[configKey] });
        renderList(document.getElementById(listId), config[configKey], configKey);
    };

    function renderList(el, items, configKey) {
        el.innerHTML = '';
        items.forEach(item => {
            const li = document.createElement('li');
            li.className = 'domain-item';
            li.innerHTML = `<span>${item}</span> <button class="btn danger" onclick="removeFromList('${item}', '${configKey}', '${el.id}')">刪除</button>`;
            el.appendChild(li);
        });
    }

    // Registry Lock Logic (Simulated for safety, but real powershell command can be injected)
    document.getElementById('lockExtBtn').addEventListener('click', () => {
        const extId = document.getElementById('extIdInput').value.trim();
        if (!extId) {
            alert('請輸入擴充功能 ID');
            return;
        }
        alert(`注意：此操作需系統管理員權限。\n請手動以系統管理員身分開啟 PowerShell 並執行以下指令：\n\nNew-Item -Path "HKLM:\\Software\\Policies\\Google\\Chrome\\ExtensionInstallForcelist" -Force\nNew-ItemProperty -Path "HKLM:\\Software\\Policies\\Google\\Chrome\\ExtensionInstallForcelist" -Name "1" -Value "${extId};https://clients2.google.com/service/update2/crx" -PropertyType String -Force`);
    });
}
