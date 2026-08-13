const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');
const TxtSeries = require('./models/TxtSeries');
const AdminState = require('./models/AdminState');
require('dotenv').config();

const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = process.env.ADMIN_ID;

const connectDB = async () => {
    if (mongoose.connection.readyState >= 1) return;
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000 
        });
        console.log("MongoDB Connected");
    } catch (error) {
        console.error("MongoDB Connection Error:", error);
        throw error;
    }
};

bot.use(async (ctx, next) => {
    try {
        await connectDB();
        return next();
    } catch (err) {
        if (ctx.chat) {
            await ctx.reply("Database is temporarily unavailable. Please try again later.");
        }
    }
});

// -----------------------------------------------------
// USER COMMANDS
// -----------------------------------------------------

bot.start(async (ctx) => {
    const welcomeMessage = `🎯 **WELCOME TO UPSC CSE TEST SERIES BOT** 🇮🇳\n\n📚 **Complete UPSC CSE Test Series — All in One Place!**\n\nWelcome, Aspirant! 👋\nYe bot aapko UPSC CSE preparation ke liye different Test Series ki .txt files easily provide karega. 📝\n\n🔥 **Yahan aapko milengi:**\n\n📌 UPSC CSE Prelims Test Series\n📌 Subject-wise Test Series\n📌 Full-Length Mock Tests\n📌 Topic-wise Practice Tests\n📌 Most Important Questions Tests\n📌 Revision & Practice Test Series\n📌 UPSC-oriented MCQs & Questions\n\n📂 Har Test Series ki .txt file available hai, jise aap directly access karke apni preparation mein use kar sakte hain.\n\n🚀 **Bas apni required Test Series select karein aur preparation shuru karein!**\n\n━━━━━━━━━━━━━━━━━━\n\n💡 **How to Use?**\n👉 Test Series select karein\n👉 Apni required .txt file choose karein\n👉 Questions practice karein\n👉 Apni UPSC preparation ko next level par le jayein 🔥\n\n━━━━━━━━━━━━━━━━━━\n\n💬 **Kisi bhi query, problem ya assistance ke liye contact karein:**\n👉 **@Shrma\\_Ishuu\\_bot**\n\n🇮🇳 **Prepare • Practice • Revise • Improve • Succeed** 🎯\n\nUPSC CSE — Your Dream. Your Mission. Your Selection. 💯`;

    const years = await TxtSeries.distinct('year');
    
    if (years.length === 0) {
        return ctx.reply(welcomeMessage + "\n\n⚠️ Currently, there are no files available. Admin will upload them soon.", { parse_mode: 'Markdown' });
    }

    const buttons = years.map(y => Markup.button.callback(y, `year_${y}`));
    const keyboard = Markup.inlineKeyboard(buttons, { columns: 2 });
    
    ctx.reply(welcomeMessage, { parse_mode: 'Markdown', reply_markup: keyboard.reply_markup });
});

bot.help((ctx) => {
    ctx.reply("This bot provides UPSC CSE Test Series .txt files.\n- Type /start to browse tests.\n- Use the buttons to select Year, Coaching, and Test Code to download files.");
});

bot.command(['cancel', 'stopbulk'], async (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_ID) return;
    await AdminState.findOneAndDelete({ adminId: ADMIN_ID });
    ctx.reply("❌ Operation cancelled / Bulk Mode stopped.");
});

// -----------------------------------------------------
// TEXT COMMANDS AND DOCUMENT HANDLER
// -----------------------------------------------------

// Step 3: Handle Documents (TXT)
bot.on('document', async (ctx, next) => {
    if (ctx.from.id.toString() !== ADMIN_ID) return next();
    
    const state = await AdminState.findOne({ adminId: ADMIN_ID });
    if (!state) return next();

    const fileId = ctx.message.document.file_id;
    const fileName = ctx.message.document.file_name || "";

    if (state.step === 'WAITING_TXT_FILE') {
        state.fileId = fileId;
        await state.save();
        
        await AdminState.findOneAndUpdate({ adminId: ADMIN_ID }, { step: 'WAITING_TEST_CODE' });
        ctx.reply(`File received ✅\n\n📅 Year: **${state.year}**\n📌 Coaching: **${state.coaching}**\n⚙️ Format: **${state.format}**\n\nPlease type the **Test Code** (e.g., 1234, FLT-1):`, { parse_mode: 'Markdown' });
        
    } else if (state.step === 'WAITING_BULK_PDFS') {
        // Bulk parsing logic (Extract digits for code)
        const codeMatch = fileName.match(/\d+/);
        if (!codeMatch) {
            return ctx.reply(`⚠️ Ignored \`${fileName}\` (No digits/Test Code found)`, { parse_mode: 'Markdown' });
        }
        const testCode = codeMatch[0];

        try {
            let test = await TxtSeries.findOne({ year: state.year, coaching: state.coaching, testCode, format: state.format });
            if (!test) {
                test = new TxtSeries({ year: state.year, coaching: state.coaching, testCode, format: state.format, fileId });
            } else {
                test.fileId = fileId;
            }
            await test.save();
            ctx.reply(`✅ Saved: **${testCode} (${state.format})**`, { parse_mode: 'Markdown' });
        } catch (e) {
            console.error(e);
            ctx.reply(`❌ Error saving \`${fileName}\``, { parse_mode: 'Markdown' });
        }

    } else {
        return next();
    }
});

// Handle Text Inputs (Custom Coaching, Custom Year, Test Code, Edit Name)
bot.on('text', async (ctx, next) => {
    if (ctx.from.id.toString() !== ADMIN_ID) return next();
    
    const state = await AdminState.findOne({ adminId: ADMIN_ID });
    if (!state) return next();

    const text = ctx.message.text.trim();

    if (state.step === 'WAITING_CUSTOM_COACHING' || state.step === 'BULK_WAITING_CUSTOM_COACHING') {
        state.coaching = text;
        const isBulk = state.step.includes('BULK');
        
        if (isBulk) {
            state.step = 'BULK_CHOOSE_FORMAT';
            await state.save();
            const keyboard = Markup.inlineKeyboard([
                Markup.button.callback("OLD FORMATE", "bulk_fmt_OLD FORMATE"),
                Markup.button.callback("NEW FORMATE", "bulk_fmt_NEW FORMATE")
            ], { columns: 2 });
            ctx.reply(`Year: **${state.year}**\nCoaching: **${state.coaching}**\n\nSelect Format for Bulk Upload:`, { parse_mode: 'Markdown', reply_markup: keyboard.reply_markup });
        } else {
            state.step = 'CHOOSE_FORMAT';
            await state.save();
            const keyboard = Markup.inlineKeyboard([
                Markup.button.callback("OLD FORMATE", "add_fmt_OLD FORMATE"),
                Markup.button.callback("NEW FORMATE", "add_fmt_NEW FORMATE")
            ], { columns: 2 });
            ctx.reply(`Year: **${state.year}**\nCoaching: **${state.coaching}**\n\nSelect Format:`, { parse_mode: 'Markdown', reply_markup: keyboard.reply_markup });
        }
        
    } else if (state.step === 'WAITING_TEST_CODE') {
        state.testCode = text;
        
        try {
            let test = await TxtSeries.findOne({ year: state.year, coaching: state.coaching, testCode: state.testCode, format: state.format });
            if (!test) {
                test = new TxtSeries({ year: state.year, coaching: state.coaching, testCode: state.testCode, format: state.format, fileId: state.fileId });
            } else {
                test.fileId = state.fileId;
            }
            await test.save();
            
            ctx.reply(`✅ **Successfully saved!**\n\n📌 **Coaching:** ${state.coaching}\n📅 **Year:** ${state.year}\n⚙️ **Format:** ${state.format}\n📝 **Test Code:** ${state.testCode}\n\nIt is now available for users!`, { parse_mode: 'Markdown' });
        } catch (e) {
            console.error(e);
            ctx.reply("❌ Error saving to database.");
        }
        
        await AdminState.findOneAndDelete({ adminId: ADMIN_ID });
    } else if (state.step === 'EDIT_WAITING_NEW_NAME') {
        const newName = text;
        try {
            if (state.targetType === 'YEAR') {
                await TxtSeries.updateMany({ year: state.oldName }, { $set: { year: newName } });
                ctx.reply(`✅ Successfully renamed Year from **${state.oldName}** to **${newName}**!`, { parse_mode: 'Markdown' });
            } else if (state.targetType === 'COACHING') {
                await TxtSeries.updateMany({ year: state.year, coaching: state.oldName }, { $set: { coaching: newName } });
                ctx.reply(`✅ Successfully renamed Coaching from **${state.oldName}** to **${newName}** in Year ${state.year}!`, { parse_mode: 'Markdown' });
            } else if (state.targetType === 'TEST') {
                await TxtSeries.updateMany({ year: state.year, coaching: state.coaching, testCode: state.oldName }, { $set: { testCode: newName } });
                ctx.reply(`✅ Successfully renamed Test Code from **${state.oldName}** to **${newName}**!`, { parse_mode: 'Markdown' });
            }
        } catch (e) {
            console.error(e);
            ctx.reply("❌ Error updating database.");
        }
        await AdminState.findOneAndDelete({ adminId: ADMIN_ID });
    } else {
        return next();
    }
});


// -----------------------------------------------------
// USER BROWSING FLOW
// -----------------------------------------------------

bot.action(/^year_(.+)$/, async (ctx) => {
    const year = ctx.match[1];
    const coachings = await TxtSeries.distinct('coaching', { year });
    
    const buttons = coachings.map(c => Markup.button.callback(c.substring(0, 30), `coaching_${year}_${c}`));
    buttons.push(Markup.button.callback("⬅️ Back to Years", "back_start"));
    const keyboard = Markup.inlineKeyboard(buttons, { columns: 1 });
    
    ctx.editMessageText(`📅 **Selected Year:** ${year}\n\n👉 Now select a Coaching:`, { parse_mode: 'Markdown', reply_markup: keyboard.reply_markup });
});

bot.action(/^coaching_(.+)_(.+)$/, async (ctx) => {
    const year = ctx.match[1];
    const coaching = ctx.match[2];
    
    const tests = await TxtSeries.find({ year, coaching });
    
    const testMap = new Map();
    for (const t of tests) {
        if (!testMap.has(t.testCode)) {
            testMap.set(t.testCode, []);
        }
        testMap.get(t.testCode).push(t);
    }
    
    const buttons = [];
    for (const [testCode, formatsList] of testMap.entries()) {
        const firstDoc = formatsList[0];
        buttons.push(Markup.button.callback(`Test: ${testCode}`, `testcode_${firstDoc._id}`));
    }
    
    buttons.push(Markup.button.callback("⬅️ Back to Coachings", `year_${year}`));
    const keyboard = Markup.inlineKeyboard(buttons, { columns: 2 });
    
    ctx.editMessageText(`📅 **Year:** ${year}\n📌 **Coaching:** ${coaching}\n\n👉 Select a Test Code:`, { parse_mode: 'Markdown', reply_markup: keyboard.reply_markup });
});

bot.action(/^testcode_(.+)$/, async (ctx) => {
    const docId = ctx.match[1];
    try {
        const doc = await TxtSeries.findById(docId);
        if (!doc) return ctx.answerCbQuery("Test not found!");

        const allFormats = await TxtSeries.find({ year: doc.year, coaching: doc.coaching, testCode: doc.testCode });

        if (allFormats.length > 1) {
            ctx.answerCbQuery();
            const formatButtons = allFormats.map(f => 
                Markup.button.callback(f.format, `sendfile_${f._id}`)
            );
            formatButtons.push(Markup.button.callback("⬅️ Back to Tests", `coaching_${doc.year}_${doc.coaching}`));
            
            const keyboard = Markup.inlineKeyboard(formatButtons, { columns: 2 });
            
            ctx.editMessageText(
                `📅 **Year:** ${doc.year}\n📌 **Coaching:** ${doc.coaching}\n📝 **Test Code:** ${doc.testCode}\n\n` +
                `Is test ke liye Old aur New dono formats available hain.\n👉 **Select Format:**`,
                { parse_mode: 'Markdown', reply_markup: keyboard.reply_markup }
            );
        } else {
            ctx.answerCbQuery("Sending file...");
            await ctx.replyWithDocument(doc.fileId, { caption: `📚 ${doc.coaching} - ${doc.testCode} (${doc.format})` });
        }
    } catch(e) {
        console.error(e);
        ctx.answerCbQuery("Invalid request!");
    }
});

bot.action(/^sendfile_(.+)$/, async (ctx) => {
    const docId = ctx.match[1];
    try {
        const doc = await TxtSeries.findById(docId);
        if (!doc) return ctx.answerCbQuery("Test file not found!");

        ctx.answerCbQuery("Sending file...");
        await ctx.replyWithDocument(doc.fileId, { caption: `📚 ${doc.coaching} - ${doc.testCode} (${doc.format})` });
    } catch(e) {
        console.error(e);
        ctx.answerCbQuery("Invalid request!");
    }
});

bot.action(/^test_(.+)$/, async (ctx) => {
    const testId = ctx.match[1];
    try {
        const test = await TxtSeries.findById(testId);
        if (!test) return ctx.answerCbQuery("Test not found!");

        ctx.answerCbQuery("Sending file...");
        await ctx.replyWithDocument(test.fileId, { caption: `📚 ${test.coaching} - ${test.testCode} (${test.format})` });
    } catch(e) {
        ctx.answerCbQuery("Invalid request!");
    }
});

bot.action("back_start", async (ctx) => {
    const years = await TxtSeries.distinct('year');
    const buttons = years.map(y => Markup.button.callback(y, `year_${y}`));
    const keyboard = Markup.inlineKeyboard(buttons, { columns: 2 });
    
    ctx.editMessageText("👉 **Select a Test Series Year below:**", { parse_mode: 'Markdown', reply_markup: keyboard.reply_markup });
});

require('./adminCommands')(bot);

module.exports = bot;
