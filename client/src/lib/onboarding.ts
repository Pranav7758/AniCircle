export const ONBOARDING_VERSION = 1;
export const ONBOARDING_CACHE_KEY = "anicircle-onboarding-state-v1";

export type OnboardingStatus = "not_started" | "skipped" | "completed";
export type OnboardingTab = "watch" | "list" | "radar" | "ranking" | "analytics" | "friends" | "discover";

export interface OnboardingState {
  status: OnboardingStatus;
  onboardingVersion: number;
  completedAt?: string | null;
  skippedAt?: string | null;
}

export interface OnboardingStep {
  id: string;
  tab: OnboardingTab;
  targetTestId: string;
  title: string;
  description: string;
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "watch",
    tab: "watch",
    targetTestId: "tab-watch",
    title: "Watch Anime",
    description: "Start here to stream episodes and track progress quickly.",
  },
  {
    id: "list",
    tab: "list",
    targetTestId: "input-search",
    title: "Manage Your List",
    description: "Search, filter, sort, and keep your anime library organized.",
  },
  {
    id: "radar",
    tab: "radar",
    targetTestId: "tab-radar",
    title: "Sequel Radar",
    description: "Find upcoming seasons for shows you already completed.",
  },
  {
    id: "ranking",
    tab: "ranking",
    targetTestId: "tab-ranking",
    title: "Rankings",
    description: "Compare ratings and see top anime at a glance.",
  },
  {
    id: "analytics",
    tab: "analytics",
    targetTestId: "tab-analytics",
    title: "Otaku Analytics",
    description: "View your watch habits, genre stats, and deep insights.",
  },
  {
    id: "friends",
    tab: "friends",
    targetTestId: "tab-friends",
    title: "Friends Activity",
    description: "See what friends are watching and compare your lists.",
  },
  {
    id: "discover",
    tab: "discover",
    targetTestId: "tab-discover",
    title: "Discover New Anime",
    description: "Explore trending, seasonal, and recommended anime fast.",
  },
  {
    id: "theme",
    tab: "list",
    targetTestId: "button-theme-picker",
    title: "Personalize Theme",
    description: "Pick your style and colors anytime from the theme button.",
  },
];

export function readOnboardingCache(): OnboardingState | null {
  try {
    const raw = localStorage.getItem(ONBOARDING_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as OnboardingState;
  } catch {
    return null;
  }
}

export function writeOnboardingCache(state: OnboardingState): void {
  try {
    localStorage.setItem(ONBOARDING_CACHE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage failures
  }
}
