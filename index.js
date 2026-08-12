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

let auth = '';
if (process.env.ASTRONOMY_API_ID && process.env.ASTRONOMY_API_SECRET) {
    auth = base64.encode(`${process.env.ASTRONOMY_API_ID}:${process.env.ASTRONOMY_API_SECRET}`);
}

function painelMenu() {
    return Markup.inlineKeyboard([
        [Markup.button.callback('📅 Hoje', 'menu_hoje'), Markup.button.callback('➕ Marcar', 'menu_marcar')],
        [Markup.button.callback('🔭 Lua/Astronomia', 'menu_astronomia'), Markup.button.callback('🪐 Foto NASA', 'menu_ceu')],
        [Markup.button.callback('📋 Todos', 'menu_todos'), Markup.button.callback('✏️ Editar', 'menu_editar')],
        [Markup.button.callback('🗑️ Apagar', 'menu_apagar')]
    ]);
}

// Radar Astronômico proativo (Todo dia às 08:00)
cron.schedule('0 8 * * *', async () => {
    if (!MEU_CHAT_ID) return;
    try {
        const resNasa = await axios.get(`https://api.nasa.gov/planetary/apod?api_key=${process.env.NASA_API_KEY}`);
        const d = resNasa.data;
        
        const hoje = getDataHoje();
        const itens = dados.agenda.filter(i => i.data === hoje);
        let agendaMsg = itens.length > 0 ? `\n\n📅 *Compromissos de hoje:* \n` + itens.map((i, idx) => `  ${idx + 1}. ✨ *${i.titulo}*`).join('\n') : `\n\n📅 *Agenda livre hoje!* 🥳🪐`;

        let aviso = "🔭 *Radar Astronômico:* ";
        if (d.explanation.toLowerCase().includes('meteor') || d.explanation.toLowerCase().includes('shower')) {
            aviso += "Hoje há menções a chuvas de meteoros! Fique de olho no céu ☄️";
        } else if (d.explanation.toLowerCase().includes('eclipse')) {
            aviso += "Temos um eclipse no radar! 🌑";
        } else {
            aviso += "Céu calmo hoje, aproveite para observar as estrelas ✨";
        }

        const msg = `🌌 *Bom dia, Amanda!* 🪐\n\n${aviso}\n\n*NASA:* ${d.title}\n\n${d.explanation.substring(0, 200)}...${agendaMsg}`;
        await bot.telegram.sendMessage(MEU_CHAT_ID, msg, { parse_mode: 'Markdown' });
    } catch (e) {
        console.error("Erro no radar:", e);
    }
});

bot.command(['start', 'menu', 'ajuda'], async (ctx) => {
    return ctx.reply('🪐 *Painel Estelar - Nebulosa* 🪐\nEscolha uma opção:', painelMenu());
});

bot.on('text', async (ctx) => {
    const t = ctx.message.text.toLowerCase().trim();

    if (t === 'menu' || t === 'ajuda') return ctx.reply('🪐 *Painel Estelar* 🪐', painelMenu());

    if (t.startsWith('ceu:')) {
        try {
            const res = await axios.get(`https://api.nasa.gov/planetary/apod?api_key=${process.env.NASA_API_KEY}&date=${t.replace('ceu:', '').trim()}`);
            const d = res.data;
            if (d.media_type === 'image') return ctx.replyWithPhoto(d.url, { caption: `🌌 ${d.title}\n\n${d.explanation.substring(0, 300)}...`, parse_mode: 'Markdown' });
            return ctx.reply(`${d.title}\n${d.url}`);
        } catch (e) { return ctx.reply('⚠️ Data inválida ou erro na busca da NASA.'); }
    }

    if (t.startsWith('marcar:')) {
        const textoCompromisso = t.replace('marcar:', '').trim();
        dados.agenda.push({ titulo: textoCompromisso, data: getDataHoje(), hora: '09:00' });
        salvarDados();
        return ctx.reply(`✨ Compromisso "${textoCompromisso}" salvo com sucesso para hoje!`);
    }

    if (t.startsWith('editar:')) {
        const p = t.replace('editar:', '').split(':');
        const index = parseInt(p[0].trim());
        const novoTexto = p[1] ? p[1].trim() : '';
        if (dados.agenda[index]) { 
            dados.agenda[index].titulo = novoTexto; 
            salvarDados(); 
            return ctx.reply('✏️ Compromisso editado com sucesso!'); 
        } else {
            return ctx.reply('⚠️ Índice não encontrado para edição.');
        }
    }
});

bot.action('menu_hoje', async (ctx) => {
    const itens = dados.agenda.filter(i => i.data === getDataHoje());
    const msg = itens.length === 0 ? '🪐 Órbita livre hoje!' : `📅 *Hoje:* ` + itens.map(i => i.titulo).join(', ');
    await ctx.editMessageText(msg, { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Voltar', 'voltar_menu')]]) });
});

bot.action('menu_marcar', async (ctx) => {
    await ctx.editMessageText('➕ Para marcar, digite no chat:\n`marcar: O seu compromisso`', { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Voltar', 'voltar_menu')]]) });
});

bot.action('menu_astronomia', async (ctx) => {
    try {
        if (!auth) {
            return ctx.editMessageText('⚠️ Credenciais da Astronomy API ausentes.', Markup.inlineKeyboard([[Markup.button.callback('⬅️ Voltar', 'voltar_menu')]]));
        }
        const res = await axios.get('https://api.astronomyapi.com/api/v2/studio/moon-phase', {
            headers: { 'Authorization': `Basic ${auth}` },
            params: { format: 'png', observer: { latitude: -23.55, longitude: -46.63, date: new Date().toISOString().split('T')[0] } }
        });
        await ctx.deleteMessage();
        await ctx.replyWithPhoto(res.data.data.imageUrl, { caption: "🌙 *Fase da Lua hoje:*", parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Voltar', 'voltar_menu')]]) });
    } catch (e) { await ctx.editMessageText('⚠️ Erro ao consultar a fase da lua.', Markup.inlineKeyboard([[Markup.button.callback('⬅️ Voltar', 'voltar_menu')]])); }
});

bot.action('menu_ceu', async (ctx) => {
    await ctx.editMessageText('🪐 Digite no chat:\n`ceu: AAAA-MM-DD`', { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Voltar', 'voltar_menu')]]) });
});

bot.action('menu_todos', async (ctx) => {
    const lista = dados.agenda.map((i, idx) => `[${idx}] ${i.titulo} (${i.data})`).join('\n') || 'Nenhum compromisso.';
    await ctx.editMessageText(`📋 *Agenda Completa:*\n\n${lista}`, { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Voltar', 'voltar_menu')]]) });
});

bot.action('menu_editar', async (ctx) => {
    await ctx.editMessageText('✏️ Para editar, digite no chat:\n`editar: número : novo texto`\n(Ex: `editar: 0 : Reunião`)', { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Voltar', 'voltar_menu')]]) });
});

bot.action('menu_apagar', async (ctx) => {
    if (dados.agenda.length === 0) return ctx.editMessageText('🗑️ Nada para apagar!', Markup.inlineKeyboard([[Markup.button.callback('⬅️ Voltar', 'voltar_menu')]]));
    const listaBotoes = dados.agenda.map((i, idx) => [Markup.button.callback(`🗑️ [${idx}] ${i.titulo}`, `del_${idx}`)]);
    listaBotoes.push([Markup.button.callback('⬅️ Voltar', 'voltar_menu')]);
    await ctx.editMessageText('🗑️ Qual compromisso deseja apagar?', Markup.inlineKeyboard(listaBotoes));
});

bot.action(/del_(\d+)/, async (ctx) => {
    const index = parseInt(ctx.match[1]);
    if (dados.agenda[index]) {
        const removido = dados.agenda.splice(index, 1);
        salvarDados();
        await ctx.editMessageText(`✨ "${removido[0].titulo}" apagado com sucesso!`, Markup.inlineKeyboard([[Markup.button.callback('⬅️ Voltar', 'voltar_menu')]]));
    }
});

bot.action('voltar_menu', async (ctx) => {
    await ctx.editMessageText('🪐 *Painel Estelar - Nebulosa* 🪐', painelMenu());
});

bot.launch();
console.log('Nebulosa Completa 100% rodando!');
