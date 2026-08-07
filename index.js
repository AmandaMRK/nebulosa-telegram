const { Telegraf } = require('telegraf');
const { google } = require('googleapis');

// Inicializa o bot do Telegram usando a variável de ambiente
const bot = new Telegraf(process.env.TELEGRAM_TOKEN);

// Função para autenticar e criar o cliente do Google Calendar
function getCalendarClient() {
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    const token = JSON.parse(process.env.GOOGLE_TOKEN);
    const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
    
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
    oAuth2Client.setCredentials(token);
    
    return google.calendar({ version: 'v3', auth: oAuth2Client });
}

// 1. Comando /agenda: Lista os próximos compromissos
bot.command('agenda', async (ctx) => {
    try {
        const calendar = getCalendarClient();
        const response = await calendar.events.list({
            calendarId: 'primary',
            timeMin: (new Date()).toISOString(),
            maxResults: 5,
            singleEvents: true,
            orderBy: 'startTime',
        });
        
        const events = response.data.items;
        if (!events || events.length === 0) {
            return ctx.reply('Nenhum compromisso encontrado nos próximos dias! 🎉');
        }

        let mensagem = '📅 *Seus próximos compromissos:*\n\n';
        events.forEach((event) => {
            const start = event.start.dateTime || event.start.date;
            mensagem += `- *${event.summary}* (${start})\n`;
        });
        
        ctx.replyWithMarkdown(mensagem);
    } catch (error) {
        console.error(error);
        ctx.reply('Ops, deu um erro ao buscar a agenda.');
    }
});

// 2. Comando /marcar: Cria um novo evento no calendário
bot.command('marcar', async (ctx) => {
    // Exemplo de uso no Telegram: /marcar 2026-08-10 Reunião importante
    const args = ctx.message.text.split(' ');
    if (args.length < 3) {
        return ctx.reply('Use assim: /marcar AAAA-MM-DD Nome do Evento');
    }
    
    const date = args[1];
    const summary = args.slice(2).join(' ');
    
    try {
        const calendar = getCalendarClient();
        await calendar.events.insert({
            calendarId: 'primary',
            requestBody: {
                summary: summary,
                start: { date: date },
                end: { date: date }
            }
        });
        ctx.reply(`Feito! Marquei "${summary}" no dia ${date}. 🚀`);
    } catch (error) {
        console.error(error);
        ctx.reply('Ops, não consegui marcar. Verifique se a data está no formato correto (AAAA-MM-DD).');
    }
});

// Inicializa o bot
bot.launch();
console.log('Nebulosa está rodando e pronta para o trabalho!');
