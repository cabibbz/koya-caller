/**
 * Koya Caller - Sentiment Detection and Response Framework
 * Enhanced Prompt System - Phase 3
 *
 * Provides sentiment detection indicators and response strategies
 * to help the AI recognize and appropriately respond to caller emotions.
 */

import type { Personality } from "./error-templates";

// =============================================================================
// Types
// =============================================================================

export type SentimentLevel =
  | "pleased"
  | "neutral"
  | "confused"
  | "impatient"
  | "frustrated"
  | "upset"
  | "angry";

export type SentimentCategory = "positive" | "neutral" | "negative";

export interface SentimentIndicator {
  keywords: string[];
  phrases: string[];
  vocalCues: string[];
}

export interface SentimentResponse {
  acknowledgment: string;
  strategy: string;
  example: string;
}

export interface SentimentConfig {
  indicators: SentimentIndicator;
  category: SentimentCategory;
  escalationThreshold: number; // 1-5, higher = more likely to escalate
  responses: Record<Personality, SentimentResponse>;
}

export interface EscalationTrigger {
  condition: string;
  action: string;
}

// =============================================================================
// Sentiment Detection Indicators
// =============================================================================

export const SENTIMENT_INDICATORS: Record<SentimentLevel, SentimentConfig> = {
  pleased: {
    indicators: {
      keywords: [
        "thank you", "thanks", "great", "wonderful", "perfect", "excellent",
        "appreciate", "helpful", "fantastic", "amazing", "awesome"
      ],
      phrases: [
        "that's exactly what I needed",
        "you've been so helpful",
        "this is great",
        "I really appreciate it",
        "that works perfectly",
        "thank you so much"
      ],
      vocalCues: [
        "upbeat tone",
        "enthusiastic",
        "relieved sounding",
        "grateful tone"
      ]
    },
    category: "positive",
    escalationThreshold: 1, // No escalation needed
    responses: {
      professional: {
        acknowledgment: "I'm glad I could assist you.",
        strategy: "Maintain positive momentum and ensure they have everything they need.",
        example: "I'm pleased I could help with that. Is there anything else I can assist you with today?"
      },
      friendly: {
        acknowledgment: "That's wonderful to hear!",
        strategy: "Match their positive energy while wrapping up professionally.",
        example: "So glad I could help! Is there anything else you need before we finish up?"
      },
      casual: {
        acknowledgment: "Awesome, happy to help!",
        strategy: "Keep the good vibes going.",
        example: "Great! Anything else I can do for you?"
      }
    }
  },

  neutral: {
    indicators: {
      keywords: [
        "okay", "sure", "fine", "alright", "I see", "understood"
      ],
      phrases: [
        "that works",
        "sounds good",
        "I understand",
        "got it",
        "makes sense"
      ],
      vocalCues: [
        "calm tone",
        "even-paced",
        "matter-of-fact"
      ]
    },
    category: "neutral",
    escalationThreshold: 1,
    responses: {
      professional: {
        acknowledgment: "Certainly.",
        strategy: "Proceed efficiently with the task at hand.",
        example: "I'll proceed with that now. One moment please."
      },
      friendly: {
        acknowledgment: "Perfect!",
        strategy: "Stay warm and keep things moving smoothly.",
        example: "Great, let me take care of that for you!"
      },
      casual: {
        acknowledgment: "Cool.",
        strategy: "Keep it easy and efficient.",
        example: "Got it, let me get that done for you."
      }
    }
  },

  confused: {
    indicators: {
      keywords: [
        "what", "huh", "confused", "don't understand", "unclear",
        "lost", "wait", "I'm not sure"
      ],
      phrases: [
        "I don't follow",
        "what do you mean",
        "can you explain",
        "I'm not getting this",
        "that doesn't make sense",
        "wait, what?",
        "I'm a little lost here"
      ],
      vocalCues: [
        "uncertain tone",
        "questioning inflection",
        "hesitant",
        "slow speech"
      ]
    },
    category: "neutral",
    escalationThreshold: 2,
    responses: {
      professional: {
        acknowledgment: "Let me clarify that for you.",
        strategy: "Slow down and explain more clearly. Use simpler language.",
        example: "I apologize for any confusion. Let me explain this more clearly. What I mean is..."
      },
      friendly: {
        acknowledgment: "Sorry about that confusion!",
        strategy: "Be patient and rephrase in a different way.",
        example: "Oops, let me say that differently! What I'm trying to say is..."
      },
      casual: {
        acknowledgment: "My bad, let me be clearer.",
        strategy: "Keep it simple and straightforward.",
        example: "Sorry, that was confusing. Basically what I mean is..."
      }
    }
  },

  impatient: {
    indicators: {
      keywords: [
        "hurry", "quickly", "fast", "already", "waiting",
        "how long", "come on", "just"
      ],
      phrases: [
        "I don't have all day",
        "can we speed this up",
        "I've been waiting",
        "just tell me",
        "get to the point",
        "I'm in a rush",
        "how much longer"
      ],
      vocalCues: [
        "rapid speech",
        "sighing",
        "interrupting",
        "terse responses"
      ]
    },
    category: "negative",
    escalationThreshold: 3,
    responses: {
      professional: {
        acknowledgment: "I understand you're pressed for time.",
        strategy: "Be concise and efficient. Skip pleasantries.",
        example: "I understand you're busy. Let me get this done quickly. I just need your [specific info] and we're set."
      },
      friendly: {
        acknowledgment: "I hear you, let's get this done!",
        strategy: "Pick up the pace while staying warm.",
        example: "Totally get it! Let's speed this up. Just need your [info] and you're good to go!"
      },
      casual: {
        acknowledgment: "Got it, I'll be quick.",
        strategy: "Cut to the chase.",
        example: "No problem, let's make this fast. Just need [info] and you're done."
      }
    }
  },

  frustrated: {
    indicators: {
      keywords: [
        "frustrating", "annoying", "ridiculous", "again", "still",
        "issue", "problem", "never works", "always"
      ],
      phrases: [
        "this is frustrating",
        "I've tried this before",
        "this keeps happening",
        "why doesn't this work",
        "I've called multiple times",
        "no one can help",
        "this is ridiculous"
      ],
      vocalCues: [
        "exasperated tone",
        "raised voice",
        "sighing heavily",
        "talking faster"
      ]
    },
    category: "negative",
    escalationThreshold: 4,
    responses: {
      professional: {
        acknowledgment: "I completely understand your frustration, and I apologize for the difficulty you've experienced.",
        strategy: "Validate their feelings first. Take ownership. Focus on resolution.",
        example: "I'm truly sorry you've had this experience. Let me take personal responsibility for resolving this for you today. Here's what I'm going to do..."
      },
      friendly: {
        acknowledgment: "I totally get it, and I'm so sorry you're dealing with this.",
        strategy: "Show genuine empathy. Make it personal.",
        example: "Ugh, that sounds really frustrating and I'm sorry! Let me see what I can do to make this right for you."
      },
      casual: {
        acknowledgment: "Yeah, that's rough. I'm sorry about that.",
        strategy: "Be genuine and solution-focused.",
        example: "I hear you, that's annoying. Let me see what I can do to fix this for you."
      }
    }
  },

  upset: {
    indicators: {
      keywords: [
        "upset", "angry", "unacceptable", "complaint", "manager",
        "supervisor", "wrong", "terrible", "horrible", "worst"
      ],
      phrases: [
        "I want to speak to someone else",
        "this is unacceptable",
        "I'm very upset",
        "I want to file a complaint",
        "this is the worst",
        "you people",
        "I'm done with this"
      ],
      vocalCues: [
        "raised voice",
        "angry tone",
        "speaking very quickly",
        "clipped responses"
      ]
    },
    category: "negative",
    escalationThreshold: 5,
    responses: {
      professional: {
        acknowledgment: "I sincerely apologize. Your concerns are completely valid, and I want to make this right.",
        strategy: "Deep acknowledgment. Offer escalation. Focus entirely on resolution.",
        example: "I am truly sorry for this experience. You have every right to be upset. I would like to personally ensure this is resolved. I can also connect you with a manager if you prefer."
      },
      friendly: {
        acknowledgment: "I'm really, really sorry. I understand why you're upset and I don't blame you at all.",
        strategy: "Show deep empathy. Offer help and escalation options.",
        example: "I'm so sorry this happened. You have every right to feel this way. Let me do everything I can to fix this, or I can get my manager on the line - whatever would help most."
      },
      casual: {
        acknowledgment: "I'm really sorry. I totally understand why you're upset.",
        strategy: "Be genuine and offer solutions immediately.",
        example: "I hear you, and I'm sorry. Let me try to make this right. Would you like me to get someone else on the line who might be able to help more?"
      }
    }
  },

  angry: {
    indicators: {
      keywords: [
        "furious", "outraged", "sue", "lawyer", "unbelievable",
        "never again", "cancel", "report", "BBB"
      ],
      phrases: [
        "I'm going to sue",
        "I want my money back",
        "I'm reporting you",
        "I'm canceling everything",
        "this is fraud",
        "I'm calling my lawyer",
        "you'll hear from my attorney"
      ],
      vocalCues: [
        "yelling",
        "very loud",
        "aggressive tone",
        "threatening"
      ]
    },
    category: "negative",
    escalationThreshold: 5,
    responses: {
      professional: {
        acknowledgment: "I hear you, and I deeply apologize. Your anger is completely understandable given what you've described.",
        strategy: "Immediate de-escalation. Offer to connect with management. Document everything.",
        example: "I understand you're very upset, and I want you to know your concerns are being heard. I'm going to get a manager for you right now who can address this directly. I'm also documenting everything you've told me."
      },
      friendly: {
        acknowledgment: "I'm so, so sorry. What you've been through sounds terrible, and I completely understand your anger.",
        strategy: "Maximum empathy. Immediate escalation offer.",
        example: "I hear how upset you are, and honestly, I don't blame you. Let me get my manager on the line right now - they can really help with this situation."
      },
      casual: {
        acknowledgment: "I get it, that's really bad. I'm sorry.",
        strategy: "Stay calm. Offer immediate escalation.",
        example: "I totally understand. Let me get someone with more authority to help you out right away."
      }
    }
  }
};

// =============================================================================
// Spanish Sentiment Indicators
// =============================================================================

export const SENTIMENT_INDICATORS_SPANISH: Record<SentimentLevel, Partial<SentimentConfig>> = {
  pleased: {
    indicators: {
      keywords: [
        "gracias", "perfecto", "excelente", "maravilloso", "genial",
        "fantastico", "increible", "estupendo"
      ],
      phrases: [
        "muchas gracias",
        "es exactamente lo que necesitaba",
        "me ha ayudado mucho",
        "que bueno",
        "se lo agradezco"
      ],
      vocalCues: ["tono alegre", "entusiasta", "aliviado"]
    }
  },
  neutral: {
    indicators: {
      keywords: [
        "bien", "esta bien", "de acuerdo", "entiendo", "claro"
      ],
      phrases: [
        "me parece bien",
        "esta bien",
        "entiendo",
        "de acuerdo"
      ],
      vocalCues: ["tono calmado", "neutral"]
    }
  },
  confused: {
    indicators: {
      keywords: [
        "que", "como", "no entiendo", "confundido", "perdido"
      ],
      phrases: [
        "no entiendo",
        "que quiere decir",
        "puede explicar",
        "estoy confundido",
        "no me queda claro"
      ],
      vocalCues: ["tono incierto", "dudoso"]
    }
  },
  impatient: {
    indicators: {
      keywords: [
        "rapido", "pronto", "ya", "esperando", "apurese"
      ],
      phrases: [
        "tengo prisa",
        "cuanto tiempo mas",
        "ya he esperado mucho",
        "puede apurarse"
      ],
      vocalCues: ["habla rapida", "tono impaciente"]
    }
  },
  frustrated: {
    indicators: {
      keywords: [
        "frustrante", "molesto", "otra vez", "problema", "nunca"
      ],
      phrases: [
        "esto es frustrante",
        "ya he llamado antes",
        "sigue pasando",
        "nadie me ayuda"
      ],
      vocalCues: ["tono exasperado", "voz elevada"]
    }
  },
  upset: {
    indicators: {
      keywords: [
        "molesto", "enojado", "inaceptable", "queja", "gerente"
      ],
      phrases: [
        "quiero hablar con alguien mas",
        "esto es inaceptable",
        "estoy muy molesto",
        "quiero poner una queja"
      ],
      vocalCues: ["voz elevada", "tono enojado"]
    }
  },
  angry: {
    indicators: {
      keywords: [
        "furioso", "indignado", "abogado", "demanda", "cancelar"
      ],
      phrases: [
        "voy a demandar",
        "quiero mi dinero",
        "voy a reportar",
        "voy a cancelar todo"
      ],
      vocalCues: ["gritando", "muy fuerte", "agresivo"]
    }
  }
};

// =============================================================================
// Escalation Triggers
// =============================================================================

export const ESCALATION_TRIGGERS: EscalationTrigger[] = [
  {
    condition: "Caller requests to speak with a manager or supervisor",
    action: "Immediately offer to transfer or take a message for callback"
  },
  {
    condition: "Caller mentions legal action (lawyer, sue, attorney)",
    action: "Express understanding, document concerns, and escalate to management"
  },
  {
    condition: "Caller has expressed frustration 3+ times in the conversation",
    action: "Proactively offer to connect them with someone who may have more options"
  },
  {
    condition: "Caller threatens to cancel service or leave negative review",
    action: "Acknowledge their frustration and offer to find a resolution or escalate"
  },
  {
    condition: "Caller uses profanity or becomes verbally aggressive",
    action: "Stay calm, acknowledge feelings, and offer to connect with management"
  },
  {
    condition: "Issue has persisted across multiple calls",
    action: "Apologize for the ongoing issue and ensure a supervisor follows up"
  }
];

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get sentiment configuration
 */
export function getSentimentConfig(level: SentimentLevel): SentimentConfig {
  return SENTIMENT_INDICATORS[level];
}

/**
 * Get sentiment response for a specific personality
 */
export function getSentimentResponse(
  level: SentimentLevel,
  personality: Personality
): SentimentResponse {
  return SENTIMENT_INDICATORS[level].responses[personality];
}

/**
 * Check if a sentiment level requires potential escalation
 */
export function shouldConsiderEscalation(level: SentimentLevel): boolean {
  return SENTIMENT_INDICATORS[level].escalationThreshold >= 4;
}

/**
 * Get the category for a sentiment level
 */
export function getSentimentCategory(level: SentimentLevel): SentimentCategory {
  return SENTIMENT_INDICATORS[level].category;
}

/**
 * Generate sentiment detection instructions for the AI prompt
 */
export function generateSentimentInstructions(
  personality: Personality,
  language: "en" | "es" = "en"
): string {
  const header = language === "es"
    ? "## Deteccion de Sentimiento del Llamante\n\n"
    : "## Caller Sentiment Detection\n\n";

  const intro = language === "es"
    ? "Presta atencion al tono emocional del llamante y ajusta tu respuesta en consecuencia:\n\n"
    : "Pay attention to the caller's emotional tone and adjust your response accordingly:\n\n";

  let instructions = header + intro;

  // Add each sentiment level
  const sentimentLabels: Record<SentimentLevel, { en: string; es: string }> = {
    pleased: { en: "Happy/Satisfied", es: "Contento/Satisfecho" },
    neutral: { en: "Neutral", es: "Neutral" },
    confused: { en: "Confused", es: "Confundido" },
    impatient: { en: "Impatient/Rushed", es: "Impaciente/Apurado" },
    frustrated: { en: "Frustrated", es: "Frustrado" },
    upset: { en: "Upset", es: "Molesto" },
    angry: { en: "Angry", es: "Enojado" }
  };

  for (const [level, config] of Object.entries(SENTIMENT_INDICATORS)) {
    const sentimentLevel = level as SentimentLevel;
    const label = language === "es"
      ? sentimentLabels[sentimentLevel].es
      : sentimentLabels[sentimentLevel].en;

    const response = config.responses[personality];
    const indicators = config.indicators;

    instructions += `### ${label}\n`;

    const detectLabel = language === "es" ? "Detectar" : "Detect";
    const respondLabel = language === "es" ? "Responder" : "Respond";

    instructions += `**${detectLabel}**: `;
    instructions += `Keywords like "${indicators.keywords.slice(0, 4).join('", "')}"`;
    instructions += ` or phrases like "${indicators.phrases[0]}"\n`;

    instructions += `**${respondLabel}**: ${response.strategy}\n`;
    instructions += `*Example*: "${response.example}"\n\n`;
  }

  // Add escalation triggers
  const escalationHeader = language === "es"
    ? "### Disparadores de Escalacion\n"
    : "### Escalation Triggers\n";
  instructions += escalationHeader;

  const escalationIntro = language === "es"
    ? "Ofrece transferir a un gerente cuando:\n"
    : "Offer to transfer to a manager when:\n";
  instructions += escalationIntro;

  for (const trigger of ESCALATION_TRIGGERS) {
    instructions += `- ${trigger.condition}\n`;
  }

  instructions += "\n";

  // Add de-escalation tips
  const deescalationHeader = language === "es"
    ? "### Consejos de De-escalacion\n"
    : "### De-escalation Tips\n";
  instructions += deescalationHeader;

  const tips = language === "es"
    ? [
        "Siempre valida los sentimientos del llamante primero",
        "Nunca discutas ni te pongas a la defensiva",
        "Usa el nombre del llamante si lo sabes",
        "Ofrece soluciones concretas, no solo disculpas",
        "Si la situacion escala, manten la calma y ofrece transferir"
      ]
    : [
        "Always validate the caller's feelings first",
        "Never argue or become defensive",
        "Use the caller's name if you know it",
        "Offer concrete solutions, not just apologies",
        "If the situation escalates, stay calm and offer to transfer"
      ];

  for (const tip of tips) {
    instructions += `- ${tip}\n`;
  }

  return instructions;
}

/**
 * Get acknowledgment phrase for a sentiment level
 */
export function getAcknowledgment(
  level: SentimentLevel,
  personality: Personality,
  _language: "en" | "es" = "en"
): string {
  // Note: Spanish translations would need to be added to SENTIMENT_INDICATORS
  // For now, returns English
  return SENTIMENT_INDICATORS[level].responses[personality].acknowledgment;
}

/**
 * Analyze text for sentiment indicators (basic implementation)
 * Note: In production, this would be enhanced with more sophisticated NLP
 */
export function detectSentimentLevel(text: string): SentimentLevel {
  const lowerText = text.toLowerCase();
  let highestMatch: { level: SentimentLevel; score: number } = {
    level: "neutral",
    score: 0
  };

  for (const [level, config] of Object.entries(SENTIMENT_INDICATORS)) {
    let score = 0;

    // Check keywords
    for (const keyword of config.indicators.keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        score += 1;
      }
    }

    // Check phrases (weighted higher)
    for (const phrase of config.indicators.phrases) {
      if (lowerText.includes(phrase.toLowerCase())) {
        score += 2;
      }
    }

    if (score > highestMatch.score) {
      highestMatch = { level: level as SentimentLevel, score };
    }
  }

  return highestMatch.level;
}

/**
 * Get all negative sentiment levels for tracking
 */
export function getNegativeSentimentLevels(): SentimentLevel[] {
  return Object.entries(SENTIMENT_INDICATORS)
    .filter(([_, config]) => config.category === "negative")
    .map(([level, _]) => level as SentimentLevel);
}

/**
 * Generate a summary of sentiment handling for the prompt config
 */
export function getSentimentHandlingSummary(): string {
  return `
The AI will detect caller sentiment and adjust responses accordingly:
- Positive callers: Matched enthusiasm, efficient service
- Confused callers: Patient clarification, simpler explanations
- Impatient callers: Concise responses, faster pacing
- Frustrated callers: Validation, ownership, solution focus
- Upset/Angry callers: Deep empathy, escalation offers, documentation
`;
}
