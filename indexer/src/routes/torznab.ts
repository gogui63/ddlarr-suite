import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getScraper, isValidSite, contentTypeToCategory } from '../scrapers/index.js';
import { buildTorznabResponse, buildCapsResponse, buildErrorResponse } from '../utils/xml.js';
import { TorznabItem, ScraperResult, ContentType, SearchParams } from '../models/torznab.js';
import { config } from '../config.js';
import { isDlProtectLink, resolveDlProtectLink } from '../utils/dlprotect.js';

interface TorznabQuerystring {
  t?: string;
  q?: string;
  cat?: string;
  limit?: string;
  offset?: string;
  imdbid?: string;
  tmdbid?: string;
  tvdbid?: string;
  season?: string;
  ep?: string;
  apikey?: string;
}

const MOVIE_CATEGORIES = [2000, 2030, 2040, 2045, 2060];
const TV_CATEGORIES = [5000, 5030, 5040, 5045];
const ANIME_CATEGORIES = [5070];
const EBOOK_CATEGORIES = [7000, 7010, 7020, 7030];

function getContentTypesFromCategories(categoryFilter: number[] | null): ContentType[] {
  if (!categoryFilter || categoryFilter.length === 0) {
    return ['movie', 'series', 'anime'];
  }
  const types: ContentType[] = [];
  if (categoryFilter.some(c => MOVIE_CATEGORIES.includes(c))) types.push('movie');
  if (categoryFilter.some(c => TV_CATEGORIES.includes(c))) types.push('series');
  if (categoryFilter.some(c => ANIME_CATEGORIES.includes(c))) types.push('anime');
  if (categoryFilter.some(c => EBOOK_CATEGORIES.includes(c))) types.push('ebook');
  return types.length > 0 ? types : ['movie', 'series', 'anime'];
}

async function processResults(results: ScraperResult[]): Promise<TorznabItem[]> {
  const items: TorznabItem[] = [];
  const resolveInIndexer = config.dlprotectResolveAt === 'indexer';
  const now = new Date();

  for (let i = 0; i < results.length; i++) {
    const res = results[i];
    let link = res.link;
    if (resolveInIndexer && isDlProtectLink(link)) {
      link = await resolveDlProtectLink(link);
    }

    items.push({
      title: res.title,
      guid: Buffer.from(`${res.link}-${res.title}`).toString('base64'),
      link,
      pubDate: res.pubDate || new Date(now.getTime() - i * 60000),
      size: res.size,
      category: contentTypeToCategory(res.contentType, res.quality),
      imdbId: res.imdbId,
      tmdbId: res.tmdbId,
      season: res.season,
      episode: res.episode,
      quality: res.quality,
      language: res.language,
    });
  }
  return items;
}

export async function torznabRoutes(app: FastifyInstance) {
  app.get<{ Querystring: TorznabQuerystring }>('/api/:site', async (request, reply) => {
    const { site } = request.params as { site: string };
    const { t, q, cat, limit, imdbid, tmdbid, tvdbid, season, ep } = request.query;

    if (!isValidSite(site as any)) {
      reply.type('application/xml');
      return buildErrorResponse(200, 'Site not supported');
    }

    const scraper = getScraper(site as any)!;
    reply.type('application/xml');

    if (t === 'caps') {
      return buildCapsResponse({ server: { title: scraper.name }, categories: [] });
    }

    const categoryFilter = cat ? cat.split(',').map(Number) : null;
    
    // Correction finale : 'ep' au lieu de 'episode' et passage direct des strings
    const searchParams: SearchParams = {
      q,
      limit: limit ? parseInt(limit, 10) : 100,
      imdbid,
      tmdbid,
      tvdbid,
      season: season,
      ep: ep
    };

    if (!q && !imdbid && !tmdbid && !tvdbid) {
      const contentTypes = getContentTypesFromCategories(categoryFilter);
      let allResults: ScraperResult[] = [];

      if (scraper.getLatest) {
        const tasks = contentTypes.map(type => scraper.getLatest!(type, searchParams.limit));
        const completed = await Promise.allSettled(tasks);
        for (const res of completed) {
          if (res.status === 'fulfilled') allResults = [...allResults, ...res.value];
        }
      }

      let items = await processResults(allResults);
      
      if (categoryFilter) {
        items = items.filter(item => categoryFilter.includes(item.category as number));
      }

      items.sort((a, b) => {
        const dateA = a.pubDate ? new Date(a.pubDate).getTime() : 0;
        const dateB = b.pubDate ? new Date(b.pubDate).getTime() : 0;
        return dateB - dateA;
      });

      const protocol = (request.headers['x-forwarded-proto'] as string) || 'http';
      const host = request.headers.host;
      return buildTorznabResponse(items, scraper.name, `${protocol}://${host}`);
    }

    const results = await scraper.search(searchParams);
    const items = await processResults(results);
    return buildTorznabResponse(items, scraper.name);
  });
}