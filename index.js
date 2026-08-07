const { Telegraf } = require('telegraf');
const { google } = require('googleapis');
const cron = require('node-cron');
const axios = require('axios');

const bot = new Telegraf(process.env.TELEGRAM_TOKEN);
const MEU_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
let listaDeTarefas = [];

function getCalendarClient() {
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    const token = JSON.parse(process.env.GOOGLE_TOKEN);
    const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
    oAuth2Client.setCredentials(token);
    return google.calendar({ version: 'v3', auth: oAuth2Client });
}

// -----------------------------------------------------------------
// 1. ROTINA DE 08:00 (NASA + RESUMO)
// -----------------------------------------------------------------
cron.schedule('0 8 * * *', async () => {
    if (!MEU_CHAT_ID) return;
    try {
        const resNasa = await axios.get('https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY');
        const d = resNasa.data;
        let msg = `✨ *Bom dia, Amanda!* ✨\n\nNotícia espacial: *${d.title}* 🌌\n\n[Veja a foto aqui](${d.url})\n\n`;

        const calendar = getCalendarClient();
        const hojeInicio = new Date().toISOString();
        const resAgenda = await calendar.events.list({ calendarId: 'primary', timeMin: hojeInicio, singleEvents: true, orderBy: 'startTime', maxResults: 5 });
        
        const eventosHoje = resAgenda.data.items.filter(e => e.summary !== 'Parabéns!');
        if (eventosHoje.length > 0) {
            msg += `📅 *Agenda:* \n`;
            eventosHoje.forEach(e => msg += `- ${e.summary}\n`);
        } else {
            msg += `📅 *Agenda livre hoje!* 🎉`;
        }
        bot.telegram.sendMessage(MEU_CHAT_ID, msg, { parse_mode: 'Markdown' });
    } catch (e) { console.error(e); }
});

// -----------------------------------------------------------------
// 2. COMANDOS (TEXTO)
// -----------------------------------------------------------------
bot.on('text', async (ctx) => {
    const texto = ctx.message.text;
    const t = texto.toLowerCase();
    const calendar = getCalendarClient();

    // Mostrar Agenda (Filtro para ignorar os "Parabéns!")
    if (t.includes('agenda') || t.includes('mostra')) {
        try {
            const res = await calendar.events.list({ calendarId: 'primary', timeMin: (new Date()).toISOString(), maxResults: 10, singleEvents: true, orderBy: 'startTime' });
            // Filtro que remove todos os eventos com título "Parabéns!"
            const eventosFiltrados = res.data.items.filter(e => e.summary !== 'Parabéns!');
            
            if (eventosFiltrados.length === 0) return ctx.reply('Sua agenda está limpinha! 🎉');
            
            let msg = '📅 *Sua lista de compromissos:*\n\n';
            eventosFiltrados.forEach((e, i) => {
                const data = e.start.dateTime ? new Date(e.start.dateTime).toLocaleDateString('pt-BR') : e.start.date;
                msg += `${i + 1}. *${e.summary}* (${data}) ⏳\n`;
            });
            return ctx.replyWithMarkdown(msg);
        } catch (err) { ctx.reply('Erro ao buscar agenda. 😿'); }
    }

    // Marcar (Corrigido)
    if (t.includes('marca')) {
        try {
            const resumo = texto.replace(/nebulosa,?/gi, '').replace(/marca/gi, '').trim();
            const dataHoje = new Date().toISOString().split('T')[0];
            await calendar.events.insert({
                calendarId: 'primary',
                requestBody: {
                    summary: resumo,
                    start: { date: dataHoje },
                    end: { date: dataHoje }
                }
            });
            ctx.reply(`Anotado, Amanda! ✍️ "${resumo}" salvo no calendário. 🧿💜`);
        } catch (err) { 
            console.error(err);
            ctx.reply('Erro ao salvar. Tente um formato simples: "Nebulosa, marca tal coisa" 😿'); 
        }
    }
});

bot.launch();
