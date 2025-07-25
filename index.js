import 'dotenv/config';
import {startBot,bot} from "./src/bot.js"
import { checkAndSendReminders } from './src/reminderScheduler.js';

const REMINDER_CHECK_INTERVAL_MS = 60 * 1000; 

checkAndSendReminders(bot);
setInterval(() => checkAndSendReminders(bot), REMINDER_CHECK_INTERVAL_MS);
console.log(`Reminder scheduler started, checking every ${REMINDER_CHECK_INTERVAL_MS / 1000} seconds.`);
// Small change to trigger deploy