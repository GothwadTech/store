// Local/preview-only demo fixtures. AppContext may initialize from these only
// when the synchronous hostname gate allows demo mode; production uses API data.
import type { Category, ReportItem, Review, StoreApp, Submission } from '../types';
import { iconPlaceholder } from '../lib/storage';
import { APP_NAME, ECOSYSTEM_NAME, STOREAPP_PACKAGE } from '../lib/config';

export const CATEGORIES: Category[] = [
  { slug: 'communication', name: 'Communication', kind: 'both', icon: 'MessageCircle' },
  { slug: 'tools', name: 'Tools & Utilities', kind: 'app', icon: 'Wrench' },
  { slug: 'browser', name: 'Browsers', kind: 'app', icon: 'Globe' },
  { slug: 'productivity', name: 'Productivity', kind: 'app', icon: 'CheckSquare' },
  { slug: 'education', name: 'Education', kind: 'app', icon: 'GraduationCap' },
  { slug: 'entertainment', name: 'Entertainment', kind: 'both', icon: 'PlayCircle' },
  { slug: 'music', name: 'Music & Audio', kind: 'app', icon: 'Music' },
  { slug: 'photo', name: 'Photography', kind: 'app', icon: 'Camera' },
  { slug: 'games-action', name: 'Action Games', kind: 'game', icon: 'Swords' },
  { slug: 'games-puzzle', name: 'Puzzle Games', kind: 'game', icon: 'Puzzle' },
  { slug: 'games-racing', name: 'Racing Games', kind: 'game', icon: 'Car' },
  { slug: 'finance', name: 'Finance', kind: 'app', icon: 'Wallet' },
];

const shot = (seed: string) => `https://picsum.photos/seed/${seed}/360/640`;
const now = new Date().toISOString();

function app(
  partial: Partial<StoreApp> & Pick<StoreApp, 'id' | 'packageName' | 'name' | 'category' | 'iconColor'>,
): StoreApp {
  return {
    developerId: 'dev-gothwad',
    developerName: 'Gothwad Tech',
    developerVerified: true,
    kind: 'app',
    status: 'published',
    shortDesc: '',
    fullDesc: '',
    iconUrl: iconPlaceholder(partial.name, partial.iconColor),
    screenshots: [shot(partial.id + '1'), shot(partial.id + '2'), shot(partial.id + '3')],
    tags: [],
    supportEmail: 'support@gothwadtech.com',
    ratingAvg: 4.2,
    ratingCount: 1200,
    downloadsCount: 50_000,
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

export const SEED_APPS: StoreApp[] = [
  app({
    id: 'app-browser', packageName: 'com.gothwad.browser', name: 'Gothwad Browser',
    category: 'browser', iconColor: '#2563eb', featured: 'hero',
    shortDesc: 'Fastest, securest, lightweight browser for Phones & TVs',
    fullDesc:
      'Gothwad Browser is a fast, secure and lightweight browser made for Android phones and TVs. Advanced features for physical keyboard and mouse on Android TV, best TV remote support, inbuilt file manager, notepad and clipboard manager. Made in India with love by Gothwad Tech.',
    tags: ['browser', 'tv', 'lightweight'], ratingAvg: 4.5, ratingCount: 18_400, downloadsCount: 500_000,
  }),
  app({
    id: 'app-manager', packageName: 'com.gothwad.manager', name: 'Gothwad Manager',
    category: 'tools', iconColor: '#059669', featured: 'editors',
    shortDesc: 'All-in-one file manager - simple, small, fast',
    fullDesc:
      'Gothwad Manager is an all-in-one file management tool for Android. Simple, small, fast and efficient file explorer with folder sizes across storages. Designed for phones, tablets and Android TV.',
    tags: ['files', 'explorer'], ratingAvg: 4.4, ratingCount: 9_800, downloadsCount: 250_000,
  }),
  app({
    id: 'app-launcher', packageName: 'com.gothwad.launcher', name: 'Gothwad TV Launcher',
    category: 'tools', iconColor: '#7c3aed',
    shortDesc: 'Simple looking, advanced TV launcher - ads free',
    fullDesc:
      'Gothwad TV Launcher is made for Android TVs and tablets. Simple looking but advanced features, notifications, recent apps, completely ads free and suitable for all devices.',
    tags: ['launcher', 'tv'], ratingAvg: 4.3, ratingCount: 6_200, downloadsCount: 100_000,
  }),
  app({
    id: 'app-internet', packageName: 'com.gothwad.internet', name: 'Gothwad Internet',
    category: 'browser', iconColor: '#ea580c',
    shortDesc: 'Lightweight browser for Android phones',
    fullDesc: 'Gothwad Internet is a lightweight browser for Android phones - tiny size, fast pages, low RAM usage for budget devices.',
    tags: ['browser', 'lite'], ratingAvg: 4.1, ratingCount: 4_300, downloadsCount: 100_000,
  }),
  app({
    id: 'app-store', packageName: STOREAPP_PACKAGE, name: APP_NAME,
    category: 'tools', iconUrl: '/assets/icon-512.png', iconColor: '#0284c7', featured: 'top_new',
    shortDesc: `Discover and download ${ECOSYSTEM_NAME} ecosystem apps`,
    fullDesc:
      `${APP_NAME} is the official app store of the ${ECOSYSTEM_NAME} ecosystem. Browse apps and games, read reviews, and download APKs directly - linked with your ${ECOSYSTEM_NAME} Account.`,
    tags: ['store', 'apps'], ratingAvg: 4.6, ratingCount: 2_100, downloadsCount: 25_000,
  }),
  app({
    id: 'app-prepmate', packageName: 'com.gothwad.prepmate', name: 'PrepMate',
    category: 'education', iconColor: '#db2777', kind: 'app',
    shortDesc: 'Exam preparation made simple',
    fullDesc: 'PrepMate helps students prepare for exams with organised notes, practice sets and progress tracking.',
    tags: ['study', 'exams'], ratingAvg: 4.4, ratingCount: 3_700, downloadsCount: 50_000,
  }),
  app({
    id: 'app-turborace', packageName: 'com.indie.turborace', name: 'Turbo Race 3D',
    category: 'games-racing', iconColor: '#dc2626', kind: 'game', featured: 'hero',
    developerId: 'dev-indie', developerName: 'IndieWorks Studio', developerVerified: false,
    shortDesc: 'High speed arcade racing - drift, boost, win',
    fullDesc: 'Turbo Race 3D is an arcade racing game with 40+ tracks, custom cars and offline play. Drift through Indian highways and mountain roads.',
    tags: ['racing', 'offline', '3d'], ratingAvg: 4.2, ratingCount: 42_000, downloadsCount: 1_000_000,
  }),
  app({
    id: 'app-puzzle', packageName: 'com.indie.mindmaze', name: 'Mind Maze',
    category: 'games-puzzle', iconColor: '#0891b2', kind: 'game',
    developerId: 'dev-indie', developerName: 'IndieWorks Studio', developerVerified: false,
    shortDesc: 'Brain training puzzle mazes - 500 levels',
    fullDesc: 'Mind Maze trains your brain with 500 hand-crafted puzzle mazes. Daily challenges, no forced ads, plays fully offline.',
    tags: ['puzzle', 'brain'], ratingAvg: 4.7, ratingCount: 15_600, downloadsCount: 500_000,
  }),
];

export const SEED_REVIEWS: Review[] = [
  { id: 'r1', appId: 'app-browser', userId: 'u2', username: 'rahul_dev', rating: 5, body: 'The smoothest browser I have used on a TV with a remote. The built-in file manager is incredibly useful!', createdAt: now },
  { id: 'r2', appId: 'app-browser', userId: 'u3', username: 'sneha.k', rating: 4, body: 'Very lightweight and fast even on my older phone. One star off because dark mode occasionally changes site colors.', createdAt: now },
  { id: 'r3', appId: 'app-store', userId: 'u4', username: 'amit_tv', rating: 5, body: 'All Gothwad apps in one place, with direct APK downloads. Excellent!', createdAt: now },
  { id: 'r4', appId: 'app-turborace', userId: 'u5', username: 'gamer_veer', rating: 4, body: 'Amazing graphics for its size. Add multiplayer and it is an easy five stars.', developerReply: 'Thanks, Veer! Multiplayer is coming in the next update.', developerReplyAt: now, createdAt: now },
];

export const SEED_SUBMISSIONS: Submission[] = [
  {
    id: 'sub1', appId: 'app-new-chat', appName: 'GrixChat Lite', packageName: 'com.gothwad.grixchat.lite',
    developerName: 'Gothwad Tech', releaseId: 'rel-new-1', versionName: '1.2.0', versionCode: 12,
    apkProvider: 'github', apkSizeBytes: 18 * 1024 * 1024, status: 'pending', submittedAt: now,
  },
  {
    id: 'sub2', appId: 'app-turborace', appName: 'Turbo Race 3D', packageName: 'com.indie.turborace',
    developerName: 'IndieWorks Studio', releaseId: 'rel-tr-9', versionName: '2.0.1', versionCode: 21,
    apkProvider: 'github', apkSizeBytes: 32 * 1024 * 1024, status: 'pending', submittedAt: now,
  },
];

export const SEED_REPORTS: ReportItem[] = [
  { id: 'rep1', appId: 'app-puzzle', appName: 'Mind Maze', reporter: 'rahul_dev', reason: 'Misleading listing', details: 'The level shown in the screenshots does not appear in the game.', status: 'open', createdAt: now },
];
