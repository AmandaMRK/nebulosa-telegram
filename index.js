const { Telegraf } = require('telegraf');
const express = require('express');
const { google } = require('googleapis');

// 1. Configuração do Servidor HTTP (O que mantém o bot acordado no Render)
const app = express();
// O Render injeta a variável PORT automaticamente, mas garantimos o 10000 como fallback
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => {
  res.send('Nebulosa está online!');
});

// AQUI ESTÁ O PULO DO GATO: o '0.0.0.0' garante que o Render encontre a porta aberta
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor HTTP ouvindo na porta ${PORT}`);
});

// 2. Inicialização do Bot do Telegram
const bot = new Telegraf(process.env.TELEGRAM_TOKEN);

// 3. Configuração da Autenticação do Google Calendar
function getCalendarClient() {
  const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
  const token = JSON.parse(process.env.GOOGLE_TOKEN);

  const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  
  oAuth2Client.setCredentials(token);
  return google.calendar({ version: 'v3', auth: oAuth2Client });
}

// 4. Comando /agenda
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

// 5. Inicialização do Bot
bot.launch().then(() => {
  console.log('Nebulosa com Radar da NASA iniciada com sucesso!');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
