import type { HomepageContent } from '@shared/schema';

// Minimal defaults - Real content comes from database
export const DEFAULT_HOMEPAGE_CONTENT: HomepageContent = {
  heroBadgeImageUrl: '',
  heroBadgeAlt: '',
  trustBadges: [],
  categoriesSection: {
    title: '',
    subtitle: '',
    ctaText: '',
  },
  reviewsSection: {
    title: '',
    subtitle: '',
    embedUrl: '',
  },
  blogSection: {
    title: '',
    subtitle: '',
    viewAllText: '',
    readMoreText: '',
  },
  aboutSection: {
    label: '',
    heading: '',
    description: '',
    defaultImageUrl: '',
    highlights: [],
  },
  areasServedSection: {
    label: '',
    heading: '',
    description: '',
    ctaText: '',
  },
  horizontalScrollSection: {
    enabled: false,
    mode: 'services',
    sectionId: '',
    title: '',
    subtitle: '',
    cards: [],
  },
  consultingStepsSection: {
    enabled: false,
    sectionId: '',
    title: '',
    subtitle: '',
    steps: [],
    practicalBlockTitle: '',
    practicalBullets: [],
    ctaButtonLabel: '',
    ctaButtonLink: '',
    helperText: '',
    tagLabel: '',
    stepLabel: '',
    whatWeDoLabel: '',
    outcomeLabel: '',
    practicalBlockSubtitle: '',
    nextStepLabel: '',
    nextStepText: '',
  },
};
