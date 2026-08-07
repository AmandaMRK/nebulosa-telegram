const { Telegraf } = require('telegraf');
const cron = require('node-cron');
const axios = require('axios');

const bot = new Telegraf(process.env.TELEGRAM_TOKEN);
const MEU_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Bancos de dados internos da Nebulosa
let minhaAgenda = [];
let listaDeTarefas = [];

// Função auxiliar para formatar a data de hoje (DD/MM/YYYY)
function getDataHoje() {
    const hoje = new Date();
    const dia = String(hoje.getDate()).padStart(2, '0');
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const ano = hoje.getFullYear();
    return `${dia}/${mes}/${ano}`;
}

// Função auxiliar para formatar a data de amanhã (DD/MM/YYYY)
function getDataAmanha() {
    const amanha = new Date();
    amanha.setDate(amanha.getDate() + 1);
    const dia = String(amanha.getDate()).padStart(2, '0');
    const mes = String(amanha.getMonth() + 1).padStart(2, '0');
    const ano = amanha.getFullYear();
    return `${dia}/${mes}/${ano}`;
}

// -----------------------------------------------------------------
// 1. ROTINA DE 08:00 (NASA + RESUMO DO DIA + ALERTA DE AMANHÃ) 🚀📅
// -----------------------------------------------------------------
cron.schedule('0 8 * * *', async () => {
    if (!MEU_CHAT_ID) return;
    try {
        const resNasa = await axios.get('https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY');
        const d = resNasa.data;
        let msg = `✨ *Bom dia, Amanda!* ✨\n\nNotícia espacial: *${d.title}* 🌌\n\n[Veja a foto aqui](${d.url})\n\n`;

        const hojeStr = getDataHoje();
        const amanhaStr = getDataAmanha();

        // Filtra eventos de hoje
        const compromissosHoje = minhaAgenda.filter(item => item.data === hojeStr);
        // Filtra eventos de amanhã (antecipação)
        const compromissosAmanha = minhaAgenda.filter(item => item.data === amanhaStr);

        if (compromissosHoje.length > 0) {
            msg += `📅 *Compromissos para hoje (${hojeStr}):*\n`;
            compromissosHoje.forEach((item) => {
                msg += `- *${item.compromisso}* ⏳\n`;
            });
            msg += `\n`;
        } else {
            msg += `📅 *Nenhum compromisso agendado para hoje!* 🎉\n\n`;
        }

        if (compromissosAmanha.length > 0) {
            msg += `⚠️ *Aviso importante (Para amanhã - ${amanhaStr}):*\n`;
            compromissosAmanha.forEach((item) => {
                msg += `- *${item.compromisso}* 🔔\n`;
            });
        }

        bot.telegram.sendMessage(MEU_CHAT_ID, msg, { parse_mode: 'Markdown' });
    } catch (e) { console.error(e); }
});

// -----------------------------------------------------------------
// 2. COMANDOS DA NEBULOSA 💜
// -----------------------------------------------------------------
bot.on('text', async (ctx) => {
    const texto = ctx.message.text;
    const t = texto.toLowerCase();

    // A. Mostrar Agenda
    if (t.includes('agenda') || t.includes('mostra') || t.includes('eventos')) {
        if (minhaAgenda.length === 0) {
            return ctx.reply('Sua agenda interna está limpinha! 🎉 Nada por aqui. ☁️');
        }
        
        let msg = '📅 *Sua Agenda Interna Completa:*\n\n';
        minhaAgenda.forEach((item, index) => {
            msg += `${index + 1}. *${item.compromisso}* — 🗓️ ${item.data} ⏳\n`;
        });
        msg += '\n*Dica:* Para apagar, digite "apagar agenda [número]" 🧹';
        return ctx.replyWithMarkdown(msg);
    }

    // B. Apagar Compromisso da Agenda
    if (t.includes('apagar agenda')) {
        const num = parseInt(t.match(/\d+/));
        if (!isNaN(num) && minhaAgenda[num - 1]) {
            const removido = minhaAgenda.splice(num - 1, 1);
            return ctx.reply(`🧹 Prontinho! Apaguei "${removido[0].compromisso}" da sua agenda. 👋💜`);
        }
        return ctx.reply('Não achei esse número na sua agenda, Amanda. 🧐');
    }

    // C. Marcar Compromisso (Ex: "Nebulosa, marca poupatempo 11/08/2026")
    if (t.includes('marca')) {
        const regexData = /(\d{2})\/(\d{2})\/(\d{4})/;
        const matchData = texto.match(regexData);
        
        let dataCompromisso = matchData ? matchData[0] : getDataHoje();

        let resumo = texto
            .replace(/nebulosa,?/gi, '')
            .replace(/marca/gi, '')
            .replace(/para mim/gi, '')
            .replace(regexData, '')
            .trim();

        if (!resumo) resumo = 'Compromisso';

        minhaAgenda.push({ compromisso: resumo, data: dataCompromisso });
        return ctx.reply(`Anotado, Amanda! ✍️ "${resumo}" foi fixado na sua agenda para o dia ${dataCompromisso}! Todo dia de manhã (e na véspera) eu vou te lembrar dele! 🧿💜`);
    }

    // D. Sistema de Tarefas (To-Do)
    if (t.includes('tarefa') || t.includes('anotar')) {
        const itemTarefa = texto.replace(/nebulosa,?/gi, '').replace(/tarefa/gi, '').replace(/anotar/gi, '').trim();
        if (itemTarefa) {
            listaDeTarefas.push(itemTarefa);
            return ctx.reply(`Anotado na lista de tarefas! 📝 "${itemTarefa}" guardado com sucesso. 💜`);
        } else {
            if (listaDeTarefas.length === 0) return ctx.reply('Sua lista de tarefas está vazia! 📋✨');
            let msgLista = '📋 *Sua Lista de Tarefas:*\n\n';
            listaDeTarefas.forEach((item, index) => {
                msgLista += `${index + 1}. ${item}\n`;
            });
            msgLista += '\n*Dica:* Para concluir, digite "remover tarefa [número]" 🧹';
            return ctx.replyWithMarkdown(msgLista);
        }
    }

    // E. Remover Tarefa
    if (t.includes('remover tarefa')) {
        const num = parseInt(t.match(/\d+/));
        if (!isNaN(num) && listaDeTarefas[num - 1]) {
            const removido = listaDeTarefas.splice(num - 1, 1);
            return ctx.reply(`✅ Tarefa "${removido}" concluída e removida! 🎉💜`);
        }
        return ctx.reply('Não achei esse número na sua lista de tarefas, Amanda. 🧐');
    }
});

bot.launch();
console.log('Nebulosa inteligente e com lembretes ativada!');
