import 'dotenv/config';
import {startBot,bot} from "./src/bot.js"
import { checkAndSendReminders } from './src/reminderScheduler.js';

console.log('DEBUG: BOT_TOKEN from process.env:', process.env.BOT_TOKEN ? 'Token found (length: ' + process.env.BOT_TOKEN.length + ')' : 'Token NOT found or is empty');
startBot();

const REMINDER_CHECK_INTERVAL_MS = 60 * 1000; 

checkAndSendReminders(bot);
setInterval(() => checkAndSendReminders(bot), REMINDER_CHECK_INTERVAL_MS);
console.log(`Reminder scheduler started, checking every ${REMINDER_CHECK_INTERVAL_MS / 1000} seconds.`);