import type { FontPresetKey, FontSizeKey, BackgroundPresetKey, ContentWidthKey, TextStyleKey, HeadingColorKey, HeadingRuleStyleKey, H2RuleColorKey, LogoSizeKey } from '~/shared/fontPresets'

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
  backgroundPreset: BackgroundPresetKey
  contentWidth: ContentWidthKey
  textStyle: TextStyleKey
  headingColor: HeadingColorKey
  headingRuleStyle: HeadingRuleStyleKey
  h2RuleColor: H2RuleColorKey
  logoSize: LogoSizeKey
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
  backgroundPreset: 'white',
  contentWidth: 'medium',
  textStyle: 'classic',
  headingColor: 'default',
  headingRuleStyle: 'short',
  h2RuleColor: 'green',
  logoSize: 'md',
}

export function useSiteConfig() {
  return useState<PublicSiteConfig>('siteConfig', () => ({ ...DEFAULT_CONFIG }))
}
