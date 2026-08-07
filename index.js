const { Telegraf } = require('telegraf');
const { google } = require('googleapis');
const cron = require('node-cron');
const axios = require('axios');

const bot = new Telegraf(process.env.TELEGRAM_TOKEN);
const MEU_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

function getCalendarClient() {
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    const token = JSON.parse(process.env.GOOGLE_TOKEN);
    const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
    oAuth2Client.setCredentials(token);
    return google.calendar({ version: 'v3', auth: oAuth2Client });
}

// -----------------------------------------------------------------
// NOTIFICAÇÃO DA NASA (Todo dia às 08:00) 🚀
// -----------------------------------------------------------------
cron.schedule('0 8 * * *', async () => {
    if (!MEU_CHAT_ID) return;
    try {
        const res = await axios.get('https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY');
        const d = res.data;
        let msg = `✨ *Bom dia, Amanda!* ✨\n\nOlha o que a NASA trouxe para você hoje: *${d.title}* 🌌\n\n${d.explanation.substring(0, 300)}...\n\n[Veja a foto aqui](${d.url}) 🔭💜`;
        bot.telegram.sendMessage(MEU_CHAT_ID, msg, { parse_mode: 'Markdown' });
    } catch (e) { console.error(e); }
});

// -----------------------------------------------------------------
// INTELIGÊNCIA DA NEBULOSA 💜
// -----------------------------------------------------------------
bot.on('text', async (ctx) => {
    const texto = ctx.message.text;
    const t = texto.toLowerCase();
    const calendar = getCalendarClient();

    // 1. Mostrar Agenda
    if (t.includes('agenda') || t.includes('eventos') || t.includes('mostra')) {
        try {
            const res = await calendar.events.list({ 
                calendarId: 'primary', 
                timeMin: (new Date()).toISOString(), 
                maxResults: 15, 
                singleEvents: true, 
                orderBy: 'startTime' 
            });
            
            const events = res.data.items;
            if (!events || events.length === 0) return ctx.reply('Sua agenda está limpinha! 🎉 Nada por aqui hoje. ☁️');
            
            let msg = '📅 *Sua lista de compromissos:*\n\n';
            events.forEach((e, i) => {
                const dataInicio = e.start.dateTime ? new Date(e.start.dateTime).toLocaleString('pt-BR') : e.start.date;
                msg += `${i + 1}. *${e.summary}* (${dataInicio}) ⏳\n`;
            });
            msg += '\n*Dica:* Para apagar, digite apenas o número, por exemplo: "apagar 2" 🧹';
            return ctx.replyWithMarkdown(msg);
        } catch (err) {
            console.error(err);
            return ctx.reply('Ops, deu ruim ao buscar sua agenda! 😿');
        }
    }

    // 2. Apagar evento por número (Super seguro e preciso)
    if (t.includes('apagar')) {
        try {
            const num = parseInt(t.match(/\d+/));
            if (isNaN(num)) return ctx.reply('Amanda, preciso do número do evento. Exemplo: "apagar 2" 🧐');
            
            const res = await calendar.events.list({ 
                calendarId: 'primary', 
                timeMin: (new Date()).toISOString(), 
                maxResults: 15, 
                singleEvents: true, 
                orderBy: 'startTime' 
            });
            
            const evento = res.data.items[num - 1];
            if (!evento) {
                return ctx.reply('Não achei nenhum evento com esse número na sua lista atual. 🧐');
            }

            // Se for um evento recorrente (como os Parabéns), deletamos a instância ou o evento pai
            const eventIdToDelete = evento.recurringEventId || evento.id;

            await calendar.events.delete({ 
                calendarId: 'primary', 
                eventId: eventIdToDelete 
            });

            return ctx.reply(`🧹 Prontinho! Apaguei "${evento.summary}" da sua agenda. Tchauzinho! 👋💜`);
        } catch (err) {
            console.error('Erro detalhado ao apagar:', err);
            return ctx.reply('Erro ao tentar apagar o evento. 😢');
        }
    }

    // 3. Marcar Compromisso
    if (t.includes('marca')) {
        const regexHora = /(\d{2})[h:](\d{2})?/;
        const matchHora = texto.match(regexHora);
        
        let horaStr = '09:00';
        if (matchHora) {
            const h = matchHora[1];
            const m = matchHora[2] || '00';
            horaStr = `${h}:${m}`;
        }

        const éFixo = t.includes('fixo') || t.includes('toda') || t.includes('toda semana');
        
        const regexData = /(\d{2})\/(\d{2})(?:\/(\d{4}))?/;
        const matchData = texto.match(regexData);

        let dataFormatada = '';
        if (matchData) {
            const dia = matchData[1];
            const mes = matchData[2];
            const ano = matchData[3] || '2026';
            dataFormatada = `${ano}-${mes}-${dia}`;
        } else {
            const hoje = new Date();
            dataFormatada = hoje.toISOString().split('T')[0];
        }

        const startDateTime = `${dataFormatada}T${horaStr}:00-03:00`;
        const [hNum, mNum] = horaStr.split(':');
        const endH = String(Number(hNum) + 1).padStart(2, '0');
        const endDateTime = `${dataFormatada}T${endH}:${mNum}:00-03:00`;

        let summary = texto
            .replace(/nebulosa,?/gi, '')
            .replace(/marca/gi, '')
            .replace(/fixo/gi, '')
            .replace(/toda semana/gi, '')
            .replace(/toda/gi, '')
            .replace(regexData, '')
            .replace(regexHora, '')
            .replace(/dia/gi, '')
            .replace(/s às/gi, '')
            .replace(/as/gi, '')
            .replace(/às/gi, '')
            .trim();

        if (!summary) summary = 'Compromisso';

        try {
            const eventBody = {
                summary: summary,
                start: { dateTime: startDateTime, timeZone: 'America/Sao_Paulo' },
                end: { dateTime: endDateTime, timeZone: 'America/Sao_Paulo' },
                reminders: {
                    useDefault: false,
                    overrides: [
                        { method: 'popup', minutes: 1440 },
                        { method: 'popup', minutes: 120 }
                    ]
                }
            };

            if (éFixo) {
                eventBody.recurrence = ['RRULE:FREQ=WEEKLY'];
            }

            await calendar.events.insert({
                calendarId: 'primary',
                requestBody: eventBody
            });

            const tipoMsg = éFixo ? 'fixado toda semana 🔄' : 'marcado 📌';
            return ctx.reply(`Anotado, Amanda! ✍️ "${summary}" foi ${tipoMsg} para ${horaStr} com notificações ativadas! 🧿💜`);
        } catch (error) {
            console.error(error);
            return ctx.reply('Ops, deu um errinho ao tentar salvar no Google Calendar. Tenta de novo? 😿');
        }
    }
});

bot.launch();
console.log('Nebulosa está rodando com sucesso!');
