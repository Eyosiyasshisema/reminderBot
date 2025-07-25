import {Pool} from "pg" ;

const pool= new Pool({
 connectionString: process.env.DATABASE_URL
});

export async function query(text,params){
    try {
          const res= await pool.query(text,params);
          return res;
    } catch (error) {
        console.error("Database Query Error", error.message,"Query:",text,"params:",params);
          throw error;
    }
}

export async function saveNewReminder(userId, chatId, reminderText, triggerAt, reminderType, recurrenceValue = null, recurrenceUnit = null) {
    const queryText = `
        INSERT INTO reminders (user_id, chat_id, reminder_text, trigger_at, reminder_type, recurrence_value, recurrence_unit)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id;
    `;
    const values = [userId, chatId, reminderText, triggerAt, reminderType, recurrenceValue, recurrenceUnit];

    try {
        const res = await pool.query(queryText, values);
        console.log(`Reminder saved with ID: ${res.rows[0].id}`);
        return res.rows[0].id;
    } catch (error) {
        console.error("Error saving new reminder to database:", error.message, "Values:", values);
        throw error; 
    }
}

export async function endPool() {
    console.log('Closing PostgreSQL connection pool...');
    await pool.end();
    console.log('PostgreSQL connection pool closed.');
}

pool.on('error', (err) => {
    console.error(' Unexpected error on idle PostgreSQL client:', err);
})

export { pool }; 