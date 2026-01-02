import { XMLBuilder } from 'fast-xml-parser';
import { TorznabItem } from '../models/torznab.js';

const xmlBuilder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  format: true,
  suppressEmptyNode: true,
  suppressBooleanAttributes: false,
});

function formatDate(date: Date | undefined): string {
  const d = date || new Date();
  return d.toUTCString();
}

export function buildTorznabResponse(items: TorznabItem[], siteName: string, baseUrl?: string) {
  const response = {
    rss: {
      '@_version': '2.0',
      '@_xmlns:torznab': 'http://torznab.com/schemas/2015/feed',
      channel: {
        title: siteName,
        description: `Torznab feed for ${siteName}`,
        link: baseUrl || '',
        item: items.map(item => {
          // GUID unique pour éviter les fusions de lignes dans Prowlarr
          const guidValue = Buffer.from(`${item.link}-${item.title}`).toString('base64');
          
          return {
            title: item.title,
            guid: {
              '@_isPermaLink': 'false',
              '#text': guidValue,
            },
            link: item.link,
            pubDate: formatDate(item.pubDate),
            category: item.category,
            description: item.title,
            enclosure: {
              '@_url': item.link,
              '@_length': item.size || 0,
              '@_type': 'application/x-bittorrent',
            },
            'torznab:attr': [
              { '@_name': 'category', '@_value': item.category },
              { '@_name': 'size', '@_value': item.size || 0 },
              ...(item.imdbId ? [{ '@_name': 'imdbid', '@_value': item.imdbId }] : []),
              ...(item.tmdbId ? [{ '@_name': 'tmdbid', '@_value': item.tmdbId }] : []),
              ...(item.season !== undefined ? [{ '@_name': 'season', '@_value': item.season }] : []),
              ...(item.episode !== undefined ? [{ '@_name': 'episode', '@_value': item.episode }] : []),
            ],
          };
        }),
      },
    },
  };

  return xmlBuilder.build(response);
}

export function buildCapsResponse(caps: any) {
  const response = {
    caps: {
      server: {
        '@_version': '1.0',
        '@_title': caps?.server?.title || 'Indexer',
      },
      limits: { '@_max': '100', '@_default': '50' },
      retention: { '@_value': '999' },
      registration: { '@_status': 'open', '@_open': 'yes' },
      searching: {
        search: { '@_available': 'yes', '@_supportedParams': 'q' },
        'tv-search': { '@_available': 'yes', '@_supportedParams': 'q,season,ep' },
        'movie-search': { '@_available': 'yes', '@_supportedParams': 'q,imdbid,tmdbid' },
      },
      categories: {
        category: (caps?.categories || []).map((cat: any) => ({
          '@_id': cat.id,
          '@_name': cat.name,
          subcat: (cat.subcats || []).map((sub: any) => ({
            '@_id': sub.id,
            '@_name': sub.name,
          })),
        })),
      },
    },
  };

  return xmlBuilder.build(response);
}

export function buildErrorResponse(code: number, description: string) {
  const response = {
    error: {
      '@_code': code,
      '@_description': description,
    },
  };
  return xmlBuilder.build(response);
}