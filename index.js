const { Telegraf } = require('telegraf');
const { google } = require('googleapis');
const cron = require('node-cron');
const axios = require('axios');

const bot = new Telegraf(process.env.TELEGRAM_TOKEN);

// IMPORTANTE: Coloque aqui o seu ID numérico do Telegram para a NASA mandar mensagem para você
const MEU_CHAT_ID = process.env.TELEGRAM_CHAT_ID || 'SEU_CHAT_ID_AQUI';

function getCalendarClient() {
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    const token = JSON.parse(process.env.GOOGLE_TOKEN);
    const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
    
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
    oAuth2Client.setCredentials(token);
    
    return google.calendar({ version: 'v3', auth: oAuth2Client });
}

// -----------------------------------------------------------------
// ROTINA AUTOMÁTICA DA NASA (Roda todo dia às 08:00 da manhã)
// -----------------------------------------------------------------
cron.schedule('0 8 * * *', async () => {
    if (!MEU_CHAT_ID || MEU_CHAT_ID === 'SEU_CHAT_ID_AQUI') return;
    try {
        const resposta = await axios.get('https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY');
        const dados = resposta.data;

        let mensagem = `🚀 *Bom dia, Amanda! Notícia do Espaço hoje:*\n\n`;
        mensagem += `*${dados.title}*\n\n`;
        mensagem += `${dados.explanation}\n\n`;
        if (dados.url) {
            mensagem += `[Ver Imagem do Dia](${dados.url})`;
        }

        bot.telegram.sendMessage(MEU_CHAT_ID, mensagem, { parse_mode: 'Markdown' });
    } catch (error) {
        console.error('Erro ao buscar dados da NASA:', error);
    }
});

// -----------------------------------------------------------------
// INTELIGÊNCIA DE TEXTO (Agenda e Marcação)
// -----------------------------------------------------------------
bot.on('text', async (ctx) => {
    const texto = ctx.message.text;
    const textoMinusculo = texto.toLowerCase();

    // 1. Mostrar Eventos / Agenda
    if (textoMinusculo.includes('mostra') || textoMinusculo.includes('meus eventos') || textoMinusculo.includes('agenda')) {
        try {
            const calendar = getCalendarClient();
            const response = await calendar.events.list({
                calendarId: 'primary',
                timeMin: (new Date()).toISOString(),
                maxResults: 10,
                singleEvents: true,
                orderBy: 'startTime',
            });
            
            const events = response.data.items;
            if (!events || events.length === 0) {
                return ctx.reply('Nenhum compromisso encontrado nos próximos dias! 🎉');
            }

            let mensagem = '📅 *Seus próximos compromissos:*\n\n';
            events.forEach((event) => {
                const start = event.start.dateTime ? new Date(event.start.dateTime).toLocaleDateString('pt-BR') : event.start.date;
                mensagem += `- *${event.summary}* (${start})\n`;
            });
            
            return ctx.replyWithMarkdown(mensagem);
        } catch (error) {
            console.error(error);
            return ctx.reply('Ops, deu um erro ao buscar a agenda.');
        }
    }

    // 2. Marcar Compromisso (Linguagem Natural com formato brasileiro DD/MM/AAAA)
    if (textoMinusculo.includes('marca')) {
        const regexData = /(\d{2})\/(\d{2})(?:\/(\d{4}))?/;
        const matchData = texto.match(regexData);

        if (!matchData) {
            return ctx.reply('Não consegui identificar a data. Tente algo como: "Nebulosa, marca reunião dia 15/08/2026"');
        }

        const dia = matchData[1];
        const mes = matchData[2];
        const ano = matchData[3] || '2026';
        const dataFormatada = `${ano}-${mes}-${dia}`;

        let summary = texto
            .replace(/nebulosa,?/gi, '')
            .replace(/marca/gi, '')
            .replace(regexData, '')
            .replace(/dia/gi, '')
            .replace(/no/gi, '')
            .replace(/para/gi, '')
            .trim();

        if (!summary) {
            summary = 'Compromisso sem título';
        }

        try {
            const calendar = getCalendarClient();
            await calendar.events.insert({
                calendarId: 'primary',
                requestBody: {
                    summary: summary,
                    start: { date: dataFormatada },
                    end: { date: dataFormatada }
                }
            });
            return ctx.reply(`Prontinho! Marquei "${summary}" para o dia ${dia}/${mes}/${ano}. 🚀💜`);
        } catch (error) {
            console.error(error);
            return ctx.reply('Ops, deu erro ao tentar salvar no Google Calendar.');
        }
    }
});

bot.launch();
console.log('Nebulosa está rodando com sucesso!');
