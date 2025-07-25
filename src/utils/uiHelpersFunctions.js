import { Markup } from "telegraf";

export async function displayHourSelection(ctx) {
    const hours = [];
    for (let i = 1; i <= 12; i++) {
        hours.push(Markup.button.callback(`${i.toString().padStart(2, '0')} AM`, `select_hour_${i}_am`));
        if (i !== 12) { 
            hours.push(Markup.button.callback(`${i.toString().padStart(2, '0')} PM`, `select_hour_${i}_pm`));
        }
    }
    hours.push(Markup.button.callback('12 PM', 'select_hour_12_pm')); 

    const keyboard = Markup.inlineKeyboard(
        hours.reduce((acc, button, i) => {
            const row = Math.floor(i / 4); 
            if (!acc[row]) acc[row] = [];
            acc[row].push(button);
            return acc;
        }, [])
    );

    await ctx.reply('Select hour:', keyboard);
}

export async function displayMinuteSelection(ctx) {
    try {
        console.log("displayMinuteSelection called for user:", ctx.from.id);
        if (ctx.callbackQuery && ctx.callbackQuery.message) {
            try {
                await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
                console.log("Deleted previous hour selection message.");
            } catch (deleteError) {
                console.warn("Could not delete previous hour selection message:", deleteError.message);
            }
        }

        const minutesButtons = [];
        for (let i = 0; i < 60; i += 15) { 
            const minute = String(i).padStart(2, '0');
            minutesButtons.push(Markup.button.callback(minute, `select_minute_${i}`));
        }

        const keyboard = Markup.inlineKeyboard(
            minutesButtons.reduce((acc, button, i) => {
                const row = Math.floor(i / 4);
                if (!acc[row]) acc[row] = [];
                acc[row].push(button);
                return acc;
            }, [])
        );

        await ctx.reply('Select minutes:', keyboard); 
        console.log("Minute selection displayed successfully.");

    } catch (error) {
        console.error("Error in displayMinuteSelection:", error);
        await ctx.reply("Oops! I couldn't show the minute options. Please try /start again.");
    }
}


export async function displayRecurrenceSelection(ctx) {
    if (ctx.callbackQuery && ctx.callbackQuery.message) {
        try {
            await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
            console.log("Deleted previous minute selection message.");
        } catch (error) {
            console.warn("Could not delete previous minute selection message:", error.message);
        }
    }

    await ctx.reply(
        'How often should this reminder repeat?',
        Markup.inlineKeyboard([
            [Markup.button.callback('Daily', 'set_recurrence_daily')],
            [Markup.button.callback('Weekly', 'set_recurrence_weekly')],
            [Markup.button.callback('Monthly', 'set_recurrence_monthly')],
            [Markup.button.callback('Custom Interval...', 'set_recurrence_custom')]
        ])
    );
    console.log("Recurrence selection displayed successfully for user:", ctx.from.id);
}