const { Telegraf, Markup } = require('telegraf');
const cron = require('node-cron');
const axios = require('axios');
const fs = require('fs');

const bot = new Telegraf(process.env.TELEGRAM_TOKEN);
const MEU_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const ARQUIVO_DADOS = './agenda.json';

let dados = { agenda: [] };
if (fs.existsSync(ARQUIVO_DADOS)) {
    dados = JSON.parse(fs.readFileSync(ARQUIVO_DADOS, 'utf8'));
}

function salvarDados() {
    fs.writeFileSync(ARQUIVO_DADOS, JSON.stringify(dados, null, 2));
}

// -----------------------------------------------------------------
// ROTINA DAS 08:00 (NASA + RESUMO) 🚀
// -----------------------------------------------------------------
cron.schedule('0 8 * * *', async () => {
    if (!MEU_CHAT_ID) return;
    try {
        const resNasa = await axios.get('https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY');
        const d = resNasa.data;
        let msg = `✨ *Bom dia, Amanda!* ✨\n\n🔭 *NASA:* ${d.title}\n[Ver foto](${d.url})\n\n`;

        const hoje = new Date().toLocaleDateString('pt-BR');
        const compromissosHoje = dados.agenda.filter(i => i.data === hoje);

        if (compromissosHoje.length > 0) {
            msg += `📅 *Seus compromissos de hoje (${hoje}):*\n` + compromissosHoje.map(i => `- ${i.titulo} (${i.hora})`).join('\n');
        } else {
            msg += `📅 *Agenda livre hoje!* 🎉`;
        }
        bot.telegram.sendMessage(MEU_CHAT_ID, msg, { parse_mode: 'Markdown' });
    } catch (e) { console.error(e); }
});

// -----------------------------------------------------------------
// COMANDOS E INTERAÇÃO
// -----------------------------------------------------------------
bot.on('text', async (ctx) => {
    const t = ctx.message.text.toLowerCase();

    // Menu Principal com botões
    if (t.includes('menu') || t.includes('/start')) {
        return ctx.reply('🤖 *Nebulosa Assistente Ativa*', Markup.keyboard([
            ['📅 Minha Agenda', '➕ Adicionar'],
            ['✏️ Editar', '🗑️ Apagar'],
            ['📋 Tarefas', '🔎 Pesquisar']
        ]).resize());
    }

    // Listar Agenda
    if (t.includes('minha agenda') || t.includes('agenda')) {
        if (dados.agenda.length === 0) return ctx.reply('Sua agenda está vazia! 🎉');
        let msg = '📅 *Sua Agenda:* \n\n';
        dados.agenda.forEach((i, idx) => msg += `${idx + 1}. *${i.titulo}* — ${i.data} ${i.hora}\n`);
        return ctx.replyWithMarkdown(msg);
    }

    // Editar (Lógica simples)
    if (t.includes('✏️ editar')) {
        return ctx.reply('Para editar, digite: "editar [número] para [novo nome]". Ex: "editar 1 para dentista"');
    }
    if (t.startsWith('editar ')) {
        const partes = t.split(' para ');
        const num = parseInt(partes[0].replace('editar ', '')) - 1;
        if (dados.agenda[num]) {
            dados.agenda[num].titulo = partes[1];
            salvarDados();
            return ctx.reply(`✅ Compromisso alterado para "${partes[1]}"!`);
        }
        return ctx.reply('Não encontrei esse item.');
    }

    // Apagar
    if (t.includes('🗑️ apagar')) {
        const num = parseInt(t.replace('🗑️ apagar', '').trim()) - 1;
        if (dados.agenda[num]) {
            const removido = dados.agenda.splice(num, 1);
            salvarDados();
            return ctx.reply(`🗑️ Apaguei "${removido[0].titulo}".`);
        }
        return ctx.reply('Digite o número do item que quer apagar. Ex: "🗑️ apagar 1"');
    }

    // Marcar (Linguagem Natural)
    if (t.startsWith('marca') || t.startsWith('➕')) {
        const novo = t.replace('marca', '').replace('➕', '').trim();
        const dataHoje = new Date().toLocaleDateString('pt-BR');
        dados.agenda.push({ titulo: novo, data: dataHoje, hora: '09:00' });
        salvarDados();
        return ctx.reply(`✅ Salvo: "${novo}" para hoje.`);
    }
});

bot.launch();
console.log('Nebulosa Profissional rodando!');
