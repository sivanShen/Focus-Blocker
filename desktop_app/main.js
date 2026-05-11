const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const { exec, spawn } = require('child_process');

let tray = null;
let settingsWindow = null;
let blockWindow = null;
let pauseWindow = null;
let hostageWindow = null;
let lastHeartbeatTime = Date.now();
let pauseUntil = 0;
let hostageCountdown = 60;
let hostageTimerInterval = null;
let activeWindowMonitorProcess = null;

const configPath = path.join(app.getPath('userData'), 'focus_config.json');

// Default Config
let config = {
    timeSlots: [{ start: '09:00', end: '18:00' }],
    blockedDomains: [],
    whitelist: [],
    blockedApps: ['Discord.exe', 'LeagueClient.exe'], // For example
    globalUnlockExpiry: 0,
    globalAttempts: 0,
    attemptsDate: ''
};

function loadConfig() {
    try {
        if (fs.existsSync(configPath)) {
            const data = fs.readFileSync(configPath, 'utf8');
            config = { ...config, ...JSON.parse(data) };
        } else {
            saveConfig(config);
        }
    } catch (e) {
        console.error('Error loading config:', e);
    }
}

function saveConfig(newConfig) {
    config = { ...config, ...newConfig };
    try {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    } catch (e) {
        console.error('Error saving config:', e);
    }
}

function getTodayString() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isTimeRestricted() {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    for (const slot of config.timeSlots) {
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

function isGloballyUnlocked() {
    return config.globalUnlockExpiry && Date.now() < config.globalUnlockExpiry;
}

function openSettings() {
    if (isTimeRestricted() && !isGloballyUnlocked()) {
        showBlockScreen('__SETTINGS__');
        return;
    }

    if (settingsWindow) {
        settingsWindow.show();
        settingsWindow.focus();
        return;
    }

    settingsWindow = new BrowserWindow({
        width: 800,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js')
        },
        autoHideMenuBar: true
    });

    settingsWindow.loadFile('options.html');
    settingsWindow.on('closed', () => {
        settingsWindow = null;
    });
}

function showBlockScreen(targetAppOrUrl) {
    if (blockWindow) {
        blockWindow.show();
        return;
    }

    blockWindow = new BrowserWindow({
        fullscreen: true,
        alwaysOnTop: true,
        frame: false,
        skipTaskbar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js')
        }
    });

    // Anti-cheat: prevent closing via Alt+F4
    blockWindow.on('close', (e) => {
        if (!isGloballyUnlocked()) {
            e.preventDefault();
        }
    });

    // In a real scenario we'd pass URL params. We can use loadFile with query string workaround or just set global
    blockWindow.loadFile('block.html', { query: { domain: targetAppOrUrl } });
}

// IPC Handlers
ipcMain.handle('get-config', () => config);

ipcMain.handle('save-config', (event, newConfig) => {
    saveConfig(newConfig);
    return true;
});

ipcMain.handle('check-access', () => {
    if (isTimeRestricted() && !isGloballyUnlocked()) {
        return { allowed: false };
    }
    return { allowed: true };
});

ipcMain.handle('get-wait-time', () => {
    const today = getTodayString();
    if (config.attemptsDate !== today) {
        saveConfig({ attemptsDate: today, globalAttempts: 0 });
    }
    const n = config.globalAttempts || 0;
    // 公式: 20 + 20 * (1 + 2 + ... + n) = 20 + 10 * n * (n + 1)
    // 第 0 次: 20
    // 第 1 次: 20 + 20 = 40
    // 第 2 次: 40 + 40 = 80
    // 第 3 次: 80 + 60 = 140
    const waitSeconds = 20 + 10 * n * (n + 1);
    return waitSeconds;
});

ipcMain.handle('cancel-unlock', () => {
    if (blockWindow) {
        blockWindow.destroy();
        blockWindow = null;
    }
});

ipcMain.handle('pause-extension', (event, minutes) => {
    pauseUntil = Date.now() + minutes * 60 * 1000;
    if (pauseWindow) {
        pauseWindow.destroy();
        pauseWindow = null;
    }
});

ipcMain.handle('unlock-domain', (event, durationMinutes) => {
    const expiry = Date.now() + durationMinutes * 60 * 1000;
    const today = getTodayString();
    let attempts = config.globalAttempts;
    if (config.attemptsDate !== today) {
        attempts = 0;
    }
    
    saveConfig({ 
        globalUnlockExpiry: expiry,
        globalAttempts: attempts + 1,
        attemptsDate: today
    });

    if (blockWindow) {
        blockWindow.destroy(); // Destroy bypasses the close preventDefault
        blockWindow = null;
    }

    openSettings(); // Open settings after unlock as a convenience
    return { success: true };
});

// App Blocker (Process Monitor)
function checkRunningProcesses() {
    if (!isTimeRestricted() || isGloballyUnlocked()) return;

    exec('tasklist /FI "STATUS eq RUNNING" /FO CSV', (err, stdout) => {
        if (err) return;
        const lowerStdout = stdout.toLowerCase();
        
        for (const appName of config.blockedApps) {
            if (lowerStdout.includes(appName.toLowerCase())) {
                exec(`taskkill /F /IM ${appName}`, (killErr) => {
                    if (!killErr) {
                        console.log(`Killed ${appName}`);
                        showBlockScreen(appName);
                    }
                });
            }
        }
    });
}

function showPauseWindow() {
    if (pauseWindow || hostageWindow) return;
    pauseWindow = new BrowserWindow({
        width: 400, height: 400, alwaysOnTop: true, frame: false, resizable: false,
        webPreferences: { preload: path.join(__dirname, 'preload.js') }
    });
    pauseWindow.loadFile('pause.html');
    pauseWindow.on('close', (e) => { e.preventDefault(); });
}

function showHostageWindow() {
    if (hostageWindow) return;
    hostageCountdown = 90;
    hostageWindow = new BrowserWindow({
        width: 550, height: 250, alwaysOnTop: true, frame: false, resizable: false,
        webPreferences: { preload: path.join(__dirname, 'preload.js') }
    });
    // Set position to top center so it doesn't block the whole screen
    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width } = primaryDisplay.workAreaSize;
    hostageWindow.setPosition(Math.round((width - 550) / 2), 50);

    hostageWindow.loadFile('hostage.html');
    hostageWindow.on('close', (e) => { e.preventDefault(); });

    hostageTimerInterval = setInterval(() => {
        hostageCountdown--;
        if (hostageWindow && !hostageWindow.isDestroyed()) {
            hostageWindow.webContents.send('hostage-tick', hostageCountdown);
        }
        if (hostageCountdown <= 0) {
            exec('taskkill /F /IM chrome.exe', () => {
                // chrome is killed. checkHeartbeatAndHostage will reset the state.
            });
        }
    }, 1000);
}

function checkHeartbeatAndHostage() {
    if (!isTimeRestricted() || isGloballyUnlocked()) {
        pauseUntil = 0; // Reset if time becomes unrestricted
        if (pauseWindow) { pauseWindow.destroy(); pauseWindow = null; }
        if (hostageWindow) {
            hostageWindow.destroy(); hostageWindow = null;
            clearInterval(hostageTimerInterval);
        }
        return;
    }

    const timeSinceHeartbeat = Date.now() - lastHeartbeatTime;
    
    // Check if Chrome is running
    exec('tasklist /FI "IMAGENAME eq chrome.exe" /NH', (err, stdout) => {
        const isChromeRunning = stdout.toLowerCase().includes('chrome.exe');
        
        if (isChromeRunning) {
            if (timeSinceHeartbeat > 45000 && pauseUntil === 0) {
                showPauseWindow();
            } else if (pauseUntil > 0 && Date.now() > pauseUntil) {
                showHostageWindow();
            }
        } else {
            // Chrome is closed. Hide hostage window and reset for next launch.
            if (hostageWindow) {
                hostageWindow.destroy();
                hostageWindow = null;
                clearInterval(hostageTimerInterval);
                hostageCountdown = 90; // Reset for next time
            }
        }
    });
}

function startWindowMonitor() {
    const psScript = path.join(__dirname, 'window_monitor.ps1');
    if (!fs.existsSync(psScript)) {
        fs.writeFileSync(psScript, `Add-Type @"
  using System;
  using System.Runtime.InteropServices;
  public class Win32 {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")]
    public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder text, int count);
  }
"@
while ($true) {
    $handle = [Win32]::GetForegroundWindow()
    $sb = New-Object System.Text.StringBuilder 256
    if ([Win32]::GetWindowText($handle, $sb, 256) -gt 0) {
        Write-Host $sb.ToString()
    } else {
        Write-Host ""
    }
    Start-Sleep -Seconds 1
}`);
    }

    activeWindowMonitorProcess = spawn('powershell', ['-ExecutionPolicy', 'Bypass', '-File', psScript]);
    activeWindowMonitorProcess.stdout.on('data', (data) => {
        const title = data.toString().trim();
        if ((title.includes('擴充功能') || title.includes('Extensions')) && title.includes('Google Chrome')) {
            if (isTimeRestricted() && !isGloballyUnlocked()) {
                showBlockScreen('chrome://extensions');
            }
        }
    });
}

// Local Express Server for Chrome Extension
function startServer() {
    const serverApp = express();
    serverApp.use(cors());

    serverApp.get('/status', (req, res) => {
        if (isTimeRestricted() && !isGloballyUnlocked()) {
            res.json({ 
                restricted: true, 
                blockedDomains: config.blockedDomains,
                whitelist: config.whitelist
            });
        } else {
            res.json({ restricted: false });
        }
    });

    serverApp.get('/heartbeat', (req, res) => {
        lastHeartbeatTime = Date.now();
        pauseUntil = 0; // Reset any pause state since we received a heartbeat
        if (hostageWindow) {
            hostageWindow.destroy();
            hostageWindow = null;
            clearInterval(hostageTimerInterval);
        }
        if (pauseWindow) {
            pauseWindow.destroy();
            pauseWindow = null;
        }
        res.send('ok');
    });

    serverApp.get('/block', (req, res) => {
        res.send(`
            <html>
                <body style="background-color: #000; color: #fff; display: flex; justify-content: center; align-items: center; height: 100vh; font-family: sans-serif; text-align: center; flex-direction: column;">
                    <h1>此網站已被 Focus Blocker 封鎖</h1>
                    <p style="color: #aaa; margin-top: 1rem; font-size: 1.2rem;">請開啟電腦上的 <b>Focus Blocker Desktop App</b> 以解除限制。</p>
                </body>
            </html>
        `);
    });

    serverApp.listen(17423, '127.0.0.1', () => {
        console.log('Local Extension Server running on 17423');
    });
}

app.whenReady().then(() => {
    loadConfig();
    startServer();

    // Setup Tray
    let icon;
    try {
        const iconPath = path.join(__dirname, 'icon.png');
        if (fs.existsSync(iconPath)) {
            icon = nativeImage.createFromPath(iconPath);
        } else {
            // Fallback empty image if icon.png doesn't exist yet
            icon = nativeImage.createEmpty();
            icon.resize({ width: 16, height: 16 });
        }
    } catch (e) {
        icon = nativeImage.createEmpty();
    }
    
    tray = new Tray(icon); // We'll need a dummy icon.png or empty image
    const contextMenu = Menu.buildFromTemplate([
        { label: '設定 (Settings)', click: () => openSettings() },
        { label: '強制退出 (Exit)', click: () => app.quit() } // In real Opal, this would be hidden or locked
    ]);
    tray.setToolTip('Focus Blocker');
    tray.setContextMenu(contextMenu);

    startWindowMonitor();
    setInterval(checkRunningProcesses, 2000); // Check blocked apps
    setInterval(checkHeartbeatAndHostage, 5000); // Check extension heartbeat
    
    // Prevent app from exiting when windows are closed
    app.on('window-all-closed', (e) => {
        e.preventDefault();
    });

    // Open settings window automatically on startup
    openSettings();
});

app.setLoginItemSettings({
    openAtLogin: true
});
