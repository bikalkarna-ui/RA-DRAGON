import type { MetadataRoute } from 'next';

const BASE_URL = 'https://ryxsorai.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/login', '/register', '/privacy', '/terms'],
        disallow: [
          '/home',
          '/pos',
          '/cashier',
          '/inventory',
          '/ordering',
          '/invoices',
          '/reports',
          '/alerts',
          '/settings',
          '/search',
          '/migration',
          '/onboarding',
          '/bank',
          '/deposit',
          '/employees',
          '/fuel',
          '/performance',
          '/shrink',
          '/tax',
          '/trends',
          '/vendors',
          '/api/',
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
