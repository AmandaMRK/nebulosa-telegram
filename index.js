const { Telegraf, Markup } = require('telegraf');
const cron = require('node-cron');
const axios = require('axios');
const fs = require('fs');
const base64 = require('base-64');

require('dotenv').config();

const bot = new Telegraf(process.env.TELEGRAM_TOKEN);
const MEU_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const ARQUIVO_DADOS = './agenda.json';

// Configuração de Autenticação da Astronomy API
const auth = base64.encode(`${process.env.ASTRONOMY_API_ID}:${process.env.ASTRONOMY_API_SECRET}`);

// ... (manter as funções salvarDados e getDataHoje iguais) ...

function painelMenu() {
    return Markup.inlineKeyboard([
        [Markup.button.callback('📅 Meus compromissos', 'menu_hoje')],
        [Markup.button.callback('🔭 Eventos do Céu (Lua/Planetas)', 'menu_astronomia')],
        [Markup.button.callback('🪐 Foto do Dia (NASA)', 'menu_ceu')],
        [Markup.button.callback('🗑️ Apagar compromissos', 'menu_apagar')]
    ]);
}

// Nova função para buscar dados astronômicos
bot.action('menu_astronomia', async (ctx) => {
    try {
        // Exemplo: buscando dados da Lua
        const res = await axios.get('https://api.astronomyapi.com/api/v2/studio/moon-phase', {
            headers: { 'Authorization': `Basic ${auth}` },
            params: { format: 'png', style: { moonStyle: 'default' }, observer: { latitude: -23.55, longitude: -46.63, date: new Date().toISOString().split('T')[0] } }
        });
        
        const imageUrl = res.data.data.imageUrl;
        await ctx.replyWithPhoto(imageUrl, { caption: "🌙 *Fase da Lua hoje em SP:*", parse_mode: 'Markdown' });
    } catch (e) {
        await ctx.reply('⚠️ Erro ao consultar astronomia. Verifique se o ID/Secret no .env estão corretos.');
    }
});

// ... (manter o restante do código igual, apenas atualize o painelMenu acima) ...

bot.launch();
console.log('Nebulosa Estelar v3 com Astronomia rodando!');
