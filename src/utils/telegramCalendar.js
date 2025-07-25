import Calendar from 'telegram-inline-calendar';
import { displayHourSelection } from './uiHelpersFunctions.js';

export function initializeCalendar(botInstance){
    const calendar = new Calendar(botInstance, {
        date_format: 'DD-MM-YYYY', 
        language: 'en',
        bot_api: 'telegraf'
    });

    botInstance.on("callback_query", async (ctx, next) => {
        if (ctx.callbackQuery.message && ctx.callbackQuery.message.message_id === calendar.chats.get(ctx.callbackQuery.message.chat.id)) {
            await ctx.answerCbQuery(); 
            try { 
                const result = calendar.clickButtonCalendar(ctx.callbackQuery);
                console.log("Result from clickButtonCalendar:", result);
                console.log("Type of result:", typeof result);
                if (typeof result === 'string' && result !== '-1') {
                    const selectedDateString = result;
                    const parts = selectedDateString.split('-');

                    if (parts.length === 3) {
                        const day = parseInt(parts[0], 10);
                        const month = parseInt(parts[1], 10) - 1;
                        const year = parseInt(parts[2], 10);

                        const parsedDate = new Date(year, month, day);

                        if (isNaN(parsedDate.getTime())) {
                            console.error("Date parsing failed, resulting in Invalid Date for:", selectedDateString);
                            await ctx.reply("Sorry, the selected date seems invalid. Please try again from /start.");
                            ctx.session.state = 'IDLE';
                            return;
                        }

                        ctx.session.selectedDate = parsedDate;
                        ctx.session.state = 'AWAITING_TIME';

                        await ctx.reply(`You selected: ${ctx.session.selectedDate.toDateString()}.`);
                        await displayHourSelection(ctx);
                    } else {
                        console.error("Unexpected date format from calendar (parts missing):", selectedDateString);
                        await ctx.reply("Sorry, I received an invalid date format. Please try again from /start.");
                        ctx.session.state = 'IDLE';
                    }
                } else if (result === false) {
                    console.log("Calendar navigation clicked, but message was not modified (e.g., at end of month range).");
                } else {
                    console.log("Calendar navigation/internal button clicked. Calendar library should handle display update.");
                }
            } catch (calendarError) { 
                if (calendarError.response && calendarError.response.error_code === 400 && calendarError.response.description.includes('message is not modified')) {
                    console.warn("Caught harmless TelegramError: Message not modified during calendar navigation.", calendarError.message);
                } else {
                    console.error("Unexpected error during calendar interaction:", calendarError);
                    await ctx.reply("An error occurred with the calendar. Please try again from /start.");
                    ctx.session.state = 'IDLE';
                }
            }
        } else {
            return next();
        }
    });
    return calendar;
}