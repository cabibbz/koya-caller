/**
 * Koya Caller - Personality-Aware Error Templates
 * Enhanced Prompt System - Phase 1
 *
 * Provides error messages that match the configured AI personality,
 * ensuring consistent tone even during error recovery scenarios.
 */

// =============================================================================
// Types
// =============================================================================

export type Personality = "professional" | "friendly" | "casual";

export type ErrorType =
  | "availability_check_failed"
  | "booking_failed"
  | "transfer_failed"
  | "sms_failed"
  | "message_save_failed"
  | "misheard_info"
  | "system_timeout"
  | "no_availability"
  | "invalid_date"
  | "invalid_time"
  | "missing_info"
  | "calendar_sync_failed";

export interface ErrorMessage {
  initial: string;
  followUp: string;
  recovery: string;
}

export interface ErrorTemplate {
  professional: ErrorMessage;
  friendly: ErrorMessage;
  casual: ErrorMessage;
}

export interface ErrorTemplateSpanish {
  professional: ErrorMessage;
  friendly: ErrorMessage;
  casual: ErrorMessage;
}

// =============================================================================
// English Error Templates
// =============================================================================

export const ERROR_TEMPLATES: Record<ErrorType, ErrorTemplate> = {
  availability_check_failed: {
    professional: {
      initial: "I apologize, but I'm experiencing difficulty accessing our scheduling system at the moment.",
      followUp: "Would you prefer to leave your contact information so a member of our team can call you back with available times?",
      recovery: "Alternatively, I can take a message and ensure someone reaches out to you promptly."
    },
    friendly: {
      initial: "Oops! I'm having a little trouble checking our calendar right now.",
      followUp: "Can I grab your info and have someone call you back with our available times?",
      recovery: "Or I can take down a message for you - whatever works best!"
    },
    casual: {
      initial: "Hmm, having some trouble pulling up the schedule right now.",
      followUp: "Want me to take your number and have someone get back to you?",
      recovery: "Or just leave a message and we'll sort it out."
    }
  },

  booking_failed: {
    professional: {
      initial: "I apologize, but I wasn't able to complete your booking at this time.",
      followUp: "I have all your information recorded. Shall I have someone call you to confirm the appointment manually?",
      recovery: "I can also check if there's another time slot that might work better."
    },
    friendly: {
      initial: "Oh no, something went wrong with the booking!",
      followUp: "Don't worry though - I've got your info. Want me to have someone call you back to get this sorted?",
      recovery: "Or we could try a different time if you'd like!"
    },
    casual: {
      initial: "Shoot, the booking didn't go through.",
      followUp: "I've got your details though. Want someone to call you back and finish this up?",
      recovery: "Or we could try another time slot."
    }
  },

  transfer_failed: {
    professional: {
      initial: "I apologize, but I'm unable to transfer your call at this moment.",
      followUp: "May I take a detailed message and have someone return your call as soon as possible?",
      recovery: "I can also schedule a callback at a time that's convenient for you."
    },
    friendly: {
      initial: "I'm sorry, I wasn't able to connect you this time.",
      followUp: "Can I take a message and make sure someone calls you back right away?",
      recovery: "Or if you'd prefer, I can set up a specific time for them to reach you."
    },
    casual: {
      initial: "Sorry, couldn't get you connected right now.",
      followUp: "Let me take a message and have them call you back. Sound good?",
      recovery: "Or I can set up a time for a callback if that works better."
    }
  },

  sms_failed: {
    professional: {
      initial: "I apologize, but I was unable to send the text message.",
      followUp: "Would you like me to try again, or would you prefer to receive this information via email?",
      recovery: "I can also read the information to you now if that would be helpful."
    },
    friendly: {
      initial: "Hmm, the text didn't go through for some reason.",
      followUp: "Want me to give it another try, or I can read you the info right now?",
      recovery: "Just let me know what works best for you!"
    },
    casual: {
      initial: "Text didn't send - technology, right?",
      followUp: "Should I try again or just tell you the info now?",
      recovery: "Whatever's easiest for you."
    }
  },

  message_save_failed: {
    professional: {
      initial: "I apologize, but I had difficulty saving your message.",
      followUp: "Could you please repeat that? I want to make sure I capture everything accurately.",
      recovery: "I'm ready to take your message again."
    },
    friendly: {
      initial: "Oops, I had a little hiccup saving that message.",
      followUp: "Mind saying that one more time? I want to make sure I get it all down!",
      recovery: "I'm all ears - go ahead!"
    },
    casual: {
      initial: "My bad, that message didn't save.",
      followUp: "Can you say that again real quick?",
      recovery: "Ready when you are."
    }
  },

  misheard_info: {
    professional: {
      initial: "I want to ensure I have this correct.",
      followUp: "Could you please repeat that information?",
      recovery: "I appreciate your patience."
    },
    friendly: {
      initial: "I want to make sure I got that right!",
      followUp: "Could you say that one more time for me?",
      recovery: "Thanks for bearing with me!"
    },
    casual: {
      initial: "Let me make sure I heard that right.",
      followUp: "Mind repeating that?",
      recovery: "Thanks!"
    }
  },

  system_timeout: {
    professional: {
      initial: "I apologize for the delay. Our system is taking longer than expected to respond.",
      followUp: "Would you prefer to continue holding, or shall I take your information and have someone call you back?",
      recovery: "I appreciate your patience and want to ensure you receive excellent service."
    },
    friendly: {
      initial: "Sorry for the wait! Things are running a bit slow on my end.",
      followUp: "Want to hang in there, or should I grab your info and have someone call you back?",
      recovery: "I really appreciate you being so patient!"
    },
    casual: {
      initial: "Sorry, things are being a bit slow right now.",
      followUp: "Want to wait it out, or should I just have someone call you back?",
      recovery: "Thanks for your patience."
    }
  },

  no_availability: {
    professional: {
      initial: "I'm afraid we don't have any availability on that particular date.",
      followUp: "Would you like me to check some alternative dates for you?",
      recovery: "I'd be happy to find a time that works with your schedule."
    },
    friendly: {
      initial: "Oh, we're all booked up that day!",
      followUp: "Want me to check some other dates for you?",
      recovery: "I'm sure we can find something that works!"
    },
    casual: {
      initial: "That day's pretty packed, unfortunately.",
      followUp: "Want to try a different day?",
      recovery: "I'm sure we can work something out."
    }
  },

  invalid_date: {
    professional: {
      initial: "I apologize, but I wasn't able to find that date in our calendar.",
      followUp: "Could you please provide the date again? For example, 'next Tuesday' or 'January 15th'.",
      recovery: "I want to make sure I check the correct date for you."
    },
    friendly: {
      initial: "Hmm, I'm not quite sure what date that is!",
      followUp: "Could you tell me the date again? Like 'next Tuesday' or the specific date?",
      recovery: "I want to make sure I'm looking at the right day!"
    },
    casual: {
      initial: "Didn't quite catch that date.",
      followUp: "What day were you thinking? Like 'next Tuesday' or a specific date.",
      recovery: "Just want to make sure I'm looking at the right one."
    }
  },

  invalid_time: {
    professional: {
      initial: "I'm not certain I understood the time correctly.",
      followUp: "Could you please specify the time? For example, '2 PM' or '2:30 in the afternoon'.",
      recovery: "I want to ensure I schedule this at the correct time."
    },
    friendly: {
      initial: "I want to make sure I've got the right time!",
      followUp: "What time were you thinking? Like '2 PM' or '2:30 in the afternoon'?",
      recovery: "Just double-checking so we get it right!"
    },
    casual: {
      initial: "What time was that again?",
      followUp: "Like 2 PM or...?",
      recovery: "Just want to make sure I've got it right."
    }
  },

  missing_info: {
    professional: {
      initial: "I need a bit more information to proceed.",
      followUp: "Could you please provide your {missing_field}?",
      recovery: "This will help me assist you more effectively."
    },
    friendly: {
      initial: "I just need one more thing from you!",
      followUp: "What's your {missing_field}?",
      recovery: "And then I can get you all set!"
    },
    casual: {
      initial: "Just need one more thing.",
      followUp: "What's your {missing_field}?",
      recovery: "Then we're good to go."
    }
  },

  calendar_sync_failed: {
    professional: {
      initial: "I apologize, but I'm having difficulty syncing with our calendar system.",
      followUp: "Your appointment request has been noted. Would you like a confirmation call once it's finalized?",
      recovery: "Someone from our team will reach out shortly to confirm your booking."
    },
    friendly: {
      initial: "Our calendar's being a little stubborn right now!",
      followUp: "Don't worry - I've got your appointment request. Want us to call you back to confirm?",
      recovery: "We'll make sure to get back to you soon!"
    },
    casual: {
      initial: "Calendar's acting up on me.",
      followUp: "I've got your request though. Want a callback to confirm?",
      recovery: "We'll reach out to you shortly."
    }
  }
};

// =============================================================================
// Spanish Error Templates
// =============================================================================

export const ERROR_TEMPLATES_SPANISH: Record<ErrorType, ErrorTemplateSpanish> = {
  availability_check_failed: {
    professional: {
      initial: "Le pido disculpas, pero estoy teniendo dificultades para acceder a nuestro sistema de citas en este momento.",
      followUp: "Prefiere dejar su informacion de contacto para que un miembro de nuestro equipo le devuelva la llamada con los horarios disponibles?",
      recovery: "Alternativamente, puedo tomar un mensaje y asegurarme de que alguien se comunique con usted pronto."
    },
    friendly: {
      initial: "Ay, estoy teniendo un pequeno problema para revisar nuestro calendario ahora mismo.",
      followUp: "Puedo tomar su informacion y hacer que alguien le llame con nuestros horarios disponibles?",
      recovery: "O puedo tomar un mensaje para usted, lo que le funcione mejor!"
    },
    casual: {
      initial: "Hmm, estoy teniendo problemas para ver el calendario ahora mismo.",
      followUp: "Quiere que tome su numero y que alguien le devuelva la llamada?",
      recovery: "O solo deje un mensaje y lo resolveremos."
    }
  },

  booking_failed: {
    professional: {
      initial: "Le pido disculpas, pero no pude completar su reserva en este momento.",
      followUp: "Tengo toda su informacion registrada. Desea que alguien le llame para confirmar la cita manualmente?",
      recovery: "Tambien puedo verificar si hay otro horario que le funcione mejor."
    },
    friendly: {
      initial: "Oh no, algo salio mal con la reserva!",
      followUp: "Pero no se preocupe, tengo su informacion. Quiere que alguien le llame para resolver esto?",
      recovery: "O podemos intentar con otro horario si prefiere!"
    },
    casual: {
      initial: "Ay, la reserva no se proceso.",
      followUp: "Pero tengo sus datos. Quiere que alguien le devuelva la llamada para terminar esto?",
      recovery: "O podemos intentar con otro horario."
    }
  },

  transfer_failed: {
    professional: {
      initial: "Le pido disculpas, pero no puedo transferir su llamada en este momento.",
      followUp: "Puedo tomar un mensaje detallado y hacer que alguien le devuelva la llamada lo antes posible?",
      recovery: "Tambien puedo programar una devolucion de llamada a la hora que le convenga."
    },
    friendly: {
      initial: "Lo siento, no pude conectarle esta vez.",
      followUp: "Puedo tomar un mensaje y asegurarme de que alguien le llame pronto?",
      recovery: "O si prefiere, puedo programar una hora especifica para que le llamen."
    },
    casual: {
      initial: "Disculpe, no pude conectarle ahora mismo.",
      followUp: "Deje que tome un mensaje y hago que le devuelvan la llamada. Le parece bien?",
      recovery: "O puedo programar una hora para la devolucion de llamada si le funciona mejor."
    }
  },

  sms_failed: {
    professional: {
      initial: "Le pido disculpas, pero no pude enviar el mensaje de texto.",
      followUp: "Desea que lo intente de nuevo, o prefiere recibir esta informacion por correo electronico?",
      recovery: "Tambien puedo leerle la informacion ahora si le seria util."
    },
    friendly: {
      initial: "Hmm, el mensaje no se envio por alguna razon.",
      followUp: "Quiere que lo intente de nuevo, o le leo la informacion ahora mismo?",
      recovery: "Solo digame que le funciona mejor!"
    },
    casual: {
      initial: "El texto no se envio - la tecnologia, verdad?",
      followUp: "Quiere que lo intente de nuevo o solo le digo la informacion ahora?",
      recovery: "Lo que sea mas facil para usted."
    }
  },

  message_save_failed: {
    professional: {
      initial: "Le pido disculpas, pero tuve dificultades para guardar su mensaje.",
      followUp: "Podria repetirlo? Quiero asegurarme de capturar todo correctamente.",
      recovery: "Estoy listo para tomar su mensaje nuevamente."
    },
    friendly: {
      initial: "Ups, tuve un pequeno problema al guardar ese mensaje.",
      followUp: "Le importa repetirlo? Quiero asegurarme de anotarlo todo!",
      recovery: "Estoy escuchando, adelante!"
    },
    casual: {
      initial: "Perdon, ese mensaje no se guardo.",
      followUp: "Puede repetirlo rapidamente?",
      recovery: "Listo cuando usted quiera."
    }
  },

  misheard_info: {
    professional: {
      initial: "Quiero asegurarme de tener esto correcto.",
      followUp: "Podria repetir esa informacion, por favor?",
      recovery: "Agradezco su paciencia."
    },
    friendly: {
      initial: "Quiero asegurarme de haberlo entendido bien!",
      followUp: "Podria decirmelo una vez mas?",
      recovery: "Gracias por su paciencia!"
    },
    casual: {
      initial: "Dejeme asegurarme de haber escuchado bien.",
      followUp: "Le importa repetirlo?",
      recovery: "Gracias!"
    }
  },

  system_timeout: {
    professional: {
      initial: "Le pido disculpas por la demora. Nuestro sistema esta tardando mas de lo esperado en responder.",
      followUp: "Prefiere seguir esperando, o debo tomar su informacion y hacer que alguien le devuelva la llamada?",
      recovery: "Agradezco su paciencia y quiero asegurarme de que reciba un excelente servicio."
    },
    friendly: {
      initial: "Disculpe la espera! Las cosas estan un poco lentas de mi lado.",
      followUp: "Quiere esperar un poco mas, o debo tomar su informacion y hacer que alguien le llame?",
      recovery: "Realmente agradezco su paciencia!"
    },
    casual: {
      initial: "Perdon, las cosas estan un poco lentas ahora.",
      followUp: "Quiere esperar, o mejor hago que alguien le devuelva la llamada?",
      recovery: "Gracias por su paciencia."
    }
  },

  no_availability: {
    professional: {
      initial: "Me temo que no tenemos disponibilidad en esa fecha en particular.",
      followUp: "Le gustaria que verificara algunas fechas alternativas?",
      recovery: "Con gusto buscare un horario que funcione con su agenda."
    },
    friendly: {
      initial: "Oh, estamos completamente reservados ese dia!",
      followUp: "Quiere que revise otras fechas para usted?",
      recovery: "Estoy seguro de que encontraremos algo que funcione!"
    },
    casual: {
      initial: "Ese dia esta bastante lleno, desafortunadamente.",
      followUp: "Quiere probar otro dia?",
      recovery: "Seguro encontramos algo."
    }
  },

  invalid_date: {
    professional: {
      initial: "Le pido disculpas, pero no pude encontrar esa fecha en nuestro calendario.",
      followUp: "Podria proporcionar la fecha nuevamente? Por ejemplo, 'el proximo martes' o '15 de enero'.",
      recovery: "Quiero asegurarme de verificar la fecha correcta para usted."
    },
    friendly: {
      initial: "Hmm, no estoy seguro de que fecha es esa!",
      followUp: "Podria decirme la fecha de nuevo? Como 'el proximo martes' o la fecha especifica?",
      recovery: "Quiero asegurarme de estar viendo el dia correcto!"
    },
    casual: {
      initial: "No entendi bien esa fecha.",
      followUp: "Que dia estaba pensando? Como 'el proximo martes' o una fecha especifica.",
      recovery: "Solo quiero asegurarme de ver el correcto."
    }
  },

  invalid_time: {
    professional: {
      initial: "No estoy seguro de haber entendido la hora correctamente.",
      followUp: "Podria especificar la hora? Por ejemplo, '2 de la tarde' o '2:30 de la tarde'.",
      recovery: "Quiero asegurarme de programar esto a la hora correcta."
    },
    friendly: {
      initial: "Quiero asegurarme de tener la hora correcta!",
      followUp: "A que hora estaba pensando? Como '2 de la tarde' o '2:30 de la tarde'?",
      recovery: "Solo verifico para que quede bien!"
    },
    casual: {
      initial: "A que hora dijo?",
      followUp: "Como a las 2 de la tarde o...?",
      recovery: "Solo quiero asegurarme de tenerlo bien."
    }
  },

  missing_info: {
    professional: {
      initial: "Necesito un poco mas de informacion para continuar.",
      followUp: "Podria proporcionar su {missing_field}?",
      recovery: "Esto me ayudara a asistirle de manera mas efectiva."
    },
    friendly: {
      initial: "Solo necesito una cosa mas de usted!",
      followUp: "Cual es su {missing_field}?",
      recovery: "Y luego quedara todo listo!"
    },
    casual: {
      initial: "Solo necesito una cosa mas.",
      followUp: "Cual es su {missing_field}?",
      recovery: "Y listo."
    }
  },

  calendar_sync_failed: {
    professional: {
      initial: "Le pido disculpas, pero estoy teniendo dificultades para sincronizar con nuestro sistema de calendario.",
      followUp: "Su solicitud de cita ha sido anotada. Le gustaria recibir una llamada de confirmacion una vez que este finalizada?",
      recovery: "Alguien de nuestro equipo se comunicara pronto para confirmar su reserva."
    },
    friendly: {
      initial: "Nuestro calendario esta siendo un poco terco ahora mismo!",
      followUp: "No se preocupe, tengo su solicitud de cita. Quiere que le llamemos para confirmar?",
      recovery: "Nos aseguraremos de comunicarnos pronto!"
    },
    casual: {
      initial: "El calendario me esta dando problemas.",
      followUp: "Pero tengo su solicitud. Quiere una llamada de confirmacion?",
      recovery: "Le contactaremos pronto."
    }
  }
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get an error message for a specific error type and personality
 */
export function getErrorMessage(
  errorType: ErrorType,
  personality: Personality,
  language: "en" | "es" = "en"
): ErrorMessage {
  const templates = language === "es" ? ERROR_TEMPLATES_SPANISH : ERROR_TEMPLATES;
  const template = templates[errorType];

  if (!template) {
    // Fallback to generic error
    return language === "es"
      ? {
          initial: "Lo siento, hubo un problema.",
          followUp: "Puedo ayudarle con algo mas?",
          recovery: "Intentemoslo de nuevo."
        }
      : {
          initial: "I apologize, but there was an issue.",
          followUp: "Can I help you with something else?",
          recovery: "Let's try again."
        };
  }

  return template[personality];
}

/**
 * Get the initial error response
 */
export function getErrorInitial(
  errorType: ErrorType,
  personality: Personality,
  language: "en" | "es" = "en"
): string {
  return getErrorMessage(errorType, personality, language).initial;
}

/**
 * Get the follow-up question for an error
 */
export function getErrorFollowUp(
  errorType: ErrorType,
  personality: Personality,
  language: "en" | "es" = "en"
): string {
  return getErrorMessage(errorType, personality, language).followUp;
}

/**
 * Get the recovery message for an error
 */
export function getErrorRecovery(
  errorType: ErrorType,
  personality: Personality,
  language: "en" | "es" = "en"
): string {
  return getErrorMessage(errorType, personality, language).recovery;
}

/**
 * Get a complete error response combining initial and follow-up
 */
export function getFullErrorResponse(
  errorType: ErrorType,
  personality: Personality,
  language: "en" | "es" = "en"
): string {
  const message = getErrorMessage(errorType, personality, language);
  return `${message.initial} ${message.followUp}`;
}

/**
 * Replace placeholders in error messages
 */
export function formatErrorMessage(
  message: string,
  replacements: Record<string, string>
): string {
  let formatted = message;
  for (const [key, value] of Object.entries(replacements)) {
    formatted = formatted.replace(`{${key}}`, value);
  }
  return formatted;
}

/**
 * Get all error messages for a personality (useful for prompt generation)
 */
export function getAllErrorTemplatesForPersonality(
  personality: Personality,
  language: "en" | "es" = "en"
): Record<ErrorType, ErrorMessage> {
  const templates = language === "es" ? ERROR_TEMPLATES_SPANISH : ERROR_TEMPLATES;
  const result: Record<string, ErrorMessage> = {};

  for (const [errorType, template] of Object.entries(templates)) {
    result[errorType] = template[personality];
  }

  return result as Record<ErrorType, ErrorMessage>;
}

/**
 * Generate error handling instructions for the AI prompt
 */
export function generateErrorHandlingInstructions(
  personality: Personality,
  language: "en" | "es" = "en"
): string {
  const templates = getAllErrorTemplatesForPersonality(personality, language);

  const header = language === "es"
    ? "## Manejo de Errores\n\nCuando encuentres problemas tecnicos, usa estas respuestas:\n\n"
    : "## Error Handling\n\nWhen you encounter technical issues, use these responses:\n\n";

  let instructions = header;

  const errorDescriptions: Record<ErrorType, { en: string; es: string }> = {
    availability_check_failed: { en: "If checking availability fails", es: "Si falla la verificacion de disponibilidad" },
    booking_failed: { en: "If booking fails", es: "Si falla la reserva" },
    transfer_failed: { en: "If call transfer fails", es: "Si falla la transferencia" },
    sms_failed: { en: "If sending SMS fails", es: "Si falla el envio de SMS" },
    message_save_failed: { en: "If saving a message fails", es: "Si falla el guardado del mensaje" },
    misheard_info: { en: "If you need to confirm information", es: "Si necesitas confirmar informacion" },
    system_timeout: { en: "If the system is slow", es: "Si el sistema esta lento" },
    no_availability: { en: "If no slots are available", es: "Si no hay horarios disponibles" },
    invalid_date: { en: "If the date is unclear", es: "Si la fecha no es clara" },
    invalid_time: { en: "If the time is unclear", es: "Si la hora no es clara" },
    missing_info: { en: "If information is missing", es: "Si falta informacion" },
    calendar_sync_failed: { en: "If calendar sync fails", es: "Si falla la sincronizacion del calendario" }
  };

  for (const [errorType, message] of Object.entries(templates)) {
    const description = errorDescriptions[errorType as ErrorType];
    const desc = language === "es" ? description.es : description.en;
    instructions += `**${desc}:**\n`;
    instructions += `- ${message.initial}\n`;
    instructions += `- ${message.followUp}\n\n`;
  }

  return instructions;
}
