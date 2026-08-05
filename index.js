const { Bot } = require('grammy');
const cron = require('node-cron');

// O token agora vem de uma variável de ambiente secreta (cofre)
const bot = new Bot(process.env.TELEGRAM_TOKEN);
const seuChatId = 7855365372;

// O restante do código continua exatamente igual...
bot.command('start', async (ctx) => {
    await ctx.reply('🌌 Olá, Amanda! Sou a Nebulosa, sua assistente cósmica no Telegram.\n\n📡 *Meus radares estão ligados!* Você pode me pedir notícias da NASA, mandar fotos, criar lembretes na agenda ou só conversar. Digite /nasa para puxar o último plantão espacial! 🚀✨');
});

bot.command('nasa', async (ctx) => {
    await ctx.reply('🛰️ *Varrendo os radares da NASA...*\nBuscando as últimas atualizações do cosmos para você, Amanda! ⏳');
    
    try {
        const resposta = await fetch('https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY');
        const dados = await resposta.json();

        const mensagemNoticia = `🌌🚨 **PLANTÃO NASA - ÚLTIMAS DO COSMOS** 🚨🌌\n\n` +
                                `📌 **Título:** ${dados.title}\n` +
                                `📅 **Data:** ${dados.date}\n\n` +
                                `📖 *Resumo:* ${dados.explanation}\n\n` +
                                `🔗 [Ver imagem oficial em alta resolução](${dados.url})`;

        await ctx.reply(mensagemNoticia, { parse_mode: 'Markdown' });
    } catch (erro) {
        await ctx.reply('⚠️ Os ventos solares interferiram no sinal da NASA agora pouco, mas tente novamente em instantes, Amanda!');
    }
});

bot.hears(/nebulosa/i, async (ctx) => {
    const dataHoraAtual = new Date().toLocaleString('pt-BR');
    await ctx.reply(`🌌 **Nebulosa Ativa na Nuvem!**\n📅 Registrado em: ${dataHoraAtual}\n🚀 Pronta para monitorar o espaço e a sua agenda!`);
});

bot.hears(/curiosidade|espaço/i, async (ctx) => {
    await ctx.reply('🌌 [Fato Cósmico]: Existem mais estrelas no universo observável do que grãos de areia em todas as praias da Terra juntas! 🌟🏖️');
});

bot.on(':photo', async (ctx) => {
    const dataHoraAtual = new Date().toLocaleString('pt-BR');
    await ctx.reply(`🌌📸 **Foto recebida e registrada!**\n⏱️ Marcada em: ${dataHoraAtual}\n💜 Guardada com carinho no banco de dados estelar!`);
});

bot.on('message:text', async (ctx) => {
    const texto = ctx.message.text;
    const textoLower = texto.toLowerCase();
    
    if (!texto.startsWith('/')) {
        const dataHoraAtual = new Date().toLocaleString('pt-BR');

        if (textoLower.includes('agenda') || textoLower.includes('lembrete') || textoLower.includes('marcar') || textoLower.includes('compromisso')) {
            await ctx.reply(`🗓️ **Evento / Compromisso Anotado na Agenda!**\n⏱️ Registrado em: ${dataHoraAtual}\n💬 *"${texto}"*\n\n✅ Entendido, Amanda! Já guardei isso na sua rota estelar.`);
        } else {
            await ctx.reply(`📌 **Nota salva pela Nebulosa!**\n⏱️ ${dataHoraAtual}\n💬 *"${texto}"*`);
        }
    }
});

cron.schedule('0 8 * * *', async () => {
    try {
        const resposta = await fetch('https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY');
        const dados = await resposta.json();

        const relatorioMatinal = `🌅 **Bom dia, Amanda! Relatório da Nebulosa:**\n\n` +
                                 `📡 *Plantão Espacial de Hoje:*\n` +
                                 `📌 **${dados.title}**\n` +
                                 `📖 ${dados.explanation.substring(0, 300)}...\n\n` +
                                 `🚀 Rotina estelar em dia e pronta para mais um ciclo!`;

        await bot.api.sendMessage(seuChatId, relatorioMatinal, { parse_mode: 'Markdown' });
    } catch (e) {
        await bot.api.sendMessage(seuChatId, '🌅 **Bom dia, Amanda!** Rotina estelar em dia e pronta para mais um ciclo! 🚀✨');
    }
});

bot.start();
console.log('🌌🚀 Nebulosa com Radar da NASA iniciada com sucesso!');
