const { Telegraf, Markup } = require('telegraf');
const cron = require('node-cron');
const axios = require('axios');
const fs = require('fs');

const bot = new Telegraf(process.env.TELEGRAM_TOKEN);
const MEU_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const ARQUIVO_DADOS = './agenda.json';

// Carrega os dados salvos ou inicia vazio
let dados = { agenda: [], tarefas: [] };
if (fs.existsSync(ARQUIVO_DADOS)) {
    try {
        dados = JSON.parse(fs.readFileSync(ARQUIVO_DADOS, 'utf8'));
    } catch (e) { console.error('Erro ao ler JSON:', e); }
}

function salvarDados() {
    fs.writeFileSync(ARQUIVO_DADOS, JSON.stringify(dados, null, 2));
}

// Utilitários de Data
function formatarData(d) {
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const ano = d.getFullYear();
    return `${dia}/${mes}/${ano}`;
}

function getDataHoje() { return formatarData(new Date()); }

function getDataAmanha() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return formatarData(d);
}

// Converte "DD/MM/YYYY" para objeto Date do JS
stringParaDate = (dataStr) => {
    const [dia, mes, ano] = dataStr.split('/');
    return new Date(`${ano}-${mes}-${dia}`);
};

// -----------------------------------------------------------------
// ROTINAS AUTOMÁTICAS (Resumo diário às 08:00)
// -----------------------------------------------------------------
cron.schedule('0 8 * * *', async () => {
    if (!MEU_CHAT_ID) return;
    try {
        const resNasa = await axios.get('https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY');
        const d = resNasa.data;
        let msg = `✨ *Bom dia, Amanda!* ✨\n\n🔭 *NASA:* ${d.title}\n[Ver foto](${d.url})\n\n`;

        const hojeStr = getDataHoje();
        const compromissosHoje = dados.agenda.filter(i => i.data === hojeStr);

        if (compromissosHoje.length > 0) {
            msg += `📅 *Compromissos de Hoje (${hojeStr}):*\n`;
            compromissosHoje.forEach((item, idx) => {
                msg += `${idx + 1}. *${item.titulo}* — ⏰ ${item.hora || 'Dia todo'} [${item.categoria || 'Geral'}]\n`;
                if (item.local) msg += `   📍 ${item.local}\n`;
            });
        } else {
            msg += `📅 *Agenda livre para hoje!* Aproveite o dia! 🎉`;
        }

        bot.telegram.sendMessage(MEU_CHAT_ID, msg, { parse_mode: 'Markdown' });
    } catch (e) { console.error(e); }
});

// -----------------------------------------------------------------
// INTELIGÊNCIA E COMANDOS EM LINGUAGEM NATURAL 💜
// -----------------------------------------------------------------
bot.on('text', async (ctx) => {
    const texto = ctx.message.text;
    const t = texto.toLowerCase();

    // 1. AJUDA / MENU PRINCIPAL
    if (t === 'menu' || t === '/start' || t === 'ajuda') {
        return ctx.reply(
            '🤖 *Olá, Amanda! Sou sua assistente pessoal completa.* \n\nVocê pode falar comigo naturalmente, por exemplo:\n' +
            '• *"Marca dentista sexta às 14h"* \n' +
            '• *"Quais meus compromissos de hoje?"*\n' +
            '• *"Estou livre amanhã?"*\n' +
            '• *"Pesquisar reunião"*',
            Markup.keyboard([
                ['📅 Agenda de Hoje', '📋 Ver Tarefas'],
                ['➕ Adicionar Evento', '🔎 Pesquisar']
            ]).resize()
        );
    }

    // 2. AGENDA DE HOJE / AMANHÃ / SEMANA
    if (t.includes('agenda de hoje') || t.includes('compromissos de hoje')) {
        const hoje = getDataHoje();
        const lista = dados.agenda.filter(i => i.data === hoje);
        if (lista.length === 0) return ctx.reply('📅 Nenhum compromisso para hoje! Sua agenda está limpa. ☁️');
        
        let msg = `📅 *Agenda de Hoje (${hoje}):*\n\n`;
        lista.forEach((item, i) => {
            msg += `${i + 1}. *${item.titulo}* (${item.hora || 'Dia todo'}) [${item.categoria || 'Geral'}]\n`;
            if (item.local) msg += `   📍 Local: ${item.local}\n`;
            if (item.obs) msg += `   📝 Obs: ${item.obs}\n`;
        });
        return ctx.replyWithMarkdown(msg);
    }

    // 3. PESQUISAR COMPROMISSOS
    if (t.startsWith('pesquisar') || t.includes('procurar')) {
        const termo = t.replace('pesquisar', '').replace('procurar', '').trim();
        const encontrados = dados.agenda.filter(i => i.titulo.toLowerCase().includes(termo) || (i.obs && i.obs.toLowerCase().includes(termo)));
        
        if (encontrados.length === 0) return ctx.reply(`🔍 Não achei nada com "${termo}".`);
        let msg = `🔍 *Resultados para "${termo}":*\n\n`;
        encontrados.forEach((item, i) => {
            msg += `${i + 1}. *${item.titulo}* — 🗓️ ${item.data} às ${item.hora || 'Dia todo'}\n`;
        });
        return ctx.replyWithMarkdown(msg);
    }

    // 4. IDENTIFICAR HORÁRIOS LIVRES / "ESTOU LIVRE?"
    if (t.includes('livre') || t.includes('horarios livres')) {
        const hoje = getDataHoje();
        const ocupados = dados.agenda.filter(i => i.data === hoje).map(i => i.hora).filter(Boolean);
        return ctx.reply(`🕒 Para o dia ${hoje}, seus horários ocupados são: ${ocupados.length > 0 ? ocupados.join(', ') : 'Nenhum horário fixado'}. O restante do dia está livre! ✨`);
    }

    // 5. ADICIONAR COMPROMISSO EM LINGUAGEM NATURAL ("Marca...")
    if (t.startsWith('marca') || t.startsWith('agendar')) {
        // Extração básica de hora (ex: 14h, 14:00)
        const regexHora = /(\d{2})[h:](\d{2})?/;
        const matchHora = texto.match(regexHora);
        const hora = matchHora ? `${matchHora[1]}:${matchHora[2] || '00'}` : null;

        // Extração de data (ex: 11/08/2026 ou palavras)
        const regexData = /(\d{2})\/(\d{2})\/(\d{4})/;
        const matchData = texto.match(regexData);
        let data = matchData ? matchData[0] : getDataHoje();
        if (t.includes('amanhã')) data = getDataAmanha();

        // Limpa o título do compromisso
        let titulo = texto
            .replace(/nebulosa,?/gi, '')
            .replace(/marca/gi, '')
            .replace(/agendar/gi, '')
            .replace(/para mim/gi, '')
            .replace(regexData, '')
            .replace(regexHora, '')
            .trim();

        if (!titulo) titulo = 'Compromisso';

        // Detecção de Conflito de Horário
        if (hora) {
            const conflito = dados.agenda.find(i => i.data === data && i.hora === hora);
            if (conflito) {
                return ctx.reply(`⚠️ *Conflito detectado!* Você já tem "${conflito.titulo}" marcado para o dia ${data} às ${hora}. Deseja marcar mesmo assim?`,
                    Markup.inlineKeyboard([
                        [Markup.button.callback('✅ Sim, forçar', `forcar_${titulo}_${data}_${hora}`)],
                        [Markup.button.callback('❌ Cancelar', 'cancelar_conflito')]
                    ])
                );
            }
        }

        // Salva o compromisso
        dados.agenda.push({
            titulo,
            data,
            hora,
            categoria: 'Geral',
            local: '',
            obs: ''
        });
        salvarDados();

        return ctx.reply(`✅ *Compromisso Agendado com Sucesso!* \n\n📌 *${titulo}*\n🗓️ Data: ${data}\n⏰ Horário: ${hora || 'Dia todo'}\n\n*Dica:* Você pode adicionar local ou observações editando o evento depois! 💜`,
            Markup.inlineKeyboard([
                [Markup.button.callback('📋 Ver Agenda Completa', 'ver_agenda')]
            ])
        );
    }

    // 6. EXCLUIR / CANCELAR (Ex: "apagar agenda 2")
    if (t.includes('apagar agenda') || t.includes('excluir')) {
        const num = parseInt(t.replace('apagar agenda', '').replace('excluir', '').trim());
        if (!isNaN(num) && dados.agenda[num - 1]) {
            const removido = dados.agenda.splice(num - 1, 1);
            salvarDados();
            return ctx.reply(`🗑️ Compromisso "${removido[0].titulo}" removido com sucesso.`);
        }
        return ctx.reply('Use "apagar agenda [número]". Exemplo: "apagar agenda 1". Digite "agenda" para ver a lista numerada.');
    }

    // 7. LISTAR TUDO (AGENDA GERAL)
    if (t === 'agenda' || t.includes('listar agenda') || t.includes('meus compromissos')) {
        if (dados.agenda.length === 0) return ctx.reply('Sua agenda está vazia! 🎉');
        let msg = '📅 *Sua Agenda Completa:*\n\n';
        dados.agenda.forEach((item, i) => {
            msg += `${i + 1}. *${item.titulo}* — 🗓️ ${item.data} ${item.hora ? 'às ' + item.hora : ''}\n`;
        });
        return ctx.replyWithMarkdown(msg + '\n*Para apagar:* digite "apagar agenda [número]"');
    }
});

// Ações de Botões Interativos
bot.action(/forcar_(.+)/, async (ctx) => {
    const partes = ctx.match[1].split('_');
    const [titulo, data, hora] = partes;
    dados.agenda.push({ titulo, data, hora, categoria: 'Geral', local: '', obs: '' });
    salvarDados();
    await ctx.editMessageText(`✅ Compromisso "${titulo}" forçado e agendado para ${data} às ${hora} com sucesso! 📌`);
});

bot.action('cancelar_conflito', async (ctx) => {
    await ctx.editMessageText('❌ Agendamento cancelado por conflito de horário.');
});

bot.action('ver_agenda', async (ctx) => {
    if (dados.agenda.length === 0) return ctx.editMessageText('Sua agenda está vazia!');
    let msg = '📅 *Sua Agenda:*\n\n';
    dados.agenda.forEach((item, i) => {
        msg += `${i + 1}. *${item.titulo}* (${item.data})\n`;
    });
    await ctx.editMessageText(msg, { parse_mode: 'Markdown' });
});

bot.launch();
console.log('🤖 Nebulosa - Assistente Pessoal Completa rodando com sucesso!');
