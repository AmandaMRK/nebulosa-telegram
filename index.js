const { Telegraf } = require('telegraf');
const { google } = require('googleapis');

const bot = new Telegraf(process.env.TELEGRAM_TOKEN);

function getCalendarClient() {
  const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
  const token = JSON.parse(process.env.GOOGLE_TOKEN);
  const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  oAuth2Client.setCredentials(token);
  return google.calendar({ version: 'v3', auth: oAuth2Client });
}

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
    console.error('Erro ao buscar agenda:', error);
    ctx.reply('Ops! Ocorreu um erro ao acessar o Google Calendar.');
  }
});

bot.launch().then(() => {
  console.log('Nebulosa iniciada com sucesso no Railway!');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
