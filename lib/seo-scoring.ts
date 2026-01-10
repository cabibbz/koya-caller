/**
 * SEO Scoring Utility
 * Calculates real-time SEO scores for blog content
 */

export interface SEOScore {
  overall: number;
  breakdown: {
    titleScore: number;
    metaDescriptionScore: number;
    keywordDensity: number;
    headingsScore: number;
    readabilityScore: number;
    contentLength: number;
  };
  suggestions: string[];
}

export interface SEOInput {
  title: string;
  metaTitle?: string;
  metaDescription?: string;
  content: string;
  targetKeyword?: string;
}

// Calculate reading level (Flesch-Kincaid)
function calculateReadability(text: string): number {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const syllables = words.reduce((count, word) => count + countSyllables(word), 0);

  if (sentences.length === 0 || words.length === 0) return 0;

  const avgSentenceLength = words.length / sentences.length;
  const avgSyllablesPerWord = syllables / words.length;

  // Flesch Reading Ease
  const fleschScore = 206.835 - (1.015 * avgSentenceLength) - (84.6 * avgSyllablesPerWord);

  // Normalize to 0-100
  return Math.max(0, Math.min(100, fleschScore));
}

function countSyllables(word: string): number {
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (word.length <= 3) return 1;

  const vowels = word.match(/[aeiouy]+/g);
  let count = vowels ? vowels.length : 1;

  // Subtract silent e
  if (word.endsWith('e')) count--;

  return Math.max(1, count);
}

// Count keyword occurrences
function getKeywordDensity(content: string, keyword: string): number {
  if (!keyword) return 0;

  const words = content.toLowerCase().split(/\s+/);
  const keywordLower = keyword.toLowerCase();
  const keywordWords = keywordLower.split(/\s+/);

  let occurrences = 0;
  const contentLower = content.toLowerCase();

  // Count exact phrase matches
  const regex = new RegExp(keywordLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  const matches = contentLower.match(regex);
  occurrences = matches ? matches.length : 0;

  // Calculate density as percentage
  const totalWords = words.length;
  if (totalWords === 0) return 0;

  return (occurrences * keywordWords.length / totalWords) * 100;
}

// Check heading structure
function analyzeHeadings(content: string): { score: number; h2Count: number; h3Count: number } {
  const h2Matches = content.match(/^##\s+/gm);
  const h3Matches = content.match(/^###\s+/gm);

  const h2Count = h2Matches ? h2Matches.length : 0;
  const h3Count = h3Matches ? h3Matches.length : 0;

  let score = 0;

  // Good: 2-6 H2 headings
  if (h2Count >= 2 && h2Count <= 6) score += 50;
  else if (h2Count >= 1) score += 25;

  // Good: Has H3 subheadings
  if (h3Count >= 1) score += 30;

  // Good: H3 follows H2 (basic hierarchy check)
  if (h2Count > 0 && h3Count > 0) score += 20;

  return { score, h2Count, h3Count };
}

export function calculateSEOScore(input: SEOInput): SEOScore {
  const suggestions: string[] = [];

  // Title Score (0-100)
  let titleScore = 0;
  const titleLength = input.title.length;

  if (titleLength >= 30 && titleLength <= 60) {
    titleScore = 100;
  } else if (titleLength >= 20 && titleLength <= 70) {
    titleScore = 70;
  } else if (titleLength > 0) {
    titleScore = 40;
  }

  if (input.targetKeyword && input.title.toLowerCase().includes(input.targetKeyword.toLowerCase())) {
    titleScore = Math.min(100, titleScore + 20);
  } else if (input.targetKeyword) {
    suggestions.push("Add target keyword to title");
  }

  if (titleLength < 30) suggestions.push("Title is too short (aim for 30-60 characters)");
  if (titleLength > 60) suggestions.push("Title is too long (aim for 30-60 characters)");

  // Meta Description Score (0-100)
  let metaDescriptionScore = 0;
  const metaLength = (input.metaDescription || "").length;

  if (metaLength >= 120 && metaLength <= 160) {
    metaDescriptionScore = 100;
  } else if (metaLength >= 100 && metaLength <= 170) {
    metaDescriptionScore = 70;
  } else if (metaLength > 0) {
    metaDescriptionScore = 40;
  }

  if (!input.metaDescription) {
    suggestions.push("Add a meta description");
  } else if (metaLength < 120) {
    suggestions.push("Meta description is too short (aim for 120-160 characters)");
  } else if (metaLength > 160) {
    suggestions.push("Meta description is too long (aim for 120-160 characters)");
  }

  // Keyword Density (0-100)
  const density = getKeywordDensity(input.content, input.targetKeyword || "");
  let keywordDensity = 0;

  if (density >= 1 && density <= 2.5) {
    keywordDensity = 100;
  } else if (density >= 0.5 && density <= 3) {
    keywordDensity = 70;
  } else if (density > 0) {
    keywordDensity = 40;
  }

  if (input.targetKeyword) {
    if (density < 0.5) suggestions.push("Use target keyword more often (aim for 1-2.5% density)");
    if (density > 3) suggestions.push("Reduce keyword usage to avoid over-optimization");
  }

  // Headings Score (0-100)
  const headingsAnalysis = analyzeHeadings(input.content);
  const headingsScore = headingsAnalysis.score;

  if (headingsAnalysis.h2Count < 2) suggestions.push("Add more H2 headings to structure content");
  if (headingsAnalysis.h3Count === 0) suggestions.push("Add H3 subheadings for better hierarchy");

  // Readability Score (0-100)
  const readabilityScore = calculateReadability(input.content);

  if (readabilityScore < 30) suggestions.push("Content may be too complex - simplify sentences");
  if (readabilityScore > 80) suggestions.push("Content may be too simple - add more detail");

  // Content Length Score (0-100)
  const wordCount = input.content.split(/\s+/).filter(w => w.length > 0).length;
  let contentLength = 0;

  if (wordCount >= 1500 && wordCount <= 2500) {
    contentLength = 100;
  } else if (wordCount >= 1000 && wordCount <= 3000) {
    contentLength = 80;
  } else if (wordCount >= 500) {
    contentLength = 60;
  } else if (wordCount >= 300) {
    contentLength = 40;
  } else {
    contentLength = 20;
  }

  if (wordCount < 500) suggestions.push("Add more content (aim for 1000+ words for SEO)");
  if (wordCount > 3000) suggestions.push("Consider breaking into multiple articles");

  // Calculate overall score (weighted average)
  const overall = Math.round(
    (titleScore * 0.2) +
    (metaDescriptionScore * 0.15) +
    (keywordDensity * 0.2) +
    (headingsScore * 0.15) +
    (readabilityScore * 0.15) +
    (contentLength * 0.15)
  );

  return {
    overall,
    breakdown: {
      titleScore,
      metaDescriptionScore,
      keywordDensity,
      headingsScore,
      readabilityScore,
      contentLength,
    },
    suggestions: suggestions.slice(0, 5), // Top 5 suggestions
  };
}

// Get score color based on value
export function getScoreColor(score: number): string {
  if (score >= 80) return "text-emerald-500";
  if (score >= 60) return "text-amber-500";
  return "text-red-500";
}

export function getScoreBgColor(score: number): string {
  if (score >= 80) return "bg-emerald-500/10";
  if (score >= 60) return "bg-amber-500/10";
  return "bg-red-500/10";
}

export function getScoreLabel(score: number): string {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Fair";
  return "Needs Work";
}
