const { app } = require('electron');
app.whenReady().then(() => {
    console.log("USER DATA PATH:", app.getPath('userData'));
    app.quit();
});
