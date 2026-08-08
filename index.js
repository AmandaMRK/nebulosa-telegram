require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const cron = require('node-cron');
const axios = require('axios');
const fs = require('fs');

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
        [Markup.button.callback('🕒 Horários livres', 'menu_livres')],
        [Markup.button.callback('📋 Verificar todos os compromissos', 'menu_todos')],
        [Markup.button.callback('✏️ Editar compromissos', 'menu_editar')],
        [Markup.button.callback('🗑️ Apagar compromissos', 'menu_apagar')]
    ]);
}

cron.schedule('0 8 * * *', async () => {
    if (!MEU_CHAT_ID) return;
    try {
        const resNasa = await axios.get('https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY');
        const d = resNasa.data;
        let msg = `🌌 *Bom dia, Amanda!* 🪐\n\n🔭 *NASA de Hoje:* ${d.title}\n[Ver imagem](${d.url})\n\n`;
        const hoje = getDataHoje();
        const itens = dados.agenda.filter(i => i.data === hoje);
        msg += itens.length > 0 ? `📅 *Hoje:* \n` + itens.map((i, idx) => `${idx + 1}. ✨ ${i.titulo} (${i.hora})`).join('\n') : `📅 *Agenda livre hoje!* 🎉🪐`;
        bot.telegram.sendMessage(MEU_CHAT_ID, msg, { parse_mode: 'Markdown' });
    } catch (e) {}
});

bot.command(['start', 'menu', 'ajuda'], async (ctx) => {
    return ctx.reply('🌌 *Painel de Controle Estelar - Nebulosa* 🪐\n\nEscolha uma opção abaixo:', painelMenu());
});

bot.on('text', async (ctx) => {
    const t = ctx.message.text.toLowerCase();
    if (t === 'menu' || t === 'ajuda') {
        return ctx.reply('🌌 *Painel Estelar* 🪐', painelMenu());
    }
    if (t.startsWith('marcar:')) {
        const info = t.replace('marcar:', '').trim();
        dados.agenda.push({ titulo: info, data: getDataHoje(), hora: '10:00' });
        salvarDados();
        return ctx.reply(`✨ Compromisso *" ${info} "* salvo com sucesso para hoje! 🪐🎉\n\nEnvie /menu para voltar.`);
    }
});

bot.action('menu_hoje', async (ctx) => {
    const hoje = getDataHoje();
    const itens = dados.agenda.filter(i => i.data === hoje);
    const botoes = [[Markup.button.callback('⬅️ Voltar ao Menu', 'voltar_menu')]];
    if (itens.length === 0) return ctx.editMessageText('🌌 Nenhum compromisso para hoje! Órbita livre. 🪐', Markup.inlineKeyboard(botoes));
    let msg = `📅 *Hoje (${hoje}):*\n\n` + itens.map((i, idx) => `${idx + 1}. ✨ ${i.titulo} (${i.hora})`).join('\n');
    await ctx.editMessageText(msg, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(botoes) });
});

bot.action('menu_marcar', async (ctx) => {
    const botoes = [[Markup.button.callback('⬅️ Voltar ao Menu', 'voltar_menu')]];
    await ctx.editMessageText('🪐 *Como marcar:*\n\nDigite no chat:\n`marcar: [nome do compromisso]`', { parse_mode: 'Markdown', ...Markup.inlineKeyboard(botoes) });
});

bot.action('menu_livres', async (ctx) => {
    const ocupados = dados.agenda.filter(i => i.data === getDataHoje()).map(i => i.hora);
    const botoes = [[Markup.button.callback('⬅️ Voltar ao Menu', 'voltar_menu')]];
    await ctx.editMessageText(`🕒 Horários ocupados: ${ocupados.length > 0 ? ocupados.join(', ') : 'Nenhum'}.\n✨ O resto está livre! 🌌`, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(botoes) });
});

bot.action('menu_todos', async (ctx) => {
    const botoes = [[Markup.button.callback('⬅️ Voltar ao Menu', 'voltar_menu')]];
    if (dados.agenda.length === 0) return ctx.editMessageText('🌌 Agenda vazia!', Markup.inlineKeyboard(botoes));
    let msg = '📋 *Todos os compromissos:*\n\n' + dados.agenda.map((i, idx) => `${idx + 1}. ✨ ${i.titulo} (${i.data})`).join('\n');
    await ctx.editMessageText(msg, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(botoes) });
});

bot.action('menu_apagar', async (ctx) => {
    const botoes = [[Markup.button.callback('⬅️ Voltar ao Menu', 'voltar_menu')]];
    if (dados.agenda.length === 0) return ctx.editMessageText('🌌 Nada para apagar!', Markup.inlineKeyboard(botoes));
    const listaBotoes = dados.agenda.map((item, idx) => [Markup.button.callback(`🗑️ Apagar [${idx + 1}] ${item.titulo}`, `del_${idx}`)]);
    listaBotoes.push([Markup.button.callback('⬅️ Voltar ao Menu', 'voltar_menu')]);
    await ctx.editMessageText('🗑️ *Qual deseja apagar?* Clique em cima:', Markup.inlineKeyboard(listaBotoes));
});

bot.action(/del_(\d+)/, async (ctx) => {
    const index = parseInt(ctx.match[1]);
    const botoes = [[Markup.button.callback('⬅️ Voltar ao Menu', 'voltar_menu')]];
    if (dados.agenda[index]) {
        const removido = dados.agenda.splice(index, 1);
        salvarDados();
        await ctx.editMessageText(`🪐✨ Compromisso *" ${removido[0].titulo} "* apagado com sucesso! 🗑️`, Markup.inlineKeyboard(botoes));
    } else {
        await ctx.editMessageText('⚠️ Item não encontrado.', Markup.inlineKeyboard(botoes));
    }
});

bot.action('menu_editar', async (ctx) => {
    const botoes = [[Markup.button.callback('⬅️ Voltar ao Menu', 'voltar_menu')]];
    if (dados.agenda.length === 0) return ctx.editMessageText('🌌 Agenda vazia!', Markup.inlineKeyboard(botoes));
    const listaBotoes = dados.agenda.map((item, idx) => [Markup.button.callback(`✏️ Editar [${idx + 1}] ${item.titulo}`, `edit_${idx}`)]);
    listaBotoes.push([Markup.button.callback('⬅️ Voltar ao Menu', 'voltar_menu')]);
    await ctx.editMessageText('✏️ *Qual deseja editar?*', Markup.inlineKeyboard(listaBotoes));
});

bot.action(/edit_(\d+)/, async (ctx) => {
    const index = parseInt(ctx.match[1]);
    const botoes = [[Markup.button.callback('⬅️ Voltar ao Menu', 'voltar_menu')]];
    await ctx.editMessageText(`✏️ Para alterar, digite:\n\`editar:${index}: [novo nome]\``, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(botoes) });
});

bot.action('voltar_menu', async (ctx) => {
    await ctx.editMessageText('🌌 *Painel Estelar - Nebulosa* 🪐', painelMenu());
});

bot.launch();
console.log('Nebulosa Estelar v2 rodando!');
