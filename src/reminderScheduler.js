import {pool} from "./db.js";
import { calculateNextRecurrence } from './utils/dateUtils.js'; 

export async function checkAndSendReminders(botInstance) { 
    try {
        const now = new Date();
        const { rows: reminders } = await pool.query(
            `SELECT * FROM reminders WHERE trigger_at <= $1 AND (is_sent = FALSE OR reminder_type = 'recurring')`,
            [now]
        );

        for (const reminder of reminders) {
            try {
                await botInstance.telegram.sendMessage(
                    reminder.chat_id,
                    `🔔 Reminder: ${reminder.reminder_text}`
                );
                console.log(`Sent reminder ${reminder.id} to user ${reminder.user_id}`);

                if (reminder.reminder_type === 'one_time') {
                    await pool.query(
                        `UPDATE reminders SET is_sent = TRUE WHERE id = $1`,
                        [reminder.id]
                    );
                } else if (reminder.reminder_type === 'recurring') {
                    const nextTrigger = calculateNextRecurrence(
                        reminder.trigger_at,
                        reminder.recurrence_value,
                        reminder.recurrence_unit
                    );
                    await pool.query(
                        `UPDATE reminders SET trigger_at = $1 WHERE id = $2`,
                        [nextTrigger, reminder.id]
                    );
                }
            } catch (sendError) {
                console.error(`Failed to send reminder ${reminder.id} to user ${reminder.user_id}:`, sendError);
            }
        }
    } catch (dbError) {
        console.error('Error fetching or processing reminders from DB:', dbError);
    }
}