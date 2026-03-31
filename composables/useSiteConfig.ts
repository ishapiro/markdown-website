export interface PublicSiteConfig {
  siteTitle: string
  siteTagline: string
  siteLogoKey: string
  copyrightNotice: string
  authorName: string
  twitterUrl: string
  githubUrl: string
  linkedinUrl: string
  mastodonUrl: string
  ogImageUrl: string
  faviconUrl: string
  robotsMeta: string
}

const DEFAULT_CONFIG: PublicSiteConfig = {
  siteTitle: 'My Blog',
  siteTagline: '',
  siteLogoKey: '',
  copyrightNotice: '',
  authorName: '',
  twitterUrl: '',
  githubUrl: '',
  linkedinUrl: '',
  mastodonUrl: '',
  ogImageUrl: '',
  faviconUrl: '',
  robotsMeta: 'index,follow',
}

export function useSiteConfig() {
  return useState<PublicSiteConfig>('siteConfig', () => ({ ...DEFAULT_CONFIG }))
}
