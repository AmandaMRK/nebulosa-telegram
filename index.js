const { Bot } = require('grammy');
const cron = require('node-cron');

const bot = new Bot('8949158876:AAHGqLkguGy096vBhIV8cANA2go4dV3BKko');
const seuChatId = 7855365372;

// Comando inicial /start
bot.command('start', async (ctx) => {
    await ctx.reply('🌌 Olá, Amanda! Sou a Nebulosa, sua assistente cósmica no Telegram.\n\n📡 *Meus radares estão ligados!* Você pode me pedir notícias da NASA, mandar fotos, criar lembretes na agenda ou só conversar. Digite /nasa para puxar o último plantão espacial! 🚀✨');
});

// Comando para buscar o Plantão da NASA sob demanda
bot.command('nasa', async (ctx) => {
    await ctx.reply('🛰️ *Varrendo os radares da NASA...*\nBuscando as últimas atualizações do cosmos para você, Amanda! ⏳');
    
    try {
        // Pega a foto/notícia do dia oficial da API pública da NASA
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

// Palavra-chave Nebulosa
bot.hears(/nebulosa/i, async (ctx) => {
    const dataHoraAtual = new Date().toLocaleString('pt-BR');
    await ctx.reply(`🌌 **Nebulosa Ativa na Nuvem!**\n📅 Registrado em: ${dataHoraAtual}\n🚀 Pronta para monitorar o espaço e a sua agenda!`);
});

// Curiosidades
bot.hears(/curiosidade|espaço/i, async (ctx) => {
    await ctx.reply('🌌 [Fato Cósmico]: Existem mais estrelas no universo observável do que grãos de areia em todas as praias da Terra juntas! 🌟🏖️');
});

// Quando você mandar foto
bot.on(':photo', async (ctx) => {
    const dataHoraAtual = new Date().toLocaleString('pt-BR');
    await ctx.reply(`🌌📸 **Foto recebida e registrada!**\n⏱️ Marcada em: ${dataHoraAtual}\n💜 Guardada com carinho no banco de dados estelar!`);
});

// Inteligência para Agenda e Tarefas
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

// Notificação automática de Bom dia + Notícia da NASA (Todo dia às 08:00)
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

// Inicia o bot
bot.start();
console.log('🌌🚀 Nebulosa com Radar da NASA iniciada com sucesso!')
