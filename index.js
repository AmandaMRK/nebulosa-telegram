const { Telegraf } = require('telegraf');
const { google } = require('googleapis');
const cron = require('node-cron');
const axios = require('axios');

const bot = new Telegraf(process.env.TELEGRAM_TOKEN);
const MEU_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Lista de tarefas temporária em memória (você pode anotar coisas aqui)
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
// 1. ROTINA DIÁRIA DAS 08:00 (NASA + RESUMO DA AGENDA DO DIA) 🚀📅
// -----------------------------------------------------------------
cron.schedule('0 8 * * *', async () => {
    if (!MEU_CHAT_ID) return;
    try {
        // Parte da NASA
        const resNasa = await axios.get('https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY');
        const d = resNasa.data;
        let msg = `✨ *Bom dia, Amanda!* ✨\n\nOlha o que a NASA trouxe para você hoje: *${d.title}* 🌌\n\n${d.explanation.substring(0, 250)}...\n\n[Veja a foto aqui](${d.url}) 🔭\n\n`;

        // Parte do Resumo da Agenda
        try {
            const calendar = getCalendarClient();
            const hojeInicio = new Date();
            hojeInicio.setHours(0, 0, 0, 0);
            const hojeFim = new Date();
            hojeFim.setHours(23, 59, 59, 999);

            const resAgenda = await calendar.events.list({
                calendarId: 'primary',
                timeMin: hojeInicio.toISOString(),
                timeMax: hojeFim.toISOString(),
                singleEvents: true,
                orderBy: 'startTime',
            });

            const eventosHoje = resAgenda.data.items;
            if (eventosHoje && eventosHoje.length > 0) {
                msg += `📅 *Compromissos para hoje:*\n`;
                eventosHoje.forEach((e) => {
                    const hora = e.start.dateTime ? new Date(e.start.dateTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'Dia todo';
                    msg.push(`- *${e.summary}* (${hora}) ⏳\n`);
                });
            } else {
                msg += `📅 *Sua agenda de hoje está livre!* Aproveite o dia! 🎉☁️`;
            }
        } catch (errAgenda) {
            console.error('Erro ao buscar agenda no cron:', errAgenda);
        }

        bot.telegram.sendMessage(MEU_CHAT_ID, msg, { parse_mode: 'Markdown' });
    } catch (e) { console.error('Erro no cron:', e); }
});

// -----------------------------------------------------------------
// INTELIGÊNCIA DA NEBULOSA (Texto e Áudio) 💜
// -----------------------------------------------------------------
bot.on(['text', 'voice'], async (ctx) => {
    let texto = '';

    // 3. Suporte a Áudio (O Telegram manda o link do arquivo de voz)
    if (ctx.message.voice) {
        try {
            const fileLink = await ctx.telegram.getFileLink(ctx.message.voice.file_id);
            return ctx.reply(`Ouvi seu áudio, Amanda! 🎤 Mas para eu transcrever certinho por texto, por enquanto prefiro que você digite para mim, tá bom? Assim não erro nada! 💜✨`);
        } catch (err) {
            return ctx.reply('Recebi seu áudio, mas tive um probleminha para processar. Tenta digitar para mim? 😿');
        }
    } else {
        texto = ctx.message.text;
    }

    const t = texto.toLowerCase();
    const calendar = getCalendarClient();

    // 2. Sistema de Tarefas (Para / To-Do)
    if (t.includes('tarefa') || t.includes('anotar')) {
        const itemTarefa = texto.replace(/nebulosa,?/gi, '').replace(/tarefa/gi, '').replace(/anotar/gi, '').trim();
        if (itemTarefa) {
            listaDeTarefas.push(itemTarefa);
            return ctx.reply(`Anotado na sua lista de tarefas! 📝 "${itemTarefa}" foi guardado com sucesso. 💜`);
        } else {
            if (listaDeTarefas.length === 0) {
                return ctx.reply('Sua lista de tarefas está vazia! 📋✨');
            }
            let msgLista = '📋 *Sua Lista de Tarefas:*\n\n';
            listaDeTarefas.forEach((item, index) => {
                msgLista += `${index + 1}. ${item}\n`;
            });
            msgLista += '\n*Dica:* Para remover uma tarefa concluída, digite "remover tarefa [número]" 🧹';
            return ctx.replyWithMarkdown(msgLista);
        }
    }

    // Remover tarefa concluída
    if (t.includes('remover tarefa')) {
        const num = parseInt(t.match(/\d+/));
        if (!isNaN(num) && listaDeTarefas[num - 1]) {
            const removido = listaDeTarefas.splice(num - 1, 1);
            return ctx.reply(`✅ Tarefa "${removido}" concluída e removida da lista! Muito bem! 🎉💜`);
        }
        return ctx.reply('Não achei esse número na sua lista de tarefas, Amanda. 🧐');
    }

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
            msg += '\n*Dica:* Para apagar da agenda, digite "apagar [número]" 🧹';
            return ctx.replyWithMarkdown(msg);
        } catch (err) {
            console.error(err);
            return ctx.reply('Ops, deu ruim ao buscar sua agenda! 😿');
        }
    }

    // Apagar evento da agenda
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

            const eventIdToDelete = evento.recurringEventId || evento.id;
            await calendar.events.delete({ calendarId: 'primary', eventId: eventIdToDelete });

            return ctx.reply(`🧹 Prontinho! Apaguei "${evento.summary}" da sua agenda. Tchauzinho! 👋💜`);
        } catch (err) {
            console.error('Erro detalhado ao apagar:', err);
            return ctx.reply('Erro ao tentar apagar o evento. 😢');
        }
    }

    // Marcar Compromisso na Agenda
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

            await calendar.events.insert({ calendarId: 'primary', requestBody: eventBody });

            const tipoMsg = éFixo ? 'fixado toda semana 🔄' : 'marcado 📌';
            return ctx.reply(`Anotado, Amanda! ✍️ "${summary}" foi ${tipoMsg} para ${horaStr} com notificações ativadas! 🧿💜`);
        } catch (error) {
            console.error(error);
            return ctx.reply('Ops, deu um errinho ao tentar salvar no Google Calendar. Tenta de novo? 😿');
        }
    }
});

bot.launch();
console.log('Nebulosa está rodando com sucesso e completa!');
