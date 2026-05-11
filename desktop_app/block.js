let waitTimeSeconds = 20;
let remainingSeconds = 0;
let timerInterval = null;
let isCounting = false;

const overlay = document.getElementById('interactiveOverlay');
const timerEl = document.getElementById('timer');
const progressBar = document.getElementById('progressBar');
const progressFill = document.getElementById('progressFill');
const actionArea = document.getElementById('actionArea');
const unlockBtn = document.getElementById('unlockBtn');
const durationSelect = document.getElementById('duration');

document.addEventListener('DOMContentLoaded', async () => {
    waitTimeSeconds = await window.electronAPI.getWaitTime();
});

overlay.addEventListener('click', () => {
    overlay.style.display = 'none';
    document.body.style.cursor = 'default';
    startCountdown();
});

// Since this is a native app, we can detect if the window loses focus to pause or reset the timer
window.addEventListener('blur', () => {
    if (isCounting) {
        resetTimer();
    }
});

function resetTimer() {
    clearInterval(timerInterval);
    isCounting = false;
    overlay.style.display = 'flex';
    document.body.style.cursor = 'none';
    timerEl.style.display = 'none';
    progressBar.style.display = 'none';
    timerEl.textContent = '--:--';
}

function startCountdown() {
    isCounting = true;
    remainingSeconds = waitTimeSeconds;
    const totalSeconds = remainingSeconds;

    timerEl.style.display = 'block';
    progressBar.style.display = 'block';
    
    updateDisplay();

    timerInterval = setInterval(() => {
        remainingSeconds--;
        updateDisplay();
        
        progressFill.style.width = `${((totalSeconds - remainingSeconds) / totalSeconds) * 100}%`;

        if (remainingSeconds <= 0) {
            clearInterval(timerInterval);
            timerComplete();
        }
    }, 1000);
}

function updateDisplay() {
    const mins = Math.floor(remainingSeconds / 60);
    const secs = remainingSeconds % 60;
    timerEl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function timerComplete() {
    isCounting = false;
    timerEl.style.display = 'none';
    progressBar.style.display = 'none';
    document.querySelector('h1').textContent = '你確定要解除限制嗎？';
    actionArea.style.display = 'block';
}

unlockBtn.addEventListener('click', async () => {
    const duration = parseInt(durationSelect.value);
    await window.electronAPI.unlockDomain(duration);
    // The window will be destroyed by the backend upon success
});
