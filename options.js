document.addEventListener('DOMContentLoaded', () => {
    // Protect Settings Page
    chrome.runtime.sendMessage({ action: 'CHECK_SETTINGS_ACCESS' }, (response) => {
        if (response && !response.allowed) {
            const blockUrl = `block.html?target=${encodeURIComponent(window.location.href)}&domain=__SETTINGS__`;
            window.location.href = blockUrl;
            return;
        }
        initOptions();
    });
});

function initOptions() {
    const startTimeInput = document.getElementById('startTime');
    const endTimeInput = document.getElementById('endTime');
    const addTimeSlotBtn = document.getElementById('addTimeSlotBtn');
    const timeSlotsList = document.getElementById('timeSlotsList');
    
    const domainInput = document.getElementById('domainInput');
    const addDomainBtn = document.getElementById('addDomainBtn');
    const domainList = document.getElementById('domainList');

    // Load initial data
    chrome.storage.local.get(['timeSlots', 'blockedDomains'], (result) => {
        const timeSlots = result.timeSlots || [{start: '09:00', end: '18:00'}]; // Default slot
        renderTimeSlots(timeSlots);
        if (!result.timeSlots) {
            chrome.storage.local.set({ timeSlots });
        }
        const domains = result.blockedDomains || [];
        renderDomains(domains);
    });

    // Add time slot
    addTimeSlotBtn.addEventListener('click', () => {
        const start = startTimeInput.value;
        const end = endTimeInput.value;
        
        chrome.storage.local.get(['timeSlots'], (result) => {
            const timeSlots = result.timeSlots || [];
            if (!timeSlots.some(t => t.start === start && t.end === end)) {
                timeSlots.push({ start, end });
                chrome.storage.local.set({ timeSlots }, () => {
                    renderTimeSlots(timeSlots);
                });
            }
        });
    });

    window.removeTimeSlot = (index) => {
        chrome.storage.local.get(['timeSlots'], (result) => {
            let timeSlots = result.timeSlots || [];
            timeSlots.splice(index, 1);
            chrome.storage.local.set({ timeSlots }, () => {
                renderTimeSlots(timeSlots);
            });
        });
    };

    function renderTimeSlots(slots) {
        timeSlotsList.innerHTML = '';
        if (slots.length === 0) {
            timeSlotsList.innerHTML = '<li class="domain-item" style="color: var(--text-secondary); justify-content: center;">目前沒有設定限制時段（將不會有任何限制）</li>';
            return;
        }

        slots.forEach((slot, index) => {
            const li = document.createElement('li');
            li.className = 'domain-item';
            
            const span = document.createElement('span');
            span.textContent = `${slot.start} ~ ${slot.end}`;
            
            const btn = document.createElement('button');
            btn.className = 'btn danger';
            btn.textContent = '刪除';
            btn.onclick = () => removeTimeSlot(index);
            
            li.appendChild(span);
            li.appendChild(btn);
            timeSlotsList.appendChild(li);
        });
    }

    // Add domain
    addDomainBtn.addEventListener('click', () => {
        addDomain();
    });

    domainInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addDomain();
        }
    });

    function addDomain() {
        let domain = domainInput.value.trim().toLowerCase();
        if (!domain) return;
        
        try {
            if (domain.startsWith('http')) {
                const url = new URL(domain);
                domain = url.hostname;
            }
        } catch (e) {}

        domain = domain.replace(/^www\./, '').replace(/\/$/, '');

        chrome.storage.local.get(['blockedDomains'], (result) => {
            const domains = result.blockedDomains || [];
            if (!domains.includes(domain)) {
                domains.push(domain);
                chrome.storage.local.set({ blockedDomains: domains }, () => {
                    renderDomains(domains);
                    domainInput.value = '';
                });
            } else {
                alert('該網站已在名單中！');
            }
        });
    }

    window.removeDomain = (domainToRemove) => {
        chrome.storage.local.get(['blockedDomains'], (result) => {
            let domains = result.blockedDomains || [];
            domains = domains.filter(d => d !== domainToRemove);
            chrome.storage.local.set({ blockedDomains: domains }, () => {
                renderDomains(domains);
            });
        });
    };

    function renderDomains(domains) {
        domainList.innerHTML = '';
        if (domains.length === 0) {
            domainList.innerHTML = '<li class="domain-item" style="color: var(--text-secondary); justify-content: center;">目前沒有設定受限網站</li>';
            return;
        }

        domains.forEach(domain => {
            const li = document.createElement('li');
            li.className = 'domain-item';
            
            const span = document.createElement('span');
            span.textContent = domain;
            
            const btn = document.createElement('button');
            btn.className = 'btn danger';
            btn.textContent = '刪除';
            btn.onclick = () => removeDomain(domain);
            
            li.appendChild(span);
            li.appendChild(btn);
            domainList.appendChild(li);
        });
    }
}
