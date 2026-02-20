# ⚡ Bako Bot — Bot Discord Famille Bako

Bot Discord de gestion de la famille **Bako** sur le serveur DarkRP LYG.
Affiche les membres en ligne, les stats, la banque, et les warns des joueurs.

---

## 📁 Structure du projet

```
bako-bot/
├── bako_bot.js        # Code principal du bot
├── package.json       # Dépendances du projet
├── package-lock.json  # Versions verrouillées des dépendances
└── README.md          # Ce fichier
```

---

## 🚀 Installation

### Prérequis
- [Node.js](https://nodejs.org/) **v18 ou supérieur**
- Un compte Discord avec accès au [Developer Portal](https://discord.com/developers/applications)

### Étapes

**1. Cloner / copier les fichiers** dans un dossier `bako-bot/`

**2. Installer les dépendances**
```bash
npm install
```

**3. Configurer le bot** (voir section Configuration ci-dessous)

**4. Lancer le bot**
```bash
npm start
```

---

## ⚙️ Configuration

Ouvre `bako_bot.js` et remplis le bloc `CONFIG` en haut du fichier :

```js
const CONFIG = {
  DISCORD_TOKEN:    "VOTRE_TOKEN_ICI",
  APPLICATION_ID:   "VOTRE_APPLICATION_ID_ICI",
  CHANNEL_ID:       "ID_SALON_STATUS",
  DAILY_CHANNEL_ID: "ID_SALON_RESUME",
  ...
};
```

| Champ | Description | Où le trouver |
|-------|-------------|---------------|
| `DISCORD_TOKEN` | Token du bot | Developer Portal → Bot → Reset Token |
| `APPLICATION_ID` | ID de l'application | Developer Portal → General Information |
| `CHANNEL_ID` | Salon du statut automatique | Clic droit sur le salon → Copier l'identifiant |
| `DAILY_CHANNEL_ID` | Salon du résumé quotidien | Clic droit sur le salon → Copier l'identifiant |

> ⚠️ **Ne partagez jamais votre token Discord.** Si il est compromis, régénérez-le immédiatement depuis le Developer Portal.

---

## 📋 Commandes disponibles

| Commande | Description |
|----------|-------------|
| `/online` | Affiche les membres de la Bako actuellement en ligne |
| `/stats` | Liste complète de tous les membres avec leur statut |
| `/famille` | Solde et points de la famille |
| `/banque` | 10 dernières transactions + top déposants/retraits |
| `/classement` | Top 15 contributeurs triés par dépôts nets |
| `/joueur <nom ou SteamID>` | Fiche complète d'un joueur + ses warns |
| `/warns <nom ou SteamID>` | Avertissements d'un joueur |
| `/refresh` | Vide le cache pour forcer la mise à jour des données |

### 💡 Astuce pour `/joueur` et `/warns`

- **Membre de la Bako** → utilise son nom RP (ex: `/joueur Allex Bako`)
- **N'importe quel joueur du serveur** → utilise son SteamID64 (ex: `/joueur 76561198443211665`)

---

## 🔄 Fonctionnement automatique

- **Statut en ligne** : mis à jour toutes les **15 minutes** dans le salon configuré
- **Résumé quotidien** : envoyé automatiquement à **22h00** avec les membres vus dans la journée et les mouvements bancaires du jour

---

## 🛠️ Dépendances

| Package | Version | Rôle |
|---------|---------|------|
| `discord.js` | ^14.16.3 | Interactions avec l'API Discord |

---

## 🌐 API utilisée

Le bot utilise l'API publique **LYG** :
- **Base URL** : `https://api.lyg.fr/api`
- **Rate limit** : 100 requêtes / 15 min
- **Format** : JSON

### Endpoints utilisés

| Endpoint | Données |
|----------|---------|
| `/darkrp/familles/bako/members` | Liste des membres |
| `/darkrp/familles/bako/infos` | Solde et points famille |
| `/darkrp/familles/bako/banklogs` | Historique bancaire |
| `/players/:steamid` | Infos d'un joueur |
| `/warns/:steamid` | Warns d'un joueur |
| `/staff/isstaff/:steamid` | Statut staff |

---

## ❓ Dépannage

**Le bot ne répond pas aux commandes**
→ Vérifiez que le bot est bien invité sur le serveur avec les permissions `applications.commands` et `bot`.

**Erreur `Missing Access`**
→ Le bot n'a pas accès au salon configuré. Vérifiez les permissions du salon.

**Les slash commands n'apparaissent pas**
→ Patientez jusqu'à 1 heure (propagation Discord) ou relancez le bot.

**Rate limit API**
→ Le bot gère automatiquement les rate limits avec une pause de 5 secondes avant de réessayer.

---

## 👤 Auteur

Bot développé pour la **Famille Bako** — Serveur DarkRP LYG ⚡
