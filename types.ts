export interface Article {
  id: string;
  title: string;
  abstract: string;
  authors: string;
  pubDate: string;
  pubmedUrl: string;
  isFree?: boolean;
  translatedTitle?: string;
  translatedAbstract?: string;
  isTranslating?: boolean;
  translationError?: string;
  isSaving?: boolean;
  saveError?: string | null;
}