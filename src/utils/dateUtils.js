export function combineDateTime(date, hour, minute) {
    if (!(date instanceof Date) || isNaN(date.getTime())) {
        console.error("combineDateTime received an invalid Date object:", date);
        return null;
    }

    const year = date.getFullYear();
    const month = date.getMonth(); // 0-indexed
    const day = date.getDate();

    // Create a new Date object using local time components.
    // This will create the date/time in the server's *current* local time zone.
    const combinedDate = new Date(year, month, day, hour, minute, 0); // Seconds = 0

    // --- CRITICAL DEBUGGING LOGS (Adjusted for clarity) ---
    console.log("--- combineDateTime DEBUG ---");
    console.log("Input Date (from calendar):", date.toString()); // Raw date object from calendar
    console.log("Parsed Date Components (Desired Local):", { year, month: month + 1, day, hour, minute });
    // This will now show the correct local time based on the server's actual TZ
    console.log("Combined Date Object (Server's Local Time):", combinedDate.toString());
    console.log("Combined Date Object (ISO UTC):", combinedDate.toISOString());
    console.log("Combined Date Object (Milliseconds since Epoch):", combinedDate.getTime());
    console.log("--- END combineDateTime DEBUG ---");

    if (isNaN(combinedDate.getTime())) {
        console.error("Failed to combine date and time into a valid Date object.");
        return null;
    }

    return combinedDate;
}
export function parseRecurrenceInterval(inputText) {
    const lowerText = inputText.toLowerCase().trim();

    if (lowerText === 'daily' || lowerText === 'every day') {
        return { value: 1, unit: 'day' };
    }
    if (lowerText === 'weekly' || lowerText === 'every week') {
        return { value: 1, unit: 'week' };
    }
    if (lowerText === 'monthly' || lowerText === 'every month') {
        return { value: 1, unit: 'month' };
    }
    if (lowerText === 'yearly' || lowerText === 'every year' || lowerText === 'annually') {
        return { value: 1, unit: 'year' };
    }

    const match = lowerText.match(/every\s+(\d+)\s+(days?|weeks?|months?|years?)/);
    if (match && match.length === 3) {
        const value = parseInt(match[1], 10);
        let unit = match[2];

        if (unit.endsWith('s')) {
            unit = unit.slice(0, -1);
        }

        if (['day', 'week', 'month', 'year'].includes(unit)) {
            return { value, unit };
        }
    }

    return null;
}

export function calculateNextRecurrence(baseDate, value, unit) {
    let nextDate = new Date(baseDate); 
    value = parseInt(value, 10);
    if (isNaN(value) || value <= 0) {
        value = 1; 
    }

    // Advance the date by the specified value and unit
    switch (unit) {
        case 'day':
            nextDate.setDate(nextDate.getDate() + value);
            break;
        case 'week':
            nextDate.setDate(nextDate.getDate() + (value * 7));
            break;
        case 'month':
            nextDate.setMonth(nextDate.getMonth() + value);
            break;
        case 'year':
            nextDate.setFullYear(nextDate.getFullYear() + value);
            break;
        default:
            console.warn(`Unknown recurrence unit: ${unit}. Defaulting to 'day'.`);
            nextDate.setDate(nextDate.getDate() + value); 
            break;
    }

    const now = new Date();
    while (nextDate <= now) {
        switch (unit) {
            case 'day': nextDate.setDate(nextDate.getDate() + value); break;
            case 'week': nextDate.setDate(nextDate.getDate() + (value * 7)); break;
            case 'month': nextDate.setMonth(nextDate.getMonth() + value); break;
            case 'year': nextDate.setFullYear(nextDate.getFullYear() + value); break;
        }
    }

    return nextDate;
}