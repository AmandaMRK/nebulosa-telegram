const { Telegraf, Markup } = require('telegraf');
const cron = require('node-cron');
const axios = require('axios');
const fs = require('fs');

require('dotenv').config();

const bot = new Telegraf(process.env.TELEGRAM_TOKEN);
const MEU_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const ARQUIVO_DADOS = './agenda.json';

let dados = { agenda: [] };
if (fs.existsSync(ARQUIVO_DADOS)) {
    try { dados = JSON.parse(fs.readFileSync(ARQUIVO_DADOS, 'utf8')); } catch (e) {}
}

function salvarDados() {
    fs.writeFileSync(ARQUIVO_DADOS, JSON.stringify(dados, null, 2));
}

function getDataHoje() {
    return new Date().toLocaleDateString('pt-BR');
}

function painelMenu() {
    return Markup.inlineKeyboard([
        [Markup.button.callback('📅 Meus compromissos de hoje', 'menu_hoje')],
        [Markup.button.callback('➕ Marcar compromisso', 'menu_marcar')],
        [Markup.button.callback('🪐 Ver céu de outra data', 'menu_ceu')],
        [Markup.button.callback('⏰ Horários livres', 'menu_livres')],
        [Markup.button.callback('📋 Verificar todos os compromissos', 'menu_todos')],
        [Markup.button.callback('✏️ Editar compromissos', 'menu_editar')],
        [Markup.button.callback('🗑️ Apagar compromissos', 'menu_apagar')]
    ]);
}

// NASA e Resumo Diário às 08:00
cron.schedule('0 8 * * *', async () => {
    if (!MEU_CHAT_ID) return;
    try {
        const resNasa = await axios.get(`https://api.nasa.gov/planetary/apod?api_key=${process.env.NASA_API_KEY}`);
        const d = resNasa.data;
        let msg = `🌌 *Bom dia, Amanda!* 🪐\n\n*NASA de Hoje:* ${d.title}\n[Ver imagem](${d.url})\n\n`;
        
        const hoje = getDataHoje();
        dados.agenda = dados.agenda.filter(i => i.data === hoje || i.recorrente === true);
        salvarDados();

        const itens = dados.agenda.filter(i => i.data === hoje);
        msg += itens.length > 0 ? `📅 *Hoje:* \n` + itens.map((i, idx) => `  ${idx + 1}. ✨ *${i.titulo}* (${i.hora})`).join('\n') : `  📅 *Agenda livre hoje!* 🥳🪐`;
        
        bot.telegram.sendMessage(MEU_CHAT_ID, msg, { parse_mode: 'Markdown' });
    } catch (e) { 
        console.log("Erro no envio diário:", e); 
    }
});

// Lembrete automático recorrente toda quinta-feira às 09:00
cron.schedule('0 9 * * 4', async () => {
    if (!MEU_CHAT_ID) return;
    try {
        const lembretes = dados.agenda.filter(i => i.recorrente === true);
        for (const item of lembretes) {
            await bot.telegram.sendMessage(MEU_CHAT_ID, `📅 *Lembrete Semanal:* ${item.titulo} 🪐`, { parse_mode: 'Markdown' });
        }
    } catch (e) {}
});

bot.command(['start', 'menu', 'ajuda'], async (ctx) => {
    return ctx.reply('🪐 *Painel de Controle Estelar - Nebulosa* 🪐\n\nEscolha uma opção abaixo:', painelMenu());
});

bot.on('text', async (ctx) => {
    const t = ctx.message.text.toLowerCase();

    if (t === 'menu' || t === 'ajuda') {
        return ctx.reply('🪐 *Painel Estelar* 🪐', painelMenu());
    }

    if (t.startsWith('ceu:')) {
        const dataDesejada = t.replace('ceu:', '').trim();
        try {
            const resNasa = await axios.get(`https://api.nasa.gov/planetary/apod?api_key=${process.env.NASA_API_KEY}&date=${dataDesejada}`);
            const d = resNasa.data;
            let msg = `🌌 *Céu de ${dataDesejada}:* 🪐\n\n*Título:* ${d.title}\n[Ver imagem](${d.url})\n\n`;
            return ctx.reply(msg, { parse_mode: 'Markdown' });
        } catch (e) {
            return ctx.reply('⚠️ Não consegui buscar a foto. Use o formato `ceu: AAAA-MM-DD` e verifique se a data está correta.');
        }
    }

    if (t.startsWith('marcar:')) {
        const info = t.replace('marcar:', '').trim();
        const ehRecorrente = info.toLowerCase().includes('toda quinta');
        dados.agenda.push({ titulo: info, data: ehRecorrente ? 'Toda Quinta' : getDataHoje(), hora: '09:00', recorrente: ehRecorrente });
        salvarDados();
        return ctx.reply(ehRecorrente ? `🪐✨ Lembrete "${info}" configurado!` : `🪐✨ Compromisso "${info}" salvo!`);
    }

    if (t.startsWith('editar:')) {
        const partes = t.replace('editar:', '').split(':');
        const index = parseInt(partes[0].trim());
        const novoTexto = partes[1] ? partes[1].trim() : '';
        if (dados.agenda[index]) {
            dados.agenda[index].titulo = novoTexto;
            salvarDados();
            return ctx.reply('✏️ Compromisso atualizado!');
        }
    }
});

bot.action('menu_hoje', async (ctx) => {
    const itens = dados.agenda.filter(i => i.data === getDataHoje());
    const msg = itens.length === 0 ? '🪐 Órbita livre!' : `📅 *Hoje:* ` + itens.map(i => i.titulo).join(', ');
    await ctx.editMessageText(msg, { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Voltar', 'voltar_menu')]]) });
});

bot.action('menu_ceu', async (ctx) => {
    await ctx.editMessageText('🪐 Digite: `ceu: AAAA-MM-DD`', { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Voltar', 'voltar_menu')]]) });
});

bot.action('voltar_menu', async (ctx) => {
    await ctx.editMessageText('🪐 *Painel Estelar - Nebulosa* 🪐', painelMenu());
});

// ... (o restante das ações de menu permanece igual)
bot.launch();
console.log('Nebulosa Estelar v2 rodando!');
