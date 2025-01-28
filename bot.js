require('dotenv').config(); // Load environment variables from .env file
const TelegramBot = require('node-telegram-bot-api');
const Transmission = require('transmission');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch'); 

// Get environment variables
const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
const transmissionConfig = {
  host: process.env.TRANSMISSION_HOST,
  port: process.env.TRANSMISSION_PORT,
  username: process.env.TRANSMISSION_USERNAME,
  password: process.env.TRANSMISSION_PASSWORD,
  ssl: true,
};

const downloadDir = process.env.DOWNLOAD_DIR || '/games'; // Default to /games if not specified

// Initialize Transmission client
const transmission = new Transmission(transmissionConfig);

// Initialize the Telegram bot
const bot = new TelegramBot(telegramToken, { polling: true });

// Listen for messages in the group
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const fileId = msg.document ? msg.document.file_id : null;

  if (fileId && msg.document.mime_type === 'application/x-bittorrent') {
    try {
      // Get the file info from Telegram
      const fileInfo = await bot.getFile(fileId);
      const fileUrl = `https://api.telegram.org/file/bot${telegramToken}/${fileInfo.file_path}`;

      // Download the .torrent file
      const fileName = path.basename(fileInfo.file_path);
      const filePath = path.join(__dirname, fileName);

      const fileStream = fs.createWriteStream(filePath);
      const response = await fetch(fileUrl);

      if (!response.ok) {
        throw new Error(`Failed to download .torrent file: ${response.statusText}`);
      }

      response.body.pipe(fileStream);

      fileStream.on('finish', () => {
        // Add the .torrent file to Transmission
        transmission.addFile(filePath, { 'download-dir': downloadDir }, (err, result) => {
          if (err) {
            console.error('Error adding torrent:', err);
            bot.sendMessage(chatId, 'Failed to add torrent to Transmission.');
          } else {
            console.log('Torrent added successfully:', result);
            bot.sendMessage(chatId, `Torrent added to Transmission successfully! Downloading to ${downloadDir}.`);
          }

          // Delete the .torrent file after adding it to Transmission
          fs.unlinkSync(filePath);
        });
      });

      fileStream.on('error', (err) => {
        console.error('Error writing .torrent file:', err);
        bot.sendMessage(chatId, 'An error occurred while processing the .torrent file.');
      });
    } catch (error) {
      console.error('Error processing torrent:', error);
      bot.sendMessage(chatId, 'An error occurred while processing the torrent.');
    }
  } else {
    bot.sendMessage(chatId, 'Please send a valid .torrent file.');
  }
});

console.log('Bot is running...');