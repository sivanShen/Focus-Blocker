document.querySelectorAll('.btn').forEach(btn => {
    btn.addEventListener('click', async () => {
        const minutes = parseInt(btn.getAttribute('data-minutes'));
        btn.textContent = '設定中...';
        btn.disabled = true;
        await window.electronAPI.pauseExtension(minutes);
    });
});
