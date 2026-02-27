// ============================================================
// ⚡ Bot Discord - Famille Bako
// ============================================================

const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  REST,
  Routes,
} = require('discord.js');

const LOGO_URL = "https://i.imgur.com/fyOaYXk.jpeg";

// ── Noms des rangs staff ──────────────────────────────────────
const STAFF_RANKS = {
  1:  '🟢 Helpeur-Test',
  2:  '🟢 Helpeur',
  4:  '🔵 Modérateur',
  5:  '🔵 Modérateur V2',
  6:  '🔵 Modérateur Général',
  7:  '🟠 Administrateur',
  8:  '🟠 Administrateur V2',
  9:  '🟠 Administrateur Général',
  10: '🔴 Responsable Serveur',
  11: '🔴 Responsable Staff',
  14: '⭐ Owner',
};

// ============================================================
// CONFIGURATION - À MODIFIER
// ============================================================

const CONFIG = {
  DISCORD_TOKEN:    process.env.DISCORD_TOKEN,
  APPLICATION_ID:   process.env.APPLICATION_ID,
  CHANNEL_ID:       process.env.CHANNEL_ID,
  DAILY_CHANNEL_ID: process.env.DAILY_CHANNEL_ID,

  DAILY_SUMMARY_HOUR:   22,  // Heure du résumé quotidien
  DAILY_SUMMARY_MINUTE:  0,

  API_BASE_URL: "https://api.lyg.fr/api",
  FAMILY_NAME:  "bako",         // Nom URL de la famille (pour les endpoints)
  FAMILY_ID:    "bako",         // ID famille pour les appels API
  FAMILY_LABEL: "Famille Bako", // Nom affiché dans les embeds

  CHECK_INTERVAL_MINUTES: 15,

  CACHE_DURATION: {
    MEMBERS:     10 * 60 * 1000,
    PLAYER_INFO:  2 * 60 * 1000,
    FAMILY_INFO:  5 * 60 * 1000,
    BANK_LOGS:    5 * 60 * 1000,
    WARNS:       10 * 60 * 1000,
    STAFF:       30 * 60 * 1000,
  },

  API_DELAY_MS: 500,

  // Couleurs des embeds (thème Bako)
  COLOR_ONLINE:  0xf5c400,  // Jaune Pikachu ⚡
  COLOR_OFFLINE: 0xff4444,  // Rouge
  COLOR_INFO:    0xf0a500,  // Orange doré
  COLOR_GOLD:    0xffd700,  // Or classement
};

// ============================================================
// SLASH COMMANDS
// ============================================================

const commands = [
  new SlashCommandBuilder()
    .setName('online')
    .setDescription('⚡ Affiche les membres de la Bako en ligne'),

  new SlashCommandBuilder()
    .setName('stats')
    .setDescription('📊 Liste complète des membres avec leur statut'),

  new SlashCommandBuilder()
    .setName('famille')
    .setDescription('💰 Solde et points de la Bako'),

  new SlashCommandBuilder()
    .setName('banque')
    .setDescription('🏦 Dernières transactions + top déposants/retraits'),

  new SlashCommandBuilder()
    .setName('classement')
    .setDescription('🏆 Top 15 contributeurs triés par dépôts nets'),

  new SlashCommandBuilder()
    .setName('joueur')
    .setDescription('👤 Fiche complète d\'un joueur + ses warns (n\'importe qui sur le serveur)')
    .addStringOption(option =>
      option.setName('nom')
        .setDescription('Nom RP du joueur ou son SteamID64')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('warns')
    .setDescription('⚠️ Avertissements d\'un joueur (n\'importe qui sur le serveur)')
    .addStringOption(option =>
      option.setName('nom')
        .setDescription('Nom RP du joueur ou son SteamID64')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('refresh')
    .setDescription('🔧 Vider le cache pour forcer le rafraîchissement'),
];

// ============================================================
// ENREGISTREMENT DES COMMANDES
// ============================================================

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(CONFIG.DISCORD_TOKEN);
  try {
    console.log('🔄 Enregistrement des slash commands...');
    await rest.put(
      Routes.applicationCommands(CONFIG.APPLICATION_ID),
      { body: commands.map(c => c.toJSON()) }
    );
    console.log('✅ Slash commands enregistrées !');
  } catch (error) {
    console.error('❌ Erreur enregistrement commandes:', error);
  }
}

// ============================================================
// CACHE
// ============================================================

const cache = {};

function getCached(key, maxAge) {
  const entry = cache[key];
  if (entry && Date.now() - entry.time < maxAge) return entry.data;
  return null;
}

function setCache(key, data) {
  cache[key] = { data, time: Date.now() };
}

function clearCache() {
  Object.keys(cache).forEach(k => delete cache[k]);
  console.log('🗑️ Cache vidé');
}

// ============================================================
// MENUS INTERACTIFS - Gestion expiration 10 min
// ============================================================

const MENU_TIMEOUT = 10 * 60 * 1000; // 10 minutes

// Crée un menu déroulant pour /warns
function createWarnsMenu(steamid) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`menu_warns_${steamid}`)
      .setPlaceholder('⚡ Actions...')
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel('🔄 Rafraîchir').setValue('refresh').setDescription('Recharger les warns'),
        new StringSelectMenuOptionBuilder().setLabel('👤 Voir fiche joueur').setValue('joueur').setDescription('Afficher la fiche complète'),
      )
  );
}

// Crée un menu déroulant pour /joueur
function createJoueurMenu(steamid) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`menu_joueur_${steamid}`)
      .setPlaceholder('⚡ Actions...')
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel('🔄 Rafraîchir').setValue('refresh').setDescription('Recharger la fiche'),
        new StringSelectMenuOptionBuilder().setLabel('⚠️ Voir ses warns').setValue('warns').setDescription('Afficher les avertissements'),
        new StringSelectMenuOptionBuilder().setLabel('💰 Voir contributions').setValue('contributions').setDescription('Afficher les contributions bancaires'),
      )
  );
}

// Crée un menu déroulant pour /online
function createOnlineMenu() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('menu_online')
      .setPlaceholder('⚡ Actions...')
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel('🔄 Rafraîchir').setValue('refresh').setDescription('Recharger les membres en ligne'),
        new StringSelectMenuOptionBuilder().setLabel('📊 Voir stats complètes').setValue('stats').setDescription('Liste complète de tous les membres'),
      )
  );
}

// Crée un menu déroulant pour /banque
function createBanqueMenu() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('menu_banque')
      .setPlaceholder('⚡ Actions...')
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel('🔄 Rafraîchir').setValue('refresh').setDescription('Recharger les transactions'),
        new StringSelectMenuOptionBuilder().setLabel('🏆 Voir classement').setValue('classement').setDescription('Top contributeurs'),
      )
  );
}

// Crée un menu déroulant pour /classement
function createClassementMenu() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('menu_classement')
      .setPlaceholder('⚡ Actions...')
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel('🔄 Rafraîchir').setValue('refresh').setDescription('Recharger le classement'),
        new StringSelectMenuOptionBuilder().setLabel('🏦 Voir banque').setValue('banque').setDescription('Dernières transactions'),
      )
  );
}

// Ligne expirée (grisée, non cliquable)
function createExpiredRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('expired')
      .setLabel('⏱️ Expiré | relance la commande')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true)
  );
}

// Attacher le collector de menu à un message avec expiration automatique
async function attachMenuCollector(message, menuType, steamid, interaction) {
  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.StringSelect,
    time: MENU_TIMEOUT,
  });

  collector.on('collect', async i => {
    await i.deferUpdate();
    const value = i.values[0];

    try {
      if (menuType === 'warns') {
        const sid = steamid;
        if (value === 'refresh') {
          // Vider le cache warns pour forcer rechargement
          delete cache[`warns:${sid}`];
          const warns = await getPlayerWarns(sid);
          const info  = await getPlayerInfo(sid);
          const name  = info?.last_name || sid;
          const { embed, row } = buildWarnsEmbed(name, sid, warns);
          await i.editReply({ embeds: [embed], components: [row] });
          // Réinitialiser le collector
          collector.resetTimer();
        } else if (value === 'joueur') {
          const found = await findPlayer(sid);
          if (found && found.length > 0) {
            const { embed, row } = await buildJoueurEmbed(found[0]);
            await i.editReply({ embeds: [embed], components: [row] });
            collector.stop('switched');
            attachMenuCollector(message, 'joueur', sid, interaction);
          }
        }
      } else if (menuType === 'joueur') {
        const sid = steamid;
        if (value === 'refresh') {
          delete cache[`player:${sid}`];
          delete cache[`warns:${sid}`];
          delete cache[`staff:${sid}`];
          const found = await findPlayer(sid);
          if (found && found.length > 0) {
            const { embed, row } = await buildJoueurEmbed(found[0]);
            await i.editReply({ embeds: [embed], components: [row] });
            collector.resetTimer();
          }
        } else if (value === 'warns') {
          const warns = await getPlayerWarns(sid);
          const info  = await getPlayerInfo(sid);
          const name  = info?.last_name || sid;
          const { embed, row } = buildWarnsEmbed(name, sid, warns);
          await i.editReply({ embeds: [embed], components: [row] });
          collector.stop('switched');
          attachMenuCollector(message, 'warns', sid, interaction);
        } else if (value === 'contributions') {
          const logs   = await getBankLogs();
          const info   = await getPlayerInfo(sid);
          const name   = info?.last_name || sid;
          const player = logs.filter(tx => String(tx.steamid) === String(sid));
          let dep = 0, with_ = 0;
          player.forEach(tx => {
            const a = Math.abs(tx.money);
            if (tx.type === 2) dep += a; else with_ += a;
          });
          const embed = new EmbedBuilder()
            .setTitle(`💰 Contributions | ${name}`)
            .setColor(CONFIG.COLOR_GOLD)
            .setThumbnail(LOGO_URL)
            .setDescription(`📈 **Dépôts :** +${dep.toLocaleString('fr-FR')} €
📉 **Retraits :** -${with_.toLocaleString('fr-FR')} €

💎 **Net : ${(dep - with_).toLocaleString('fr-FR')} €**`)
            .setTimestamp()
            .setFooter({ text: 'Famille Bako • Pika Pika ⚡', iconURL: LOGO_URL });
          await i.editReply({ embeds: [embed], components: [createJoueurMenu(sid)] });
          collector.resetTimer();
        }
      } else if (menuType === 'online') {
        if (value === 'refresh') {
          const data = await checkOnlineMembers();
          if (data) await i.editReply({ embeds: [createOnlineEmbed(data)], components: [createOnlineMenu()] });
          collector.resetTimer();
        } else if (value === 'stats') {
          const data = await checkOnlineMembers();
          if (!data) return;
          const allMembers = [...data.online, ...data.offline];
          let list = allMembers.map(p => `${p.connected ? '🟢' : '🔴'} **${p.name}** - ${p.owner === 1 ? '👑 Chef' : p.class || 'Membre'}`).join('\n');
          const embed = new EmbedBuilder()
            .setTitle(`⚡ ${CONFIG.FAMILY_LABEL} - Tous les membres`)
            .setColor(CONFIG.COLOR_INFO)
            .setThumbnail(LOGO_URL)
            .setDescription(list.substring(0, 4000))
            .addFields({ name: '📊 Résumé', value: `🟢 **${data.online.length}** en ligne / 👥 **${data.total}** total` })
            .setTimestamp()
            .setFooter({ text: 'Famille Bako • Pika Pika ⚡', iconURL: LOGO_URL });
          await i.editReply({ embeds: [embed], components: [createOnlineMenu()] });
          collector.resetTimer();
        }
      } else if (menuType === 'banque') {
        if (value === 'refresh') {
          delete cache['banklogs'];
          // Re-fetch banque
          const [bankLogs, familyInfo] = await Promise.all([getBankLogs(), getFamilyInfo()]);
          const { embed } = await buildBanqueEmbed(bankLogs, familyInfo);
          await i.editReply({ embeds: [embed], components: [createBanqueMenu()] });
          collector.resetTimer();
        } else if (value === 'classement') {
          const bankLogs = await getBankLogs();
          const { embed } = buildClassementEmbed(bankLogs);
          await i.editReply({ embeds: [embed], components: [createClassementEmbed()] });
          collector.stop('switched');
          attachMenuCollector(message, 'classement', null, interaction);
        }
      } else if (menuType === 'classement') {
        if (value === 'refresh') {
          delete cache['banklogs'];
          const bankLogs = await getBankLogs();
          const { embed } = buildClassementEmbed(bankLogs);
          await i.editReply({ embeds: [embed], components: [createClassementMenu()] });
          collector.resetTimer();
        } else if (value === 'banque') {
          const [bankLogs, familyInfo] = await Promise.all([getBankLogs(), getFamilyInfo()]);
          const { embed } = await buildBanqueEmbed(bankLogs, familyInfo);
          await i.editReply({ embeds: [embed], components: [createBanqueMenu()] });
          collector.stop('switched');
          attachMenuCollector(message, 'banque', null, interaction);
        }
      }
    } catch (err) {
      console.error('❌ Erreur menu:', err.message);
    }
  });

  collector.on('end', async (_, reason) => {
    if (reason === 'switched') return;
    try {
      await message.edit({ components: [createExpiredRow()] });
    } catch (e) {}
  });

  // Intercepter les clics après expiration du collector
  const expiredCollector = message.createMessageComponentCollector({
    time: 60 * 60 * 1000, // 1h de sécurité
  });
  expiredCollector.on('collect', async i => {
    if (i.customId === 'expired') {
      await i.reply({ content: '⏱️ Ce menu a expiré. Relance la commande pour une version fraîche.', ephemeral: true });
    }
  });
}

// ============================================================
// CLIENT DISCORD
// ============================================================

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

let lastStatusMessageId  = null;
let dailyConnections     = new Set();
let lastDailySummaryDate = null;

// ============================================================
// FONCTIONS API
// ============================================================

// Rate limiter : max N requêtes simultanées + gestion 429
const MAX_CONCURRENT = 5; // Requêtes parallèles max
let activeRequests   = 0;
const requestQueue   = [];

function processQueue() {
  while (requestQueue.length > 0 && activeRequests < MAX_CONCURRENT) {
    const { fn, resolve, reject } = requestQueue.shift();
    activeRequests++;
    fn().then(resolve).catch(reject).finally(() => {
      activeRequests--;
      processQueue();
    });
  }
}

function rateLimit(fn) {
  return new Promise((resolve, reject) => {
    requestQueue.push({ fn, resolve, reject });
    processQueue();
  });
}

async function apiCall(endpoint, retries = 3) {
  return rateLimit(async () => {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await fetch(`${CONFIG.API_BASE_URL}${endpoint}`);

        if (response.status === 429) {
          const wait = attempt * 2000; // Backoff exponentiel : 2s, 4s, 6s
          console.warn(`⚠️ Rate limit [${endpoint}] - attente ${wait}ms (tentative ${attempt})`);
          await new Promise(r => setTimeout(r, wait));
          continue;
        }

        if (response.ok) {
          const text  = await response.text();
          const fixed = text
            .replace(/"discordid"\s*:\s*"?(\d+)"?/g, '"discordid":"$1"')
            .replace(/"steamid"\s*:\s*"?(\d+)"?/g,   '"steamid":"$1"');
          return JSON.parse(fixed);
        }

        console.error(`❌ API ${endpoint}: ${response.status}`);
        return null;

      } catch (error) {
        if (attempt === retries) {
          console.error(`❌ API ${endpoint}: ${error.message}`);
          return null;
        }
        await new Promise(r => setTimeout(r, 500 * attempt));
      }
    }
    return null;
  });
}

// ── Membres de la famille ────────────────────────────────────
async function getFamilyMembers() {
  const cached = getCached('members', CONFIG.CACHE_DURATION.MEMBERS);
  if (cached) return cached;
  const result = await apiCall(`/darkrp/familles/${CONFIG.FAMILY_ID}/members`);
  const data   = result?.data || [];
  if (data.length > 0) setCache('members', data);
  return data;
}

// ── Infos d'un joueur (par SteamID) ─────────────────────────
async function getPlayerInfo(steamid) {
  const cached = getCached(`player:${steamid}`, CONFIG.CACHE_DURATION.PLAYER_INFO);
  if (cached) return cached;
  const result = await apiCall(`/players/${steamid}`);
  const data   = result?.data || null;
  if (data) setCache(`player:${steamid}`, data);
  return data;
}

// ── Infos de la famille ───────────────────────────────────────
async function getFamilyInfo() {
  const cached = getCached('familyInfo', CONFIG.CACHE_DURATION.FAMILY_INFO);
  if (cached) return cached;
  const result = await apiCall(`/darkrp/familles/${CONFIG.FAMILY_ID}/infos`);
  const data   = result?.data || null;
  if (data) setCache('familyInfo', data);
  return data;
}

// ── Logs bancaires avec pagination complète ────────────────────
// API LYG : limit max=100, pagination via result.pagination.hasNextPage
async function getBankLogs() {
  const cached = getCached('banklogs', CONFIG.CACHE_DURATION.BANK_LOGS);
  if (cached) return cached;

  let allLogs = [];
  let page    = 1;
  const limit = 100; // Max autorisé par l'API LYG

  while (true) {
    const result = await apiCall(
      `/darkrp/familles/${encodeURIComponent(CONFIG.FAMILY_NAME)}/banklogs?page=${page}&limit=${limit}`
    );

    const batch      = result?.data        || [];
    const pagination = result?.pagination  || {};

    if (batch.length === 0) break;

    allLogs = allLogs.concat(batch);
    console.log(`📦 Banklogs page ${page}/${pagination.totalPages || '?'} : ${batch.length} tx (total: ${allLogs.length}/${pagination.total || '?'})`);

    // Utiliser hasNextPage fourni par l'API
    if (!pagination.hasNextPage) break;
    page++;

    // Sécurité anti-boucle infinie
    if (page > 50) { console.warn("⚠️ Banklogs : limite de 50 pages atteinte"); break; }
  }

  console.log(`✅ Banklogs complets : ${allLogs.length} transactions récupérées`);
  if (allLogs.length > 0) setCache('banklogs', allLogs);
  return allLogs;
}

// ── Warns d'un joueur ─────────────────────────────────────────
// Fonctionne pour N'IMPORTE QUEL joueur du serveur, pas seulement la famille
async function getPlayerWarns(steamid) {
  const cached = getCached(`warns:${steamid}`, CONFIG.CACHE_DURATION.WARNS);
  if (cached) return cached;
  const result = await apiCall(`/warns/${steamid}`);
  const data   = result?.data || [];
  setCache(`warns:${steamid}`, data);
  return data;
}

// ── Statut staff ──────────────────────────────────────────────
async function isStaff(steamid) {
  const cached = getCached(`staff:${steamid}`, CONFIG.CACHE_DURATION.STAFF);
  if (cached) return cached;
  const result = await apiCall(`/staff/isstaff/${steamid}`);
  const data   = result?.data || null;
  if (data) setCache(`staff:${steamid}`, data);
  return data;
}

// ============================================================
// RECHERCHE DE JOUEUR - AMÉLIORÉE
// Cherche d'abord dans la famille, puis accepte n'importe quel
// SteamID64 valide pour des joueurs hors famille.
// ============================================================

async function findPlayer(search) {
  // Cas 1 : SteamID64 direct → vérifier si dans la famille aussi
  if (/^7656\d{13}$/.test(search)) {
    const [info, members] = await Promise.all([
      getPlayerInfo(search),
      getFamilyMembers(),
    ]);
    if (info) {
      // Debug : afficher les SteamIDs de la famille pour comparer
      console.log(`🔍 Recherche SteamID: "${search}" (type: ${typeof search})`);
      console.log(`👥 Membres famille (${members.length}) :`, members.slice(0,3).map(m => `"${m.steamid}" (${typeof m.steamid})`).join(', '));
      const memberData = members.find(m => String(m.steamid).trim() === String(search).trim());
      console.log(`✅ Trouvé dans famille : ${!!memberData}`);
      return [{
        steamid:   search,
        name:      info.last_name || search,
        class:     memberData?.class || null,
        owner:     memberData?.owner || null,
        discordid: info.discordid || null,
        coins:     info.coins || 0,
        connected: info.connected || false,
        inFamily:  !!memberData,
      }];
    }
    return [];
  }

  // Cas 2 : Recherche par nom dans les membres de la famille
  const members  = await getFamilyMembers();
  const infos    = await Promise.all(members.map(m => getPlayerInfo(m.steamid)));
  const allPlayers = members.map((m, i) => ({
    steamid:   m.steamid,
    name:      infos[i]?.last_name || m.steamid,
    class:     m.class,
    owner:     m.owner,
    discordid: infos[i]?.discordid || null,
    coins:     infos[i]?.coins || 0,
    connected: infos[i]?.connected || false,
    inFamily:  true,
  }));

  const searchLower = search.toLowerCase();
  const familyMatch = allPlayers.filter(p => p.name.toLowerCase().includes(searchLower));

  // Si trouvé dans la famille → retourner
  if (familyMatch.length > 0) return familyMatch;

  // Cas 3 : Pas trouvé dans la famille → informer l'utilisateur
  return [];
}

// ============================================================
// LOGIQUE ONLINE
// ============================================================

async function checkOnlineMembers() {
  const [members, familyInfo] = await Promise.all([
    getFamilyMembers(),
    getFamilyInfo(),
  ]);

  if (!members || members.length === 0) return null;

  const online = [], offline = [];

  // Récupérer tous les joueurs en parallèle
  const playerInfos = await Promise.all(members.map(m => getPlayerInfo(m.steamid)));

  for (let idx = 0; idx < members.length; idx++) {
    const member     = members[idx];
    const playerInfo = playerInfos[idx];
    const player = {
      steamid:   member.steamid,
      name:      playerInfo?.last_name || member.steamid,
      connected: playerInfo?.connected || false,
      class:     member.class,
      owner:     member.owner,
      discordid: playerInfo?.discordid || null,
      coins:     playerInfo?.coins || 0,
    };
    if (player.connected) {
      online.push(player);
      dailyConnections.add(player.steamid);
    } else {
      offline.push(player);
    }
  }

  return { online, offline, total: members.length, familyInfo };
}

// ============================================================
// EMBEDS
// ============================================================

function createOnlineEmbed(data) {
  const { online, offline, total, familyInfo } = data;

  const embed = new EmbedBuilder()
    .setTitle(`⚡ ${CONFIG.FAMILY_LABEL} - Membres en ligne`)
    .setColor(online.length > 0 ? CONFIG.COLOR_ONLINE : CONFIG.COLOR_OFFLINE)
    .setTimestamp()
    .setThumbnail(LOGO_URL)
    .setFooter({ text: `Famille Bako • Pika Pika ⚡ | MAJ auto toutes les 8h`, iconURL: LOGO_URL });

  if (familyInfo) {
    embed.setDescription(
      `💰 **Solde :** ${familyInfo.money?.toLocaleString('fr-FR')} €\n` +
      `⭐ **Points :** ${Math.round((familyInfo.points || 0) * 100) / 100}`
    );
  }

  if (online.length > 0) {
    const onlineList = online.map(p => {
      const role    = p.owner === 1 ? ' 👑' : '';
      const mention = p.discordid ? ` (<@${p.discordid}>)` : '';
      return `🟢 **${p.name}**${role}${mention}`;
    }).join('\n');
    embed.addFields({ name: `✅ En ligne (${online.length})`, value: onlineList.substring(0, 1024) });
  } else {
    embed.addFields({ name: '😴 Personne en ligne', value: 'Aucun membre connecté.' });
  }

  embed.addFields({
    name: '📊 Stats',
    value: `🟢 **${online.length}** en ligne | 🔴 **${offline.length}** hors ligne | 👥 **${total}** total`,
  });

  return embed;
}

// ============================================================
// MISE À JOUR AUTO
// ============================================================

async function updateStatusMessage() {
  try {
    const channel = await client.channels.fetch(CONFIG.CHANNEL_ID);
    if (!channel) return;

    const data = await checkOnlineMembers();
    if (!data) return;

    const embed = createOnlineEmbed(data);

    if (lastStatusMessageId) {
      try {
        const msg = await channel.messages.fetch(lastStatusMessageId);
        await msg.edit({ embeds: [embed] });
        return;
      } catch (e) {}
    }

    const sent = await channel.send({ embeds: [embed] });
    lastStatusMessageId = sent.id;
  } catch (error) {
    console.error(`❌ Erreur MAJ: ${error.message}`);
  }
}

// ============================================================
// RÉSUMÉ QUOTIDIEN
// ============================================================

async function sendDailySummary() {
  try {
    const channel = await client.channels.fetch(CONFIG.DAILY_CHANNEL_ID);
    if (!channel) return;

    const [familyInfo, bankLogs] = await Promise.all([getFamilyInfo(), getBankLogs()]);

    const today     = new Date(); today.setHours(0, 0, 0, 0);
    const todayLogs = bankLogs.filter(tx => new Date(tx.date) >= today);

    let todayDeposits = 0, todayWithdrawals = 0;
    todayLogs.forEach(tx => {
      const amount = Math.abs(tx.money);
      if (tx.type === 2) todayDeposits += amount;
      else todayWithdrawals += amount;
    });

    const connectedNames = [];
    for (const steamid of dailyConnections) {
      const info = await getPlayerInfo(steamid);
      connectedNames.push(info?.last_name || steamid);
    }

    const embed = new EmbedBuilder()
      .setTitle(`📋 ${CONFIG.FAMILY_LABEL} | Résumé du jour`)
      .setColor(CONFIG.COLOR_INFO)
      .setThumbnail(LOGO_URL)
      .setTimestamp()
      .setFooter({ text: 'Famille Bako • Pika Pika ⚡', iconURL: LOGO_URL });

    if (familyInfo) {
      embed.setDescription(
        `💰 **Solde :** ${familyInfo.money?.toLocaleString('fr-FR')} €\n` +
        `⭐ **Points :** ${Math.round((familyInfo.points || 0) * 100) / 100}`
      );
    }

    embed.addFields({
      name: `👥 Vus en ligne (${connectedNames.length})`,
      value: connectedNames.length > 0
        ? connectedNames.map(n => `• ${n}`).join('\n').substring(0, 1024)
        : "Personne aujourd'hui",
    });

    embed.addFields({
      name: '💸 Mouvements du jour',
      value: todayLogs.length > 0
        ? `📈 +${todayDeposits.toLocaleString('fr-FR')} € | 📉 -${todayWithdrawals.toLocaleString('fr-FR')} € | Net: **${(todayDeposits - todayWithdrawals).toLocaleString('fr-FR')} €**`
        : 'Aucune transaction',
    });

    await channel.send({ embeds: [embed] });
    dailyConnections = new Set();
  } catch (error) {
    console.error(`❌ Erreur résumé: ${error.message}`);
  }
}

function checkDailySummary() {
  const now        = new Date();
  const hours      = now.getHours();
  const minutes    = now.getMinutes();
  // Envoyer le résumé toutes les 8h (00h, 08h, 16h)
  const SUMMARY_HOURS = [0, 8, 16];
  const key        = `${now.toDateString()}-${hours}`;
  if (hours === 23 && minutes === 0 && lastDailySummaryDate !== now.toDateString()) {
  lastDailySummaryDate = now.toDateString();
  sendDailySummary();
}
}

// ============================================================
// GESTION DES SLASH COMMANDS
// ============================================================

// ============================================================
// BUILDERS - Fonctions de construction des embeds réutilisables
// ============================================================

function buildWarnsEmbed(playerName, steamid, warns) {
  const now        = Date.now();
  const TWO_MONTHS = 60 * 24 * 60 * 60 * 1000;
  const activeW    = warns.filter(w => (now - new Date(w.date).getTime()) < TWO_MONTHS);
  const oldW       = warns.filter(w => (now - new Date(w.date).getTime()) >= TWO_MONTHS);

  const formatW = (w, i) => {
    const d  = new Date(w.date);
    const ds = `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;
    return `**${i+1}.** [${w.type || 'warn'}] ${w.reason || 'Non spécifiée'} - *${ds}*`;
  };

  const embed = new EmbedBuilder()
    .setTitle(`⚠️ Warns - ${playerName}`)
    .setColor(activeW.length > 0 ? CONFIG.COLOR_OFFLINE : oldW.length > 0 ? 0xffa500 : 0x4caf50)
    .setThumbnail(LOGO_URL)
    .setTimestamp()
    .setFooter({ text: 'Famille Bako • Pika Pika ⚡', iconURL: LOGO_URL });

  if (warns.length === 0) {
    embed.setDescription('✅ Aucun avertissement actif.');
  } else {
    let desc = '';
    if (activeW.length > 0) {
      desc += `🔴 **${activeW.length}** warn(s) actif(s) :
${activeW.map(formatW).join('\n')}`;
    } else {
      desc += '✅ Aucun warn actif récent';
    }
    if (oldW.length > 0) {
      desc += `

🟡 **${oldW.length}** oldwarn(s) (> 2 mois) :
${oldW.map(formatW).join('\n')}`;
    }
    embed.setDescription(desc.substring(0, 4000));
  }
  embed.addFields({ name: '🎮 SteamID', value: `\`${steamid}\`` });

  return { embed, row: createWarnsMenu(steamid) };
}

async function buildJoueurEmbed(player) {
  const { steamid, inFamily, class: memberRole } = player;

  const [playerInfo, warns, staffInfo, bankLogs] = await Promise.all([
    getPlayerInfo(steamid),
    getPlayerWarns(steamid),
    isStaff(steamid),
    inFamily ? getBankLogs() : Promise.resolve([]),
  ]);

  let totalDep = 0, totalWith = 0;
  if (inFamily) {
    bankLogs.filter(tx => String(tx.steamid) === String(steamid)).forEach(tx => {
      const a = Math.abs(tx.money);
      if (tx.type === 2) totalDep += a; else totalWith += a;
    });
  }

  const connected     = playerInfo?.connected || false;
  const staffRankId   = staffInfo?.rank_staff;
  const staffRankName = staffRankId ? (STAFF_RANKS[staffRankId] || `Rang ${staffRankId}`) : null;
  const staff         = staffInfo?.is_staff ? `✅ ${staffRankName}` : '❌ Non staff';
  const roleStr       = !inFamily ? '👤 Hors famille Bako'
    : (memberRole === 'owner' || playerInfo?.owner === 1 ? '👑 Chef de famille' : `👤 ${memberRole || 'Membre'}`);
  const playerName    = playerInfo?.last_name || steamid;

  const now        = Date.now();
  const TWO_MONTHS = 60 * 24 * 60 * 60 * 1000;
  const activeWarns = warns.filter(w => (now - new Date(w.date).getTime()) < TWO_MONTHS);
  const oldWarns    = warns.filter(w => (now - new Date(w.date).getTime()) >= TWO_MONTHS);

  const formatWarn = (w, i) => {
    const d  = new Date(w.date);
    const ds = `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;
    return `**${i+1}.** [${w.type || 'warn'}] ${w.reason || 'Non précisée'} - *${ds}*`;
  };

  let warnsValue;
  if (warns.length === 0) {
    warnsValue = '✅ Aucun avertissement actif';
  } else {
    if (activeWarns.length > 0) {
      warnsValue = `🔴 **${activeWarns.length}** warn(s) actif(s) :
${activeWarns.slice(0,5).map(formatWarn).join('\n')}`;
      if (activeWarns.length > 5) warnsValue += `
*...et ${activeWarns.length - 5} de plus*`;
    } else {
      warnsValue = '✅ Aucun warn actif récent';
    }
    if (oldWarns.length > 0) {
      warnsValue += `

🟡 **${oldWarns.length}** oldwarn(s) (> 2 mois) :
${oldWarns.slice(0,3).map(formatWarn).join('\n')}`;
      if (oldWarns.length > 3) warnsValue += `
*...et ${oldWarns.length - 3} de plus*`;
    }
  }

  const embed = new EmbedBuilder()
    .setTitle(`👤 ${playerName}`)
    .setColor(connected ? CONFIG.COLOR_ONLINE : CONFIG.COLOR_OFFLINE)
    .setThumbnail(LOGO_URL)
    .addFields(
      { name: '📊 Statut',  value: `${connected ? '🟢 En ligne' : '🔴 Hors ligne'}
${roleStr}
${staff}`, inline: true },
      { name: '🪙 Coins',   value: `**${(playerInfo?.coins || 0).toLocaleString('fr-FR')}**`, inline: true },
      { name: '⚠️ Warns',   value: warnsValue },
      { name: '🎮 SteamID', value: `\`${steamid}\`` }
    )
    .setTimestamp();

  if (inFamily) {
    embed.addFields({
      name: '💰 Contributions Bako',
      value: `📈 +${totalDep.toLocaleString('fr-FR')} €
📉 -${totalWith.toLocaleString('fr-FR')} €
Net: **${(totalDep - totalWith).toLocaleString('fr-FR')} €**`,
      inline: true,
    });
  }
  if (playerInfo?.discordid) {
    embed.addFields({ name: '💬 Discord', value: `<@${playerInfo.discordid}>`, inline: true });
  }
  embed.setFooter({ text: inFamily ? '⚡ Membre de la Bako' : '🔍 Joueur hors famille', iconURL: LOGO_URL });

  return { embed, row: createJoueurMenu(steamid) };
}

async function buildBanqueEmbed(bankLogs, familyInfo) {
  const recent      = bankLogs.slice(0, 10);
  const uniqueSids   = [...new Set(recent.map(tx => tx.steamid))];
  const sidsInfos    = await Promise.all(uniqueSids.map(sid => getPlayerInfo(sid)));
  const recentNames  = {};
  uniqueSids.forEach((sid, i) => {
    recentNames[sid] = sidsInfos[i]?.last_name || sid;
  });
  const recentList = recent.map(tx => {
    const name   = recentNames[tx.steamid];
    const amount = Math.abs(tx.money);
    const icon   = tx.type === 2 ? '📈' : '📉';
    const sign   = tx.type === 2 ? '+' : '-';
    const d      = new Date(tx.date);
    const ds     = `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
    return `${icon} **${sign}${amount.toLocaleString('fr-FR')} €** - ${name} *(${ds})*`;
  }).join('\n');

  const playerTotals = {};
  bankLogs.forEach(tx => {
    if (!playerTotals[tx.steamid]) playerTotals[tx.steamid] = { deposits: 0, withdrawals: 0 };
    const amount = Math.abs(tx.money);
    if (tx.type === 2) playerTotals[tx.steamid].deposits += amount;
    else playerTotals[tx.steamid].withdrawals += amount;
  });

  const topDep    = Object.entries(playerTotals).sort((a,b) => b[1].deposits - a[1].deposits).slice(0,5);
  const topWith   = Object.entries(playerTotals).sort((a,b) => b[1].withdrawals - a[1].withdrawals).slice(0,5);
  const allTopIds = [...new Set([...topDep.map(t => t[0]), ...topWith.map(t => t[0])])];
  const topNames  = {};
  for (const sid of allTopIds) {
    topNames[sid] = (await getPlayerInfo(sid))?.last_name || sid;
  }
  const medals     = ['🥇','🥈','🥉','4️⃣','5️⃣'];
  const topDepList  = topDep.map((t,i)  => `${medals[i]} **${topNames[t[0]]}** - +${t[1].deposits.toLocaleString('fr-FR')} €`).join('\n');
  const topWithList = topWith.map((t,i) => `${medals[i]} **${topNames[t[0]]}** - -${t[1].withdrawals.toLocaleString('fr-FR')} €`).join('\n');

  const embed = new EmbedBuilder()
    .setTitle(`🏦 ${CONFIG.FAMILY_LABEL} - Banque`)
    .setColor(CONFIG.COLOR_INFO)
    .setThumbnail(LOGO_URL)
    .setTimestamp()
    .setFooter({ text: 'Famille Bako • Pika Pika ⚡', iconURL: LOGO_URL });
  if (familyInfo) embed.setDescription(`💰 **Solde :** ${familyInfo.money?.toLocaleString('fr-FR')} €`);
  embed.addFields(
    { name: '📜 10 dernières transactions', value: recentList.substring(0, 1024) },
    { name: '🏆 Top Déposants',             value: topDepList.substring(0, 1024),  inline: true },
    { name: '💸 Top Retraits',              value: topWithList.substring(0, 1024), inline: true }
  );
  return { embed };
}

async function buildClassementEmbed(bankLogs) {
  const playerTotals = {};
  bankLogs.forEach(tx => {
    if (!playerTotals[tx.steamid]) playerTotals[tx.steamid] = { deposits: 0, withdrawals: 0, transactions: 0 };
    const amount = Math.abs(tx.money);
    if (tx.type === 2) playerTotals[tx.steamid].deposits += amount;
    else playerTotals[tx.steamid].withdrawals += amount;
    playerTotals[tx.steamid].transactions++;
  });
  const sorted = Object.entries(playerTotals)
    .map(([steamid, s]) => ({ steamid, net: s.deposits - s.withdrawals, transactions: s.transactions }))
    .sort((a,b) => b.net - a.net).slice(0, 15);
  const nameInfos = await Promise.all(sorted.map(e => getPlayerInfo(e.steamid)));
  const names = {};
  sorted.forEach((e, i) => {
    names[e.steamid] = nameInfos[i]?.last_name || e.steamid;
  });
  const medals = ['🥇','🥈','🥉'];
  const list   = sorted.map((p,i) => {
    const medal = i < 3 ? medals[i] : `**${i+1}.**`;
    const sign  = p.net >= 0 ? '+' : '';
    return `${medal} **${names[p.steamid]}** - ${sign}${p.net.toLocaleString('fr-FR')} € *(${p.transactions} tx)*`;
  }).join('\n');
  const embed = new EmbedBuilder()
    .setTitle(`🏆 ${CONFIG.FAMILY_LABEL} - Classement contributeurs`)
    .setColor(CONFIG.COLOR_GOLD)
    .setThumbnail(LOGO_URL)
    .setDescription(list.substring(0, 4000))
    .setTimestamp()
    .setFooter({ text: 'Famille Bako • Pika Pika ⚡ | Trié par dépôts nets', iconURL: LOGO_URL });
  return { embed };
}

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const { commandName } = interaction;

  // ═══════════════════════ /online ════════════════════════════
  if (commandName === 'online') {
    await interaction.deferReply();
    const data = await checkOnlineMembers();
    if (!data) { await interaction.editReply('❌ Impossible de récupérer les données.'); return; }
    const msg = await interaction.editReply({ embeds: [createOnlineEmbed(data)], components: [createOnlineMenu()] });
    attachMenuCollector(msg, 'online', null, interaction);
  }

  // ═══════════════════════ /stats ═════════════════════════════
  if (commandName === 'stats') {
    await interaction.deferReply();
    const data = await checkOnlineMembers();
    if (!data) { await interaction.editReply('❌ Impossible de récupérer les données.'); return; }

    const allMembers = [...data.online, ...data.offline];
    let list = allMembers.map(p => {
      const status = p.connected ? '🟢' : '🔴';
      const role   = p.owner === 1 ? '👑 Chef' : p.class || 'Membre';
      return `${status} **${p.name}** - ${role}`;
    }).join('\n');
    if (list.length > 4000) list = list.substring(0, 4000) + '\n...';

    const embed = new EmbedBuilder()
      .setTitle(`⚡ ${CONFIG.FAMILY_LABEL} - Tous les membres`)
      .setColor(CONFIG.COLOR_INFO)
      .setThumbnail(LOGO_URL)
      .setDescription(list)
      .addFields({ name: '📊 Résumé', value: `🟢 **${data.online.length}** en ligne / 👥 **${data.total}** total` })
      .setTimestamp()
      .setFooter({ text: 'Famille Bako • Pika Pika ⚡', iconURL: LOGO_URL });
    await interaction.editReply({ embeds: [embed] });
  }

  // ═══════════════════════ /famille ═══════════════════════════
  if (commandName === 'famille') {
    await interaction.deferReply();
    const familyInfo = await getFamilyInfo();
    if (!familyInfo) { await interaction.editReply('❌ Impossible de récupérer les infos.'); return; }

    const embed = new EmbedBuilder()
      .setTitle(`⚡ ${CONFIG.FAMILY_LABEL} - Informations`)
      .setColor(CONFIG.COLOR_ONLINE)
      .setThumbnail(LOGO_URL)
      .addFields(
        { name: '💰 Solde', value: `**${familyInfo.money?.toLocaleString('fr-FR')} €**`, inline: true },
        { name: '⭐ Points', value: `**${Math.round((familyInfo.points || 0) * 100) / 100}**`, inline: true }
      )
      .setTimestamp()
      .setFooter({ text: 'Famille Bako • Pika Pika ⚡', iconURL: LOGO_URL });
    await interaction.editReply({ embeds: [embed] });
  }

  // ═══════════════════════ /banque ════════════════════════════
  if (commandName === 'banque') {
    await interaction.deferReply();
    const [bankLogs, familyInfo] = await Promise.all([getBankLogs(), getFamilyInfo()]);
    if (!bankLogs || bankLogs.length === 0) { await interaction.editReply('❌ Aucune transaction trouvée.'); return; }
    const { embed } = await buildBanqueEmbed(bankLogs, familyInfo);
    const msg        = await interaction.editReply({ embeds: [embed], components: [createBanqueMenu()] });
    attachMenuCollector(msg, 'banque', null, interaction);
  }

  // ═══════════════════════ /classement ════════════════════════
  if (commandName === 'classement') {
    await interaction.deferReply();
    const bankLogs = await getBankLogs();
    if (!bankLogs || bankLogs.length === 0) { await interaction.editReply('❌ Aucune transaction trouvée.'); return; }
    const { embed } = await buildClassementEmbed(bankLogs);
    const msg        = await interaction.editReply({ embeds: [embed], components: [createClassementMenu()] });
    attachMenuCollector(msg, 'classement', null, interaction);
  }

  // ═══════════════════════ /joueur ════════════════════════════
  // Fonctionne pour N'IMPORTE QUEL joueur du serveur via SteamID,
  // ou par nom pour les membres de la Bako.
  if (commandName === 'joueur') {
    await interaction.deferReply();
    const search = interaction.options.getString('nom');

    // Déterminer le SteamID à utiliser
    let steamid    = null;
    let playerName = search;
    let inFamily   = false;
    let memberRole = null;

    if (/^7656\d{13}$/.test(search)) {
      // SteamID direct → vérifier aussi si dans la famille
      steamid = search;
      const [info, members] = await Promise.all([
        getPlayerInfo(steamid),
        getFamilyMembers(),
      ]);
      if (!info) { await interaction.editReply(`❌ Joueur introuvable pour le SteamID \`${steamid}\`.`); return; }
      playerName  = info.last_name || steamid;
      const memberData = members.find(m => String(m.steamid).trim() === String(steamid).trim());
      inFamily    = !!memberData;
      memberRole  = memberData?.class || null;
      console.log(`🔍 /joueur SteamID "${steamid}" - inFamily: ${inFamily} - membres: ${members.length}`);
    } else {
      // Recherche par nom dans la famille
      const found = await findPlayer(search);
      if (!found || found.length === 0) {
        await interaction.editReply(
          `❌ Aucun membre de la Bako trouvé pour **"${search}"**.\n` +
          `💡 Pour chercher un joueur hors famille, utilise directement son **SteamID64**.`
        );
        return;
      }
      if (found.length > 1) {
        const list = found.map(p => `• **${p.name}** (\`${p.steamid}\`)`).join('\n');
        await interaction.editReply(`⚠️ Plusieurs résultats :\n${list}\n\nPrécise le nom ou utilise le SteamID.`);
        return;
      }
      steamid    = found[0].steamid;
      playerName = found[0].name;
      inFamily   = found[0].inFamily;
      memberRole = found[0].class;
    }

    const playerObj      = { steamid, inFamily, class: memberRole };
    const { embed, row } = await buildJoueurEmbed(playerObj);
    const msg            = await interaction.editReply({ embeds: [embed], components: [row] });
    attachMenuCollector(msg, 'joueur', steamid, interaction);
  }

  // ═══════════════════════ /warns ═════════════════════════════
  if (commandName === 'warns') {
    await interaction.deferReply();
    const search = interaction.options.getString('nom');

    let steamid    = null;
    let playerName = search;

    if (/^7656\d{13}$/.test(search)) {
      steamid = search;
      const info = await getPlayerInfo(steamid);
      playerName = info?.last_name || steamid;
    } else {
      const found = await findPlayer(search);
      if (!found || found.length === 0) {
        await interaction.editReply(`❌ Aucun membre de la Bako trouvé pour **"${search}"**.\n💡 Pour un joueur hors famille, utilise son **SteamID64** directement.`);
        return;
      }
      if (found.length > 1) {
        await interaction.editReply(`⚠️ Plusieurs résultats :\n${found.map(p => `• **${p.name}** (\`${p.steamid}\`)`).join('\n')}`);
        return;
      }
      steamid    = found[0].steamid;
      playerName = found[0].name;
    }

    const warns           = await getPlayerWarns(steamid);
    const { embed, row }  = buildWarnsEmbed(playerName, steamid, warns);
    const msg             = await interaction.editReply({ embeds: [embed], components: [row] });
    attachMenuCollector(msg, 'warns', steamid, interaction);
  }

  // ═══════════════════════ /refresh ═══════════════════════════
  if (commandName === 'refresh') {
    clearCache();
    await interaction.reply('✅ Cache vidé ! Les prochaines commandes récupèreront des données fraîches.');
  }
});

// ============================================================
// DÉMARRAGE
// ============================================================

client.once('clientReady', async () => {
  console.log(`✅ Bot connecté : ${client.user.tag}`);
  console.log(`⚡ Famille      : ${CONFIG.FAMILY_LABEL}`);
  console.log(`⏰ Statut auto  : toutes les 8h (00h, 08h, 16h)`);
  console.log(`📋 Résumé       : toutes les 8h (00h, 08h, 16h)`);

  await registerCommands();

  setTimeout(updateStatusMessage, 10000);
  setInterval(updateStatusMessage, 8 * 60 * 60 * 1000); // toutes les 8h
  setInterval(checkDailySummary, 60 * 1000);
});

client.login(CONFIG.DISCORD_TOKEN);
