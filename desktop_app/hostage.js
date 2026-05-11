window.electronAPI.onHostageTick((event, secondsLeft) => {
    document.getElementById('countdown').textContent = secondsLeft;
});
