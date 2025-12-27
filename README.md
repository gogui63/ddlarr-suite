# DDL Torznab

Indexeur Torznab pour sites DDL (Direct Download Links), compatible avec Sonarr et Radarr.

## Sites supportés

| Site | Variable ENV | Description |
|------|--------------|-------------|
| WawaCity | `WAWACITY_URL` | Scraping HTML |
| Zone-Téléchargement | `ZONETELECHARGER_URL` | Scraping HTML |
| DarkiWorld | `DARKIWORLD_URL` | API |

## Installation

### Avec Docker (recommandé)

```bash
# Cloner le repo
git clone https://github.com/votre-repo/ddl_torznab.git
cd ddl_torznab

# Configurer les variables d'environnement
cp .env.example .env
# Éditer .env avec vos URLs

# Lancer (inclut le service de résolution dl-protect)
docker-compose up -d
```

### Sans Docker

```bash
# Installer les dépendances
npm install

# Configurer
cp .env.example .env

# Build
npm run build

# Lancer
npm start

# Ou en développement (hot reload)
npm run dev
```

## Configuration

### Variables d'environnement

| Variable | Description | Requis |
|----------|-------------|--------|
| `PORT` | Port du serveur (défaut: 9117) | Non |
| `HOST` | Host du serveur (défaut: 0.0.0.0) | Non |
| `WAWACITY_URL` | URL de WawaCity | Non* |
| `ZONETELECHARGER_URL` | URL de Zone-Téléchargement | Non* |
| `DARKIWORLD_URL` | URL de l'API DarkiWorld | Non* |
| `DARKIWORLD_API_KEY` | Clé API DarkiWorld | Non |
| `ALLDEBRID_API_KEY` | Clé API AllDebrid | Non |
| `DLPROTECT_SERVICE_URL` | URL du service de résolution dl-protect | Non |

> \* Au moins une URL de site doit être configurée.

### AllDebrid (optionnel)

Si `ALLDEBRID_API_KEY` est configuré :
1. Les liens dl-protect sont d'abord résolus via l'API AllDebrid (redirector)
2. Les liens DDL sont ensuite convertis via AllDebrid (debrid)
3. Si AllDebrid échoue, le service Botasaurus prend le relais

Si non configuré :
- Les liens dl-protect sont résolus via le service Botasaurus
- Les liens DDL bruts sont retournés

### Service de résolution dl-protect

Le docker-compose inclut un service Python basé sur [Botasaurus](https://github.com/omkarcloud/botasaurus) qui :
- Résout les liens dl-protect en simulant un navigateur réel
- Bypass automatiquement les protections Cloudflare Turnstile
- Cache les résolutions de manière permanente
- Simule un comportement humain (délais aléatoires)

## Interface Web

Ouvrez `http://localhost:9117` dans votre navigateur pour accéder à l'interface web qui permet de :
- Voir les sites configurés et leur statut
- Générer les URLs par application :
  - **Radarr** : Films (catégories 2000, 2040, 2045)
  - **Sonarr** : Séries (catégories 5000, 5040, 5045)
  - **Sonarr (Anime)** : Anime (catégorie 5070 dans le champ "Anime Categories")

## API Endpoints

### Informations

| Endpoint | Description |
|----------|-------------|
| `GET /` | Interface web (HTML) |
| `GET /info` | Informations JSON sur le service |
| `GET /health` | Health check |
| `GET /sites` | Liste des sites configurés |

### Torznab API

Format : `GET /api/:site` où `:site` = `wawacity` | `zonetelecharger` | `darkiworld`

| Endpoint | Description |
|----------|-------------|
| `/api/:site?t=caps` | Capacités de l'indexeur |
| `/api/:site?t=search&q=...` | Recherche générale |
| `/api/:site?t=movie&q=...` | Recherche films |
| `/api/:site?t=tvsearch&q=...` | Recherche séries |

#### Paramètres de recherche

| Paramètre | Description |
|-----------|-------------|
| `q` | Terme de recherche |
| `cat` | Catégories (ex: 2000,5000) |
| `limit` | Nombre max de résultats (défaut: 100) |
| `offset` | Décalage pour pagination |
| `imdbid` | ID IMDb (ex: tt1234567) |
| `tmdbid` | ID TMDb |
| `tvdbid` | ID TVDb |
| `season` | Numéro de saison |
| `ep` | Numéro d'épisode |
| `hoster` | Filtrer par hébergeur (ex: 1fichier,rapidgator) |

## Configuration Sonarr / Radarr

### Radarr (Films)

1. Settings → Indexers → Add (bouton +)
2. Choisir **Torznab**
3. Configurer :
   - **Name** : WawaCity (ou autre)
   - **URL** : `http://localhost:9117/api/wawacity`
   - **API Key** : laisser vide
   - **Categories** : 2000, 2040, 2045

### Sonarr (Séries)

1. Settings → Indexers → Add (bouton +)
2. Choisir **Torznab**
3. Configurer :
   - **Name** : WawaCity (ou autre)
   - **URL** : `http://localhost:9117/api/wawacity`
   - **API Key** : laisser vide
   - **Categories** : 5000, 5040, 5045
   - **Anime Categories** : 5070

## Catégories Torznab

| Catégorie | Code | Description |
|-----------|------|-------------|
| Movies | 2000 | Films |
| Movies/HD | 2040 | Films HD (720p, 1080p) |
| Movies/UHD | 2045 | Films 4K |
| TV | 5000 | Séries |
| TV/HD | 5040 | Séries HD |
| TV/UHD | 5045 | Séries 4K |
| Anime | 5070 | Anime |

## Docker Compose

```yaml
services:
  ddl-torznab:
    build: .
    container_name: ddl-torznab
    ports:
      - "9117:9117"
    environment:
      - WAWACITY_URL=https://...
      - ZONETELECHARGER_URL=https://...
      - DARKIWORLD_URL=https://...
      - DARKIWORLD_API_KEY=
      - ALLDEBRID_API_KEY=
      - DLPROTECT_SERVICE_URL=http://dlprotect-resolver:5000
    volumes:
      - dlprotect-cache:/app/cache
    depends_on:
      - dlprotect-resolver
    restart: unless-stopped

  # Service Botasaurus pour résolution dl-protect
  dlprotect-resolver:
    build: ./botasaurus-service
    container_name: dlprotect-resolver
    environment:
      - CACHE_DIR=/app/cache
      - PORT=5000
    volumes:
      - dlprotect-cache:/app/cache
    restart: unless-stopped

volumes:
  dlprotect-cache:
```

## Structure du projet

```
ddl_torznab/
├── src/
│   ├── index.ts           # Point d'entrée Fastify
│   ├── config.ts          # Configuration (env vars)
│   ├── routes/
│   │   └── torznab.ts     # Routes API Torznab
│   ├── scrapers/
│   │   ├── base.ts        # Interface + helpers
│   │   ├── wawacity.ts    # Scraper WawaCity
│   │   ├── zonetelecharger.ts
│   │   └── darkiworld.ts  # Client API Darki
│   ├── debrid/
│   │   └── alldebrid.ts   # Client AllDebrid + dl-protect
│   ├── models/
│   │   └── torznab.ts     # Types TypeScript
│   ├── views/
│   │   └── home.ts        # Interface web HTML
│   └── utils/
│       ├── xml.ts         # Builder XML Torznab
│       ├── http.ts        # Client HTTP
│       └── dlprotect.ts   # Client service Botasaurus
├── botasaurus-service/
│   ├── main.py            # API Flask + Botasaurus
│   ├── requirements.txt
│   └── Dockerfile
├── Dockerfile
├── Dockerfile.dev
├── docker-compose.yml
├── docker-compose.dev.yml
├── package.json
└── tsconfig.json
```

## Développement

### Mode développement local

```bash
# Installer les dépendances
npm install

# Lancer en mode dev (hot reload)
npm run dev

# Type check
npm run typecheck

# Build
npm run build
```

### Mode développement Docker

```bash
# Lancer avec les fichiers de développement
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

Fonctionnalités du mode dev :
- Hot reload avec `tsx watch`
- Port de debug Node.js exposé sur `9229`
- Service Botasaurus accessible sur port `5000`
- Volumes montés pour voir les changements en direct

### Debug avec VS Code / WebStorm

Ajoute une configuration de debug Node.js :

```json
{
  "type": "node",
  "request": "attach",
  "name": "Docker Debug",
  "port": 9229,
  "address": "localhost",
  "localRoot": "${workspaceFolder}",
  "remoteRoot": "/app"
}
```

### Tester le service Botasaurus directement

```bash
# Health check
curl http://localhost:5000/health

# Résoudre un lien dl-protect
curl -X POST http://localhost:5000/resolve \
  -H "Content-Type: application/json" \
  -d '{"url": "https://dl-protect.link/abc123"}'

# Statistiques du cache
curl http://localhost:5000/cache/stats

# Vider le cache
curl -X POST http://localhost:5000/cache/clear
```

### Logs

```bash
# Voir les logs de tous les services
docker-compose logs -f

# Voir les logs d'un service spécifique
docker-compose logs -f ddl-torznab
docker-compose logs -f dlprotect-resolver
```

## Crédits

Inspiré par [wastream](https://github.com/Dyhlio/wastream) pour la logique de scraping.

## License

MIT
