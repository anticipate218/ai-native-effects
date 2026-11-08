export const REPO = 'https://github.com/anticipate218/ai-native-effects';
export const SITE = 'https://anticipate218.github.io/ai-native-effects';
export const CDN = `${SITE}/cdn`;

export interface EffectMeta {
  id: string;
  tag: string;
  title: string;
  titleZh: string;
  series: string;
  summary: string;
  summaryZh: string;
  tech: string[];
  added: string;
  since: string;
  status: 'stable' | 'draft';
  preview?: string;
}
