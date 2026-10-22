import type { LucideIcon } from "lucide-react";

export type Screen = "welcome" | "onboarding" | "auth" | "register" | "recover" | "profile" | "path" | "dashboard" | "map" | "activities" | "activity" | "progress" | "me" | "settings" | "help";
export type CategoryId = "langues" | "maths" | "decouverte" | "logique" | "creativite";
export type ActivityKind = "vocab" | "math" | "memory" | "paint" | "discover";
export type Band = "easy" | "medium" | "hard";

export type AgeGroup = "3-5" | "5-10";
export interface Profile { name: string; group: AgeGroup | null }
export interface Progress {
  levelStars: Record<number, number>;
  bonus: number;
  badges: string[];
  explored: CategoryId[];
  dailyDate: string | null;
  started: number[];
  /** Remote mode only: level ids the SERVER reports as unlocked. */
  unlocked?: number[];
  completedActivities?: number;
  lastActivity?: { title: string; levelId: number } | null;
}
export interface Level { id: number; title: string; sub: string; kind: ActivityKind; category: CategoryId; icon: LucideIcon; desc: string; activity: string }
export interface Category {
  id: CategoryId; title: string; desc: string; topics: string[]; icon: LucideIcon;
  card: string; chip: string; level: number;
}
export interface Badge { id: string; title: string; desc: string; icon: LucideIcon; tone: string }
export interface Option { id: string; label: string; icon?: LucideIcon; tone?: string }
export type Mood = "joyeux" | "hello" | "encourageant" | "curieux" | "motive" | "bravo" | "concentre" | "assis" | "lecture" | "salut" | "fete";
export interface Question { id?: string; prompt: string; sub?: string; options: Option[]; /** absent in remote mode: the server keeps the answers secret */ answer?: string }
export interface Prefs { audio?: boolean; language?: "fr" | "ar" }
export interface ChildDto { id: string; displayName: string; ageGroup: AgeGroup; preferences?: Prefs }
export interface UserDto { email: string; displayName: string | null; hasRecoveryCode: boolean }
export interface Persisted { screen: Screen; authed: boolean; profile: Profile | null; progress: Progress; levelId: number; token?: string | null; childId?: string | null; prefs?: Prefs }
