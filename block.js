document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const targetUrl = urlParams.get('target');
    const domain = urlParams.get('domain');

    if (!targetUrl || !domain) {
        document.body.innerHTML = '<h1>無效的請求</h1>';
        return;
    }

    const timerElement = document.getElementById('timer');
    const timerContainer = document.getElementById('timerContainer');
    const waitSection = document.getElementById('waitSection');
    const unlockSection = document.getElementById('unlockSection');
    const durationSelect = document.getElementById('durationSelect');
    const unlockBtn = document.getElementById('unlockBtn');
    const clickOverlay = document.getElementById('clickOverlay');

    let waitSeconds = 120; // Default 2 minutes
    let remainingSeconds = waitSeconds;
    let timerInterval = null;

    chrome.runtime.sendMessage({ action: 'GET_WAIT_TIME', domain: domain }, (response) => {
        if (response && response.waitMinutes) {
            waitSeconds = response.waitMinutes * 60;
            remainingSeconds = waitSeconds;
            updateTimerDisplay();
        }
    });

    function updateTimerDisplay() {
        const m = Math.floor(remainingSeconds / 60);
        const s = remainingSeconds % 60;
        timerElement.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }

    function startTimer() {
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            if (!document.fullscreenElement) {
                return;
            }
            
            remainingSeconds--;
            updateTimerDisplay();

            if (remainingSeconds <= 0) {
                clearInterval(timerInterval);
                timerFinished();
            }
        }, 1000);
    }

    function resetTimer() {
        if (remainingSeconds > 0) {
            remainingSeconds = waitSeconds;
            updateTimerDisplay();
        }
    }

    function timerFinished() {
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(err => console.log(err));
        }
        waitSection.classList.add('hidden');
        unlockSection.classList.remove('hidden');
    }

    clickOverlay.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch((err) => {
                alert(`無法進入全螢幕：${err.message}`);
            });
        }
    });

    document.addEventListener('fullscreenchange', () => {
        if (document.fullscreenElement) {
            clickOverlay.classList.add('hidden');
            timerContainer.classList.remove('hidden');
            startTimer();
        } else {
            // User exited fullscreen manually before timer finished
            if (remainingSeconds > 0) {
                clickOverlay.classList.remove('hidden');
                timerContainer.classList.add('hidden');
                resetTimer();
                if (timerInterval) clearInterval(timerInterval);
            }
        }
    });

    // Anti-cheat mechanisms
    window.addEventListener('blur', () => {
        if (remainingSeconds > 0) {
            resetTimer();
            if (document.fullscreenElement) {
                document.exitFullscreen().catch(err => console.log(err));
            }
        }
    });

    document.addEventListener('visibilitychange', () => {
        if (document.hidden && remainingSeconds > 0) {
            resetTimer();
            if (document.fullscreenElement) {
                document.exitFullscreen().catch(err => console.log(err));
            }
        }
    });

    // Handle unlock
    unlockBtn.addEventListener('click', () => {
        const duration = durationSelect.value;
        unlockBtn.disabled = true;
        unlockBtn.textContent = '解鎖中...';

        chrome.runtime.sendMessage({ 
            action: 'UNLOCK_DOMAIN', 
            domain: domain,
            durationMinutes: parseInt(duration)
        }, (response) => {
            if (response && response.success) {
                window.location.href = targetUrl;
            }
        });
    });
});
