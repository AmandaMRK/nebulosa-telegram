const { Telegraf, Markup } = require('telegraf');
const cron = require('node-cron');
const axios = require('axios');
const fs = require('fs');
const base64 = require('base-64');

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

// Autenticação segura da Astronomy API
let auth = '';
if (process.env.ASTRONOMY_API_ID && process.env.ASTRONOMY_API_SECRET) {
    auth = base64.encode(`${process.env.ASTRONOMY_API_ID}:${process.env.ASTRONOMY_API_SECRET}`);
}

function painelMenu() {
    return Markup.inlineKeyboard([
        [Markup.button.callback('📅 Meus compromissos', 'menu_hoje')],
        [Markup.button.callback('🔭 Eventos do Céu (Lua)', 'menu_astronomia')],
        [Markup.button.callback('🪐 Foto do Dia (NASA)', 'menu_ceu')],
        [Markup.button.callback('🗑️ Apagar compromissos', 'menu_apagar')]
    ]);
}

// Comandos principais /start e /menu
bot.command(['start', 'menu', 'ajuda'], async (ctx) => {
    return ctx.reply('🪐 *Painel de Controle Estelar - Nebulosa* 🪐\n\nEscolha uma opção abaixo:', painelMenu());
});

// Mensagem de texto geral (trata o ceu: e menu escrito)
bot.on('text', async (ctx) => {
    const t = ctx.message.text.toLowerCase().trim();

    if (t === 'menu' || t === 'ajuda') {
        return ctx.reply('🪐 *Painel Estelar* 🪐', painelMenu());
    }

    if (t.startsWith('ceu:')) {
        const dataDesejada = t.replace('ceu:', '').trim();
        try {
            const resNasa = await axios.get(`https://api.nasa.gov/planetary/apod?api_key=${process.env.NASA_API_KEY}&date=${dataDesejada}`);
            const d = resNasa.data;
            let legenda = `🌌 *Céu de ${dataDesejada}:* 🪐\n\n*Título:* ${d.title}\n\n${d.explanation ? d.explanation.substring(0, 300) + '...' : ''}`;
            
            if (d.media_type === 'image') {
                return ctx.replyWithPhoto(d.url, { caption: legenda, parse_mode: 'Markdown' });
            } else {
                return ctx.reply(legenda + `\n\n[Ver mídia](${d.url})`, { parse_mode: 'Markdown' });
            }
        } catch (e) {
            return ctx.reply('⚠️ Não consegui buscar a foto. Use o formato `ceu: AAAA-MM-DD` e verifique se a data está correta.');
        }
    }
});

// Botão da Lua / Astronomia
bot.action('menu_astronomia', async (ctx) => {
    try {
        if (!auth) {
            return ctx.editMessageText('⚠️ As credenciais da Astronomy API não foram configuradas.', Markup.inlineKeyboard([[Markup.button.callback('⬅️ Voltar', 'voltar_menu')]]));
        }
        const res = await axios.get('https://api.astronomyapi.com/api/v2/studio/moon-phase', {
            headers: { 'Authorization': `Basic ${auth}` },
            params: { format: 'png', style: { moonStyle: 'default' }, observer: { latitude: -23.55, longitude: -46.63, date: new Date().toISOString().split('T')[0] } }
        });
        
        const imageUrl = res.data.data.imageUrl;
        await ctx.deleteMessage();
        await ctx.replyWithPhoto(imageUrl, { caption: "🌙 *Fase da Lua hoje:*", parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Voltar', 'voltar_menu')]]) });
    } catch (e) {
        await ctx.editMessageText('⚠️ Erro ao consultar a fase da lua na API.', Markup.inlineKeyboard([[Markup.button.callback('⬅️ Voltar', 'voltar_menu')]]));
    }
});

bot.action('menu_hoje', async (ctx) => {
    const itens = dados.agenda.filter(i => i.data === getDataHoje());
    const msg = itens.length === 0 ? '🪐 Órbita livre hoje!' : `📅 *Hoje:* ` + itens.map(i => i.titulo).join(', ');
    await ctx.editMessageText(msg, { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Voltar', 'voltar_menu')]]) });
});

bot.action('menu_ceu', async (ctx) => {
    await ctx.editMessageText('🪐 Digite no chat:\n`ceu: AAAA-MM-DD`', { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Voltar', 'voltar_menu')]]) });
});

bot.action('menu_apagar', async (ctx) => {
    const botoes = [[Markup.button.callback('⬅️ Voltar', 'voltar_menu')]];
    if (dados.agenda.length === 0) return ctx.editMessageText('🗑️ Nada para apagar!', Markup.inlineKeyboard(botoes));
    let listaBotoes = dados.agenda.map((item, idx) => [Markup.button.callback(`🗑️ [${idx + 1}] ${item.titulo}`, `del_${idx}`)]);
    listaBotaes.push([Markup.button.callback('⬅️ Voltar', 'voltar_menu')]);
    await ctx.editMessageText('🗑️ Qual deseja apagar?', Markup.inlineKeyboard(listaBotoes));
});

bot.action('voltar_menu', async (ctx) => {
    await ctx.editMessageText('🪐 *Painel Estelar - Nebulosa* 🪐', painelMenu());
});

bot.launch();
console.log('Nebulosa Estelar definitiva rodando!');
