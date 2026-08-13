const bot = require('./bot');
bot.launch().then(() => {
    console.log("Bot started in polling mode.");
}).catch(console.error);
