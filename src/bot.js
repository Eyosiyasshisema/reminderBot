import { Telegraf ,Markup } from "telegraf";
import session from 'telegraf-session-local';
import { Postgres } from '@telegraf/session/pg'; 
import {pool} from "./db.js"; 
import { saveNewReminder } from "./db.js";
import { initializeCalendar } from "./utils/telegramCalendar.js"; 
import { combineDateTime, parseRecurrenceInterval } from "./utils/dateUtils.js";
import { displayHourSelection, displayMinuteSelection ,displayRecurrenceSelection } from "./utils/uiHelpersFunctions.js";

const store =Postgres({pool});
const bot = new Telegraf(process.env.APITOKEN);

bot.use(new session({store}));


const calendar = initializeCalendar(bot);

bot.start(async (ctx) =>{
    await ctx.reply("Welcome to the reminder bot, what would u like me to remind you about?")
    ctx.session.state ="AWAITING_REMINDER_TEXT"; 
    console.log(`User ${ctx.from.id} entered state: ${ctx.session.state}`);
})

bot.on("text", async (ctx) => {
    const currentState = ctx.session.state;
    const messageText = ctx.message.text;
    const userId = ctx.from.id;

    console.log(`User ${userId} in state: ${currentState}, received text: "${messageText}"`);

    switch (currentState) {
        case "AWAITING_REMINDER_TEXT":
            ctx.session.reminderText = messageText;
            ctx.session.state = "AWAITING_REMINDER_TYPE";
            await ctx.reply("Do you need a one-time notification or repeated notifications?", Markup.inlineKeyboard([
                Markup.button.callback("One-Time", "one_time_reminder"),
                Markup.button.callback("Repeated", "repeated_reminder")
            ]));
            break;

        case "AWAITING_REMINDER_TYPE":
            await ctx.reply("Please use the buttons to select reminder type (One-Time or Repeated), or try /start again.");
            break;

        case "AWAITING_DATE":
            await ctx.reply(
                "Please use the calendar to select a date, or try /start again if you got stuck."
            );
            await calendar.startNavCalendar(ctx.message);
            break;

        case "AWAITING_TIME":
            await ctx.reply(
                "Please select an hour and then minutes using the buttons, or try /start again."
            );
            await displayHourSelection(ctx);
            break;
        case "AWAITING_CUSTOM_RECURRENCE_VALUE":
            const value = parseInt(messageText, 10);
            if (isNaN(value) || value <= 0) {
                await ctx.reply('Please enter a valid positive number for the interval (e.g., "3" for every 3 days).');
                return; 
            }
            ctx.session.recurrenceValue = value;
            ctx.session.state = 'AWAITING_CUSTOM_RECURRENCE_UNIT';
            console.log(`DEBUG: About to send custom recurrence unit buttons for value: ${value}`);
            await ctx.reply(
                `Okay, repeat every ${value}... Now, what unit?`,
                Markup.inlineKeyboard([
                    [Markup.button.callback('Days', 'set_custom_recurrence_unit_day')],
                    [Markup.button.callback('Weeks', 'set_custom_recurrence_unit_week')],
                    [Markup.button.callback('Months', 'set_custom_recurrence_unit_month')]
                ])
            );
            break;

        default:
            await ctx.reply("I'm not sure what you mean. You can start setting a reminder with /start.");
            ctx.session.state = 'IDLE';
            ctx.session.reminderText = null;
            ctx.session.selectedDate = null;
            ctx.session.selectedHour = null;
            ctx.session.selectedMinute = null;
            ctx.session.reminderType = null;
            ctx.session.recurrenceValue = null;
            ctx.session.recurrenceUnit = null;
            ctx.session.triggerAt = null;
            break;
    }
});

bot.action('one_time_reminder', async (ctx) => {
    console.log("Action: one_time_reminder received for user:", ctx.from.id);
    await ctx.answerCbQuery();
    ctx.session.reminderType = 'one_time';
    ctx.session.state = 'AWAITING_DATE';
    try {
        await ctx.editMessageText('Great! Now, please select the date for your one-time reminder:');
        console.log("Message edited successfully. Attempting to start calendar...");
        await calendar.startNavCalendar(ctx.callbackQuery.message); 
        console.log("Calendar display initiated.");
    } catch (error) {
        console.error("Error displaying calendar for one-time reminder:", error);
        await ctx.reply("Oops! I couldn't display the calendar right now. Please try /start again.");
    }
});

bot.action('repeated_reminder', async (ctx) => {
    console.log("Action: repeated_reminder received for user:", ctx.from.id);
    await ctx.answerCbQuery();
    ctx.session.reminderType = 'recurring';
    ctx.session.state = 'AWAITING_DATE';
    try {
        await ctx.editMessageText('Okay, a repeated reminder! First, select the date for the *initial* reminder:');
        console.log("Message edited successfully. Attempting to start calendar...");
        await calendar.startNavCalendar(ctx.callbackQuery.message); 
        console.log("Calendar display initiated.");
    } catch (error) {
        console.error("Error displaying calendar for repeated reminder:", error);
        await ctx.reply("Oops! I couldn't display the calendar right now. Please try /start again.");
    }
});

bot.action(/select_hour_(\d{1,2})_(am|pm)/, async (ctx) => {
    await ctx.answerCbQuery();
    const hour = parseInt(ctx.match[1], 10);
    const period = ctx.match[2]; 
    let selectedHour24 = hour; 
    if (period === 'pm' && hour !== 12) {
        selectedHour24 += 12; 
    } else if (period === 'am' && hour === 12) {
        selectedHour24 = 0; 
    }
    ctx.session.selectedHour = selectedHour24; 
    console.log(`User ${ctx.from.id} selected hour (24h format): ${ctx.session.selectedHour}`);
    ctx.session.state = 'AWAITING_MINUTE';
    await displayMinuteSelection(ctx);
});

// Handler for selecting minutes and finalizing the time
bot.action(/select_minute_(\d{1,2})/, async (ctx) => {
    await ctx.answerCbQuery(); 

    const selectedMinute = parseInt(ctx.match[1], 10);
    if (isNaN(selectedMinute)) {
        console.error("Invalid minute selected:", ctx.match[1]);
        await ctx.reply("Invalid minute. Please try again from /start.");
        ctx.session.state = 'IDLE'; 
        return;
    }

    ctx.session.selectedMinute = selectedMinute;
    console.log(`User ${ctx.from.id} selected minute: ${ctx.session.selectedMinute}`);

    if (!ctx.session.selectedDate || typeof ctx.session.selectedHour === 'undefined' || typeof ctx.session.selectedMinute === 'undefined') {
        console.error("Missing date, hour, or minute for combination:", ctx.session.selectedDate, ctx.session.selectedHour, ctx.session.selectedMinute);
        await ctx.reply("It seems some date/time information is missing. Please try again from /start.");
        ctx.session.state = 'IDLE'; 
        return;
    }

    const triggerAt = combineDateTime(
        ctx.session.selectedDate,
        ctx.session.selectedHour,
        ctx.session.selectedMinute
    );

    if (!triggerAt || isNaN(triggerAt.getTime())) {
        console.error("Combined triggerAt is an Invalid Date, cannot save.", triggerAt);
        await ctx.reply("Couldn't set the reminder time correctly. Please try again from /start.");
        ctx.session.state = 'IDLE'; 
        return;
    }

    ctx.session.triggerAt = triggerAt;
    console.log(`User ${ctx.from.id} final trigger time: ${ctx.session.triggerAt}`);

     if (ctx.session.reminderType === 'recurring') {
        ctx.session.state = 'AWAITING_RECURRENCE_PATTERN'; 
        await displayRecurrenceSelection(ctx);
    } else {
        try {
            await saveNewReminder(
                ctx.from.id,
                ctx.chat.id,
                ctx.session.reminderText,
                ctx.session.triggerAt,
                ctx.session.reminderType,
                ctx.session.recurrenceValue, 
                ctx.session.recurrenceUnit    
            );

            if (ctx.callbackQuery.message) {
                await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
            }

            await ctx.reply(`Reminder "${ctx.session.reminderText}" set for ${ctx.session.triggerAt.toLocaleString()}.`);
            ctx.session.state = 'IDLE'; 
            ctx.session.reminderText = null;
            ctx.session.selectedDate = null;
            ctx.session.selectedHour = null;
            ctx.session.selectedMinute = null;
            ctx.session.reminderType = null;
            ctx.session.recurrenceValue = null;
            ctx.session.recurrenceUnit = null;
        } catch (error) {
            console.error("Error saving new reminder to database:", error);
            await ctx.reply("Sorry, I couldn't save your reminder right now. Please try again.");
            ctx.session.state = 'IDLE';
        }
    }
});

// Handlers for recurrence pattern selection
bot.action('set_custom_recurrence_unit_day', async (ctx) => {
    console.log(`DEBUG: Entering custom recurrence unit handler for DAY. User: ${ctx.from.id}`);
    await ctx.answerCbQuery();
    ctx.session.recurrenceUnit = 'day';
    ctx.session.reminderType = 'recurring';
    console.log(`User ${ctx.from.id} set custom recurrence unit: Day`);
    await saveRecurringReminder(ctx);
});

bot.action('set_recurrence_weekly', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.session.recurrenceUnit = 'week';
    ctx.session.recurrenceValue = 1; 
    console.log(`User ${ctx.from.id} set recurrence: Weekly`);
    await ctx.reply('Okay, this reminder will repeat weekly.');
    await saveRecurringReminder(ctx);
});

bot.action('set_recurrence_monthly', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.session.recurrenceUnit = 'month';
    ctx.session.recurrenceValue = 1; 
    console.log(`User ${ctx.from.id} set recurrence: Monthly`);
    await ctx.reply('Okay, this reminder will repeat monthly.');
    await saveRecurringReminder(ctx);
});

bot.action('set_recurrence_custom', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.session.state = 'AWAITING_CUSTOM_RECURRENCE_VALUE'; 
    console.log(`User ${ctx.from.id} chose custom recurrence.`);
    await ctx.reply('Please enter the number for your custom interval (e.g., "3" for every 3 days):');
});


// Handlers for  units after custom value input
bot.action('set_custom_recurrence_unit_day', async (ctx) => {
    await ctx.answerCbQuery(); 
    ctx.session.recurrenceUnit = 'day';
    ctx.session.reminderType = 'recurring'; 
    console.log(`User ${ctx.from.id} set custom recurrence unit: Day`);
    await saveRecurringReminder(ctx); 
});

bot.action('set_custom_recurrence_unit_week', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.session.recurrenceUnit = 'week';
    ctx.session.reminderType = 'recurring';
    console.log(`User ${ctx.from.id} set custom recurrence unit: Week`);
    await saveRecurringReminder(ctx);
});

bot.action('set_custom_recurrence_unit_month', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.session.recurrenceUnit = 'month';
    ctx.session.reminderType = 'recurring';
    console.log(`User ${ctx.from.id} set custom recurrence unit: Month`);
    await saveRecurringReminder(ctx);
});


async function saveRecurringReminder(ctx) {
    try {
        await saveNewReminder(
            ctx.from.id,
            ctx.chat.id,
            ctx.session.reminderText,
            ctx.session.triggerAt,
            ctx.session.reminderType, 
            ctx.session.recurrenceValue,
            ctx.session.recurrenceUnit
        );

        if (ctx.callbackQuery.message) {
            await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
        }

        await ctx.reply(`Recurring reminder "${ctx.session.reminderText}" set to repeat every ${ctx.session.recurrenceValue} ${ctx.session.recurrenceUnit}(s), starting ${ctx.session.triggerAt.toLocaleString()}.`);
        ctx.session.state = 'IDLE'; 
        ctx.session.reminderText = null;
        ctx.session.selectedDate = null;
        ctx.session.selectedHour = null;
        ctx.session.selectedMinute = null;
        ctx.session.reminderType = null;
        ctx.session.recurrenceValue = null;
        ctx.session.recurrenceUnit = null;

    } catch (error) {
        console.error("Error saving recurring reminder to database:", error);
        await ctx.reply("Sorry, I couldn't save your recurring reminder right now. Please try again.");
        ctx.session.state = 'IDLE';
    }
}

export function startBot() {
    bot.launch();
    console.log('Bot started.');

    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

export { bot };