import type { FontPresetKey, FontSizeKey } from '~/shared/fontPresets'

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
  homePage: string
  fontFamily: FontPresetKey
  fontSize: FontSizeKey
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
  homePage: '/home',
  fontFamily: 'fraunces-manrope',
  fontSize: 'md',
}

export function useSiteConfig() {
  return useState<PublicSiteConfig>('siteConfig', () => ({ ...DEFAULT_CONFIG }))
}
