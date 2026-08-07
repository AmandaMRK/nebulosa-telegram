const { Telegraf, Markup } = require('telegraf');
const cron = require('node-cron');
const axios = require('axios');
const fs = require('fs');

const bot = new Telegraf(process.env.TELEGRAM_TOKEN);
const MEU_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const ARQUIVO_DADOS = './agenda.json';

let dados = { agenda: [] };
if (fs.existsSync(ARQUIVO_DADOS)) {
    try {
        dados = JSON.parse(fs.readFileSync(ARQUIVO_DADOS, 'utf8'));
    } catch (e) { console.error('Erro ao ler JSON:', e); }
}

function salvarDados() {
    fs.writeFileSync(ARQUIVO_DADOS, JSON.stringify(dados, null, 2));
}

function getDataHoje() {
    return new Date().toLocaleDateString('pt-BR');
}

// -----------------------------------------------------------------
// ROTINA DAS 08:00 (NASA + RESUMO DO DIA) 🌌✨
// -----------------------------------------------------------------
cron.schedule('0 8 * * *', async () => {
    if (!MEU_CHAT_ID) return;
    try {
        const resNasa = await axios.get('https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY');
        const d = resNasa.data;
        let msg = `🌌 *Bom dia, Amanda!* 🪐\n\n🔭 *NASA de Hoje:* ${d.title}\n[Ver imagem estelar](${d.url})\n\n`;

        const hoje = getDataHoje();
        const compromissosHoje = dados.agenda.filter(i => i.data === hoje);

        if (compromissosHoje.length > 0) {
            msg += `📅 *Seus compromissos para hoje (${hoje}):*\n` + compromissosHoje.map((i, idx) => `${idx + 1}. ✨ ${i.titulo} (${i.hora})`).join('\n');
        } else {
            msg += `📅 *Sua agenda de hoje está livre nas estrelas!* 🎉🪐`;
        }
        bot.telegram.sendMessage(MEU_CHAT_ID, msg, { parse_mode: 'Markdown' });
    } catch (e) { console.error(e); }
});

// -----------------------------------------------------------------
// MENU PRINCIPAL E INTERATIVIDADE 🛸💜
// -----------------------------------------------------------------
bot.on('text', async (ctx) => {
    const t = ctx.message.text.toLowerCase();

    // Menu Principal com botões de clique rápido
    if (t.includes('menu') || t.includes('/start') || t.includes('ajuda')) {
        return ctx.reply('🌌 *Painel de Controle Estelar - Nebulosa* 🪐\n\nEscolha uma das opções abaixo para navegar pelo seu universo:', Markup.inlineKeyboard([
            [Markup.button.callback('📅 Meus compromissos de hoje', 'menu_hoje')],
            [Markup.button.callback('➕ Marcar compromisso', 'menu_marcar')],
            [Markup.button.callback('🕒 Horários livres', 'menu_livres')],
            [Markup.button.callback('📋 Verificar todos os compromissos', 'menu_todos')],
            [Markup.button.callback('✏️ Editar compromissos', 'menu_editar')],
            [Markup.button.callback('🗑️ Apagar compromissos', 'menu_apagar')]
        ]));
    }

    // Se a usuária mandar texto direto após escolher uma opção ou modo rápido
    if (t.startsWith('marcar:')) {
        const info = t.replace('marcar:', '').trim();
        const dataHoje = getDataHoje();
        dados.agenda.push({ titulo: info, data: dataHoje, hora: '10:00' });
        salvarDados();
        return ctx.reply(`✨ Compromisso *" ${info} "* adicionado com sucesso às estrelas para hoje! 🪐🎉`);
    }
});

// -----------------------------------------------------------------
// AÇÕES DOS BOTÕES INTERATIVOS 🌟
// -----------------------------------------------------------------

// 1. Compromissos de Hoje
bot.action('menu_hoje', async (ctx) => {
    const hoje = getDataHoje();
    const compromissos = dados.agenda.filter(i => i.data === hoje);
    if (compromissos.length === 0) return ctx.editMessageText('🌌 Nenhum compromisso estelar marcado para hoje! Sua órbita está livre. 🪐☁️');

    let msg = `📅 *Compromissos de Hoje (${hoje}):*\n\n`;
    compromissos.forEach((i, idx) => {
        msg += `${idx + 1}. ✨ *${i.titulo}* — ⏰ ${i.hora}\n`;
    });
    await ctx.editMessageText(msg, { parse_mode: 'Markdown' });
});

// 2. Marcar Compromisso (Instrução)
bot.action('menu_marcar', async (ctx) => {
    await ctx.editMessageText('🪐 *Como marcar um compromisso:*\n\nBasta digitar no chat:\n`marcar: [nome do seu compromisso]`\n\nExemplo: `marcar: Reunião importante` 🚀✨', { parse_mode: 'Markdown' });
});

// 3. Horários Livres
bot.action('menu_livres', async (ctx) => {
    const hoje = getDataHoje();
    const ocupados = dados.agenda.filter(i => i.data === hoje).map(i => i.hora);
    await ctx.editMessageText(`🕒 *Análise de Horários Livres (${hoje}):*\n\nHorários ocupados: ${ocupados.length > 0 ? ocupados.join(', ') : 'Nenhum'}.\n✨ O resto do seu dia cósmico está totalmente livre! 🌌🪐`, { parse_mode: 'Markdown' });
});

// 4. Verificar Todos os Compromissos
bot.action('menu_todos', async (ctx) => {
    if (dados.agenda.length === 0) return ctx.editMessageText('🌌 Sua agenda universal está completamente vazia! 🪐');

    let msg = '📋 *Todos os Compromissos na Órbita:*\n\n';
    dados.agenda.forEach((i, idx) => {
        msg += `${idx + 1}. ✨ *${i.titulo}* (🗓️ ${i.data} às ${i.hora})\n`;
    });
    await ctx.editMessageText(msg, { parse_mode: 'Markdown' });
});

// 5. Apagar Compromissos (Gera botões interativos para cada item!)
bot.action('menu_apagar', async (ctx) => {
    if (dados.agenda.length === 0) return ctx.editMessageText('🌌 Não há nada para apagar, sua agenda já está limpinha! 🪐');

    // Cria um botão para cada compromisso salvo
    const botoes = dados.agenda.map((item, idx) => {
        return [Markup.button.callback(`🗑️ Apagar [${idx + 1}] ${item.titulo}`, `del_${idx}`)];
    });
    botoes.push([Markup.button.callback('⬅️ Voltar ao Menu', 'voltar_menu')]);

    await ctx.editMessageText('🗑️ *Qual compromisso estelar você deseja apagar?* Clique em cima:', Markup.inlineKeyboard(botoes));
});

// Executa a exclusão ao clicar no botão do item
bot.action(/del_(\d+)/, async (ctx) => {
    const index = parseInt(ctx.match[1]);
    if (dados.agenda[index]) {
        const removido = dados.agenda.splice(index, 1);
        salvarDados();
        await ctx.editMessageText(`🪐✨ Compromisso *" ${removido[0].titulo} "* apagado com sucesso do universo! 🗑️🚀`);
    } else {
        await ctx.editMessageText('⚠️ Item não encontrado na órbita.');
    }
});

// 6. Editar Compromissos
bot.action('menu_editar', async (ctx) => {
    if (dados.agenda.length === 0) return ctx.editMessageText('🌌 Sua agenda está vazia, nada para editar. 🪐');

    const botoes = dados.agenda.map((item, idx) => {
        return [Markup.button.callback(`✏️ Editar [${idx + 1}] ${item.titulo}`, `edit_${idx}`)];
    });
    botoes.push([Markup.button.callback('⬅️ Voltar ao Menu', 'voltar_menu')]);

    await ctx.editMessageText('✏️ *Qual compromisso você deseja editar?*', Markup.inlineKeyboard(botoes));
});

bot.action(/edit_(\d+)/, async (ctx) => {
    const index = parseInt(ctx.match[1]);
    const item = dados.agenda[index];
    await ctx.editMessageText(`✏️ Você selecionou: *${item.titulo}*.\n\nPara alterar o nome, digite no chat:\n\`editar:${index}: [novo nome]\` 🪐✨`, { parse_mode: 'Markdown' });
});

bot.action('voltar_menu', async (ctx) => {
    await ctx.editMessageText('🌌 *Painel de Controle Estelar - Nebulosa* 🪐\n\nEscolha uma opção:', Markup.inlineKeyboard([
        [Markup.button.callback('📅 Meus compromissos de hoje', 'menu_hoje')],
        [Markup.button.callback('➕ Marcar compromisso', 'menu_marcar')],
        [Markup.button.callback('🕒 Horários livres', 'menu_livres')],
        [Markup.button.callback('📋 Verificar todos os compromissos', 'menu_todos')],
        [Markup.button.callback('✏️ Editar compromissos', 'menu_editar')],
        [Markup.button.callback('🗑️ Apagar compromissos', 'menu_apagar')]
    ]));
});

// Comando extra para salvar a edição caso digite no chat
bot.on('text', async (ctx) => {
    const t = ctx.message.text;
    if (t.startsWith('editar:')) {
        const partes = t.split(':');
        const index = parseInt(partes[1]);
        const novoNome = partes[2].trim();
        if (dados.agenda[index]) {
            dados.agenda[index].titulo = novoNome;
            salvarDados();
            return ctx.reply(`✨ Compromisso atualizado com sucesso para *" ${novoNome} "* no nosso cosmos! 🪐🚀`);
        }
    }
});

bot.launch();
console.log('Nebulosa Interativa Estelar rodando!');
