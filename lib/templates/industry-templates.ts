/**
 * Koya Caller - Industry Templates
 * Pre-configured settings for different business types
 */

export interface IndustryTemplate {
  id: string;
  name: string;
  icon: string;
  description: string;
  suggestedAiName: string;
  greeting: string;
  greetingSpanish?: string;
  services: Array<{
    name: string;
    duration: number; // minutes
    description?: string;
  }>;
  faqs: Array<{
    question: string;
    answer: string;
  }>;
  businessHours: {
    monday: { open: string; close: string } | null;
    tuesday: { open: string; close: string } | null;
    wednesday: { open: string; close: string } | null;
    thursday: { open: string; close: string } | null;
    friday: { open: string; close: string } | null;
    saturday: { open: string; close: string } | null;
    sunday: { open: string; close: string } | null;
  };
  voiceRecommendation: "professional" | "friendly" | "warm";
}

export const industryTemplates: IndustryTemplate[] = [
  {
    id: "salon",
    name: "Hair Salon / Barbershop",
    icon: "💇",
    description: "Perfect for hair salons, barbershops, and beauty parlors",
    suggestedAiName: "Koya",
    greeting: "Hi, thank you for calling! This is Koya, your virtual receptionist. How can I help you today?",
    greetingSpanish: "¡Hola, gracias por llamar! Soy Koya, tu recepcionista virtual. ¿En qué puedo ayudarte hoy?",
    services: [
      { name: "Haircut", duration: 30, description: "Standard haircut and style" },
      { name: "Hair Color", duration: 90, description: "Full color treatment" },
      { name: "Highlights", duration: 120, description: "Partial or full highlights" },
      { name: "Blowout", duration: 45, description: "Wash and blowdry styling" },
      { name: "Trim", duration: 15, description: "Quick trim and cleanup" },
      { name: "Deep Conditioning", duration: 30, description: "Intensive hair treatment" },
    ],
    faqs: [
      { question: "Do you take walk-ins?", answer: "We accept walk-ins based on availability, but we recommend booking an appointment to ensure you get your preferred time slot." },
      { question: "What forms of payment do you accept?", answer: "We accept all major credit cards, debit cards, and cash." },
      { question: "Do I need to tip?", answer: "Tips are always appreciated but never required. You can tip in cash or add it to your card payment." },
      { question: "Can I bring my kids?", answer: "Yes, children are welcome! We recommend booking them an appointment as well if they need services." },
    ],
    businessHours: {
      monday: { open: "09:00", close: "19:00" },
      tuesday: { open: "09:00", close: "19:00" },
      wednesday: { open: "09:00", close: "19:00" },
      thursday: { open: "09:00", close: "20:00" },
      friday: { open: "09:00", close: "20:00" },
      saturday: { open: "09:00", close: "17:00" },
      sunday: null,
    },
    voiceRecommendation: "friendly",
  },
  {
    id: "dental",
    name: "Dental Office",
    icon: "🦷",
    description: "For dental practices, orthodontists, and oral surgeons",
    suggestedAiName: "Koya",
    greeting: "Thank you for calling! I'm Koya, the virtual assistant. How may I assist you today?",
    greetingSpanish: "¡Gracias por llamar! Soy Koya, la asistente virtual. ¿Cómo puedo ayudarle hoy?",
    services: [
      { name: "Routine Cleaning", duration: 60, description: "Regular dental cleaning and checkup" },
      { name: "New Patient Exam", duration: 90, description: "Comprehensive exam for new patients" },
      { name: "Emergency Visit", duration: 30, description: "Urgent dental issue" },
      { name: "Teeth Whitening", duration: 60, description: "Professional whitening treatment" },
      { name: "Filling", duration: 45, description: "Cavity filling" },
      { name: "Consultation", duration: 30, description: "Discussion of treatment options" },
    ],
    faqs: [
      { question: "Do you accept my insurance?", answer: "We accept most major dental insurance plans. Please provide your insurance information when booking and we'll verify your coverage." },
      { question: "I'm having a dental emergency, what should I do?", answer: "For dental emergencies during business hours, call us and we'll fit you in as soon as possible. For after-hours emergencies, leave a message and our on-call dentist will return your call." },
      { question: "How often should I come in for a cleaning?", answer: "We recommend a routine cleaning every six months for most patients. Some patients with specific conditions may need more frequent visits." },
      { question: "Do you offer payment plans?", answer: "Yes, we offer flexible payment plans and accept CareCredit for larger treatments." },
    ],
    businessHours: {
      monday: { open: "08:00", close: "17:00" },
      tuesday: { open: "08:00", close: "17:00" },
      wednesday: { open: "08:00", close: "17:00" },
      thursday: { open: "08:00", close: "17:00" },
      friday: { open: "08:00", close: "15:00" },
      saturday: null,
      sunday: null,
    },
    voiceRecommendation: "professional",
  },
  {
    id: "auto",
    name: "Auto Shop / Mechanic",
    icon: "🔧",
    description: "For auto repair shops, mechanics, and car dealerships",
    suggestedAiName: "Koya",
    greeting: "Thanks for calling! I'm Koya, your virtual assistant. What can I help you with today?",
    greetingSpanish: "¡Gracias por llamar! Soy Koya, tu asistente virtual. ¿En qué puedo ayudarte hoy?",
    services: [
      { name: "Oil Change", duration: 30, description: "Standard oil change service" },
      { name: "Brake Service", duration: 60, description: "Brake inspection and repair" },
      { name: "Tire Service", duration: 45, description: "Tire rotation, balance, or replacement" },
      { name: "Diagnostic Check", duration: 60, description: "Computer diagnostic scan" },
      { name: "Tune-Up", duration: 90, description: "Full engine tune-up" },
      { name: "A/C Service", duration: 60, description: "Air conditioning repair or recharge" },
    ],
    faqs: [
      { question: "Do you offer free estimates?", answer: "Yes, we provide free estimates for most services. Just bring your vehicle in or describe the issue and we'll give you an estimate." },
      { question: "Do you offer loaner cars?", answer: "We offer loaner vehicles for customers whose repairs will take longer than a day, subject to availability." },
      { question: "What's your warranty?", answer: "We offer a 12-month/12,000-mile warranty on all parts and labor for covered repairs." },
      { question: "How long will the repair take?", answer: "Repair times vary based on the service. Simple services like oil changes take about 30 minutes, while more complex repairs may take a full day or more." },
    ],
    businessHours: {
      monday: { open: "08:00", close: "18:00" },
      tuesday: { open: "08:00", close: "18:00" },
      wednesday: { open: "08:00", close: "18:00" },
      thursday: { open: "08:00", close: "18:00" },
      friday: { open: "08:00", close: "18:00" },
      saturday: { open: "09:00", close: "14:00" },
      sunday: null,
    },
    voiceRecommendation: "friendly",
  },
  {
    id: "medical",
    name: "Medical Practice",
    icon: "🏥",
    description: "For doctors' offices, clinics, and healthcare providers",
    suggestedAiName: "Koya",
    greeting: "Thank you for calling. I'm Koya, the virtual assistant. How may I help you today?",
    greetingSpanish: "Gracias por llamar. Soy Koya, la asistente virtual. ¿Cómo puedo ayudarle?",
    services: [
      { name: "Annual Physical", duration: 45, description: "Yearly wellness exam" },
      { name: "Sick Visit", duration: 20, description: "Visit for illness or symptoms" },
      { name: "Follow-Up Visit", duration: 15, description: "Follow-up from previous visit" },
      { name: "New Patient Visit", duration: 60, description: "Initial visit for new patients" },
      { name: "Lab Work", duration: 15, description: "Blood draw or lab tests" },
      { name: "Vaccination", duration: 15, description: "Immunization appointment" },
    ],
    faqs: [
      { question: "Do you accept my insurance?", answer: "We accept most major insurance plans. Please have your insurance card ready when booking and we'll verify your coverage." },
      { question: "I need to refill my prescription", answer: "For prescription refills, please call during business hours or send a request through our patient portal. Refills typically take 24-48 hours to process." },
      { question: "I need my medical records", answer: "You can request medical records through our patient portal or by submitting a written request. Please allow 5-7 business days for processing." },
      { question: "Do you offer telehealth visits?", answer: "Yes, we offer telehealth appointments for many types of visits. Just let me know when booking if you prefer a virtual visit." },
    ],
    businessHours: {
      monday: { open: "08:00", close: "17:00" },
      tuesday: { open: "08:00", close: "17:00" },
      wednesday: { open: "08:00", close: "17:00" },
      thursday: { open: "08:00", close: "17:00" },
      friday: { open: "08:00", close: "16:00" },
      saturday: null,
      sunday: null,
    },
    voiceRecommendation: "professional",
  },
  {
    id: "spa",
    name: "Spa / Wellness",
    icon: "💆",
    description: "For spas, massage therapy, and wellness centers",
    suggestedAiName: "Koya",
    greeting: "Welcome! I'm Koya, your virtual concierge. How may I help you relax today?",
    greetingSpanish: "¡Bienvenido! Soy Koya, tu conserje virtual. ¿Cómo puedo ayudarte a relajarte hoy?",
    services: [
      { name: "Swedish Massage", duration: 60, description: "Relaxing full-body massage" },
      { name: "Deep Tissue Massage", duration: 60, description: "Intensive muscle therapy" },
      { name: "Facial", duration: 60, description: "Rejuvenating facial treatment" },
      { name: "Hot Stone Massage", duration: 90, description: "Massage with heated stones" },
      { name: "Couples Massage", duration: 60, description: "Side-by-side massage for two" },
      { name: "Body Wrap", duration: 75, description: "Detoxifying body treatment" },
    ],
    faqs: [
      { question: "What should I wear?", answer: "We provide robes and slippers. You'll undress to your comfort level and be properly draped throughout your service." },
      { question: "Should I arrive early?", answer: "Please arrive 15 minutes before your appointment to check in and begin relaxing before your service." },
      { question: "Can I request a specific therapist?", answer: "Absolutely! Let us know your preference when booking and we'll do our best to accommodate." },
      { question: "Do you have gift cards?", answer: "Yes, we offer gift cards in any amount, available for purchase in-store or online." },
    ],
    businessHours: {
      monday: { open: "10:00", close: "19:00" },
      tuesday: { open: "10:00", close: "19:00" },
      wednesday: { open: "10:00", close: "19:00" },
      thursday: { open: "10:00", close: "20:00" },
      friday: { open: "10:00", close: "20:00" },
      saturday: { open: "09:00", close: "18:00" },
      sunday: { open: "11:00", close: "17:00" },
    },
    voiceRecommendation: "warm",
  },
  {
    id: "restaurant",
    name: "Restaurant",
    icon: "🍽️",
    description: "For restaurants, cafes, and food establishments",
    suggestedAiName: "Koya",
    greeting: "Thank you for calling! I'm Koya. Would you like to make a reservation or do you have a question?",
    greetingSpanish: "¡Gracias por llamar! Soy Koya. ¿Le gustaría hacer una reservación o tiene alguna pregunta?",
    services: [
      { name: "Reservation for 2", duration: 90, description: "Table for two guests" },
      { name: "Reservation for 4", duration: 90, description: "Table for four guests" },
      { name: "Large Party (6+)", duration: 120, description: "Group reservation" },
      { name: "Private Event", duration: 180, description: "Private dining inquiry" },
    ],
    faqs: [
      { question: "Do you take reservations?", answer: "Yes, we accept reservations! I can help you book a table right now." },
      { question: "Do you have vegetarian/vegan options?", answer: "Yes, we have several vegetarian and vegan options on our menu. Our chef can also accommodate most dietary restrictions with advance notice." },
      { question: "Do you have a kids menu?", answer: "Yes, we have a kids menu with child-friendly options. High chairs and booster seats are also available." },
      { question: "Is there parking available?", answer: "We have a parking lot behind the restaurant, and street parking is also available nearby." },
    ],
    businessHours: {
      monday: null,
      tuesday: { open: "11:00", close: "22:00" },
      wednesday: { open: "11:00", close: "22:00" },
      thursday: { open: "11:00", close: "22:00" },
      friday: { open: "11:00", close: "23:00" },
      saturday: { open: "11:00", close: "23:00" },
      sunday: { open: "11:00", close: "21:00" },
    },
    voiceRecommendation: "friendly",
  },
  {
    id: "fitness",
    name: "Gym / Fitness",
    icon: "💪",
    description: "For gyms, fitness studios, and personal trainers",
    suggestedAiName: "Koya",
    greeting: "Hey! Thanks for calling. I'm Koya. Ready to help you crush your fitness goals!",
    greetingSpanish: "¡Hola! Gracias por llamar. Soy Koya. ¡Lista para ayudarte a alcanzar tus metas de fitness!",
    services: [
      { name: "Personal Training Session", duration: 60, description: "One-on-one training" },
      { name: "Group Class", duration: 45, description: "Group fitness class" },
      { name: "Gym Tour", duration: 30, description: "Facility tour for new members" },
      { name: "Fitness Assessment", duration: 45, description: "Initial fitness evaluation" },
      { name: "Nutrition Consultation", duration: 30, description: "Diet and nutrition planning" },
    ],
    faqs: [
      { question: "What are your membership options?", answer: "We offer monthly, annual, and day pass options. I can schedule you for a tour where you'll learn about all our membership benefits!" },
      { question: "Do you have personal trainers?", answer: "Yes! We have certified personal trainers available for one-on-one sessions. Would you like to book a consultation?" },
      { question: "What classes do you offer?", answer: "We offer a variety of classes including yoga, spin, HIIT, strength training, and more. Check our schedule or I can help you book a class!" },
      { question: "Is there a pool?", answer: "Our facility includes a lap pool, hot tub, and steam room available to all members." },
    ],
    businessHours: {
      monday: { open: "05:00", close: "23:00" },
      tuesday: { open: "05:00", close: "23:00" },
      wednesday: { open: "05:00", close: "23:00" },
      thursday: { open: "05:00", close: "23:00" },
      friday: { open: "05:00", close: "22:00" },
      saturday: { open: "07:00", close: "20:00" },
      sunday: { open: "07:00", close: "20:00" },
    },
    voiceRecommendation: "friendly",
  },
  {
    id: "law",
    name: "Law Firm",
    icon: "⚖️",
    description: "For law firms, attorneys, and legal services",
    suggestedAiName: "Koya",
    greeting: "Thank you for calling. I'm Koya, the virtual receptionist. How may I direct your call?",
    greetingSpanish: "Gracias por llamar. Soy Koya, la recepcionista virtual. ¿En qué puedo ayudarle?",
    services: [
      { name: "Initial Consultation", duration: 60, description: "Free initial case review" },
      { name: "Follow-Up Meeting", duration: 30, description: "Case update meeting" },
      { name: "Document Review", duration: 45, description: "Legal document review" },
    ],
    faqs: [
      { question: "Do you offer free consultations?", answer: "Yes, we offer a free initial consultation to discuss your case. Would you like me to schedule one for you?" },
      { question: "What areas of law do you practice?", answer: "Our firm handles various practice areas. Let me connect you with the appropriate attorney based on your needs." },
      { question: "How much do you charge?", answer: "Our fees vary depending on the type of case. During your free consultation, the attorney will discuss fee arrangements with you." },
      { question: "I need to speak to my attorney urgently", answer: "I understand. Let me take your information and have someone from the firm return your call as soon as possible." },
    ],
    businessHours: {
      monday: { open: "09:00", close: "17:00" },
      tuesday: { open: "09:00", close: "17:00" },
      wednesday: { open: "09:00", close: "17:00" },
      thursday: { open: "09:00", close: "17:00" },
      friday: { open: "09:00", close: "17:00" },
      saturday: null,
      sunday: null,
    },
    voiceRecommendation: "professional",
  },
  {
    id: "realestate",
    name: "Real Estate",
    icon: "🏠",
    description: "For real estate agents, brokers, and property managers",
    suggestedAiName: "Koya",
    greeting: "Thank you for calling! I'm Koya, your virtual assistant. Are you looking to buy, sell, or rent a property?",
    greetingSpanish: "¡Gracias por llamar! Soy Koya, tu asistente virtual. ¿Busca comprar, vender o alquilar una propiedad?",
    services: [
      { name: "Property Showing", duration: 60, description: "Schedule a property viewing" },
      { name: "Listing Consultation", duration: 45, description: "Discuss listing your property" },
      { name: "Buyer Consultation", duration: 60, description: "First-time buyer meeting" },
      { name: "Market Analysis", duration: 30, description: "Property value assessment" },
    ],
    faqs: [
      { question: "What areas do you cover?", answer: "We serve the greater metropolitan area and surrounding suburbs. I can have an agent call you back to discuss specific neighborhoods." },
      { question: "How much are your fees?", answer: "Our commission structure varies by property type. The agent can discuss all fees during your consultation." },
      { question: "Can I see a property today?", answer: "Let me check availability. What property are you interested in and what time works best for you?" },
      { question: "How long does it take to sell a house?", answer: "Market conditions vary, but homes in our area typically sell within 30-60 days. The agent can provide a more specific timeline based on your property." },
    ],
    businessHours: {
      monday: { open: "09:00", close: "18:00" },
      tuesday: { open: "09:00", close: "18:00" },
      wednesday: { open: "09:00", close: "18:00" },
      thursday: { open: "09:00", close: "18:00" },
      friday: { open: "09:00", close: "18:00" },
      saturday: { open: "10:00", close: "16:00" },
      sunday: { open: "12:00", close: "16:00" },
    },
    voiceRecommendation: "professional",
  },
  {
    id: "petcare",
    name: "Pet Care / Veterinary",
    icon: "🐾",
    description: "For vet clinics, pet groomers, and boarding facilities",
    suggestedAiName: "Koya",
    greeting: "Hi there! I'm Koya. How can I help you and your furry friend today?",
    greetingSpanish: "¡Hola! Soy Koya. ¿Cómo puedo ayudarte a ti y a tu mascota hoy?",
    services: [
      { name: "Wellness Exam", duration: 30, description: "Routine checkup for your pet" },
      { name: "Vaccination", duration: 20, description: "Scheduled vaccinations" },
      { name: "Grooming - Small", duration: 60, description: "Full grooming for small pets" },
      { name: "Grooming - Large", duration: 90, description: "Full grooming for large pets" },
      { name: "Dental Cleaning", duration: 45, description: "Professional dental care" },
      { name: "Emergency Visit", duration: 30, description: "Urgent care appointment" },
    ],
    faqs: [
      { question: "Do you see exotic pets?", answer: "We primarily see dogs and cats, but I can check if we have a specialist available for exotic pets. What type of pet do you have?" },
      { question: "What vaccines does my pet need?", answer: "Required vaccines depend on your pet's age, species, and lifestyle. The vet will recommend the right vaccines during your visit." },
      { question: "My pet is sick, what should I do?", answer: "I'm sorry to hear that! If it's urgent, I can schedule an emergency appointment. Can you describe the symptoms?" },
      { question: "Do you offer boarding?", answer: "Yes, we offer boarding services! How many nights do you need, and does your pet have any special requirements?" },
    ],
    businessHours: {
      monday: { open: "08:00", close: "18:00" },
      tuesday: { open: "08:00", close: "18:00" },
      wednesday: { open: "08:00", close: "18:00" },
      thursday: { open: "08:00", close: "18:00" },
      friday: { open: "08:00", close: "18:00" },
      saturday: { open: "09:00", close: "14:00" },
      sunday: null,
    },
    voiceRecommendation: "warm",
  },
  {
    id: "photography",
    name: "Photography Studio",
    icon: "📸",
    description: "For photographers and creative studios",
    suggestedAiName: "Koya",
    greeting: "Hello! I'm Koya from the studio. Looking to capture some special moments?",
    greetingSpanish: "¡Hola! Soy Koya del estudio. ¿Buscas capturar momentos especiales?",
    services: [
      { name: "Portrait Session", duration: 60, description: "Individual or family portraits" },
      { name: "Headshot Session", duration: 30, description: "Professional headshots" },
      { name: "Wedding Consultation", duration: 60, description: "Discuss wedding photography" },
      { name: "Event Photography", duration: 30, description: "Event booking consultation" },
      { name: "Mini Session", duration: 20, description: "Quick themed photo session" },
    ],
    faqs: [
      { question: "How much do you charge?", answer: "Our packages start at different price points depending on the session type. I can email you our full pricing guide, or schedule a consultation to discuss your needs." },
      { question: "How long until I get my photos?", answer: "Turnaround time is typically 2-3 weeks for standard sessions. Rush delivery is available for an additional fee." },
      { question: "Do you do destination weddings?", answer: "Yes! We love destination weddings. Travel fees apply depending on the location. Let me schedule a consultation to discuss details." },
      { question: "Can I bring my pet to the shoot?", answer: "Absolutely! We love including pets in sessions. Just let us know ahead of time so we can prepare." },
    ],
    businessHours: {
      monday: null,
      tuesday: { open: "10:00", close: "18:00" },
      wednesday: { open: "10:00", close: "18:00" },
      thursday: { open: "10:00", close: "18:00" },
      friday: { open: "10:00", close: "18:00" },
      saturday: { open: "09:00", close: "17:00" },
      sunday: { open: "10:00", close: "15:00" },
    },
    voiceRecommendation: "friendly",
  },
  {
    id: "cleaning",
    name: "Cleaning Service",
    icon: "🧹",
    description: "For cleaning companies and maid services",
    suggestedAiName: "Koya",
    greeting: "Hi! I'm Koya. Ready to help you get a sparkling clean space! Are you looking for residential or commercial cleaning?",
    greetingSpanish: "¡Hola! Soy Koya. ¿Busca servicios de limpieza residencial o comercial?",
    services: [
      { name: "Standard Cleaning", duration: 120, description: "Regular house cleaning" },
      { name: "Deep Cleaning", duration: 240, description: "Thorough top-to-bottom clean" },
      { name: "Move-In/Move-Out", duration: 300, description: "Complete property cleaning" },
      { name: "Office Cleaning", duration: 120, description: "Commercial space cleaning" },
      { name: "Post-Construction", duration: 360, description: "Construction cleanup" },
    ],
    faqs: [
      { question: "How much does cleaning cost?", answer: "Pricing depends on the size of your space and type of cleaning. Can you tell me the square footage and number of bedrooms/bathrooms?" },
      { question: "Do you bring your own supplies?", answer: "Yes, we bring all cleaning supplies and equipment. If you prefer eco-friendly products or have allergies, just let us know!" },
      { question: "Are you insured?", answer: "Yes, we're fully licensed, bonded, and insured for your peace of mind." },
      { question: "Do you offer recurring service?", answer: "Yes! We offer weekly, bi-weekly, and monthly recurring services at discounted rates." },
    ],
    businessHours: {
      monday: { open: "08:00", close: "18:00" },
      tuesday: { open: "08:00", close: "18:00" },
      wednesday: { open: "08:00", close: "18:00" },
      thursday: { open: "08:00", close: "18:00" },
      friday: { open: "08:00", close: "18:00" },
      saturday: { open: "09:00", close: "15:00" },
      sunday: null,
    },
    voiceRecommendation: "friendly",
  },
  {
    id: "hvac",
    name: "HVAC / Plumbing",
    icon: "🔧",
    description: "For HVAC technicians, plumbers, and home services",
    suggestedAiName: "Koya",
    greeting: "Thanks for calling! I'm Koya. Do you have an HVAC or plumbing issue I can help schedule service for?",
    greetingSpanish: "¡Gracias por llamar! Soy Koya. ¿Tiene un problema de HVAC o plomería?",
    services: [
      { name: "AC Repair", duration: 120, description: "Air conditioning repair" },
      { name: "Heating Repair", duration: 120, description: "Furnace/heater repair" },
      { name: "AC Maintenance", duration: 60, description: "Seasonal tune-up" },
      { name: "Plumbing Repair", duration: 90, description: "General plumbing service" },
      { name: "Drain Cleaning", duration: 60, description: "Clogged drain service" },
      { name: "Water Heater", duration: 120, description: "Water heater service" },
    ],
    faqs: [
      { question: "Do you offer emergency service?", answer: "Yes, we offer 24/7 emergency service. Emergency calls may have an additional fee. Is this an emergency situation?" },
      { question: "How much will it cost?", answer: "We charge a diagnostic fee which is waived if you proceed with repairs. The technician will provide a full quote before any work begins." },
      { question: "How soon can someone come out?", answer: "We often have same-day or next-day availability. Let me check our schedule. What's the issue you're experiencing?" },
      { question: "Do you offer financing?", answer: "Yes, we offer financing options for larger repairs and system replacements. The technician can explain all options during your visit." },
    ],
    businessHours: {
      monday: { open: "07:00", close: "19:00" },
      tuesday: { open: "07:00", close: "19:00" },
      wednesday: { open: "07:00", close: "19:00" },
      thursday: { open: "07:00", close: "19:00" },
      friday: { open: "07:00", close: "19:00" },
      saturday: { open: "08:00", close: "16:00" },
      sunday: null,
    },
    voiceRecommendation: "professional",
  },
  {
    id: "other",
    name: "Other Business",
    icon: "🏢",
    description: "Custom setup for any other business type",
    suggestedAiName: "Koya",
    greeting: "Thank you for calling! I'm Koya, your virtual assistant. How can I help you today?",
    greetingSpanish: "¡Gracias por llamar! Soy Koya, tu asistente virtual. ¿En qué puedo ayudarte hoy?",
    services: [],
    faqs: [],
    businessHours: {
      monday: { open: "09:00", close: "17:00" },
      tuesday: { open: "09:00", close: "17:00" },
      wednesday: { open: "09:00", close: "17:00" },
      thursday: { open: "09:00", close: "17:00" },
      friday: { open: "09:00", close: "17:00" },
      saturday: null,
      sunday: null,
    },
    voiceRecommendation: "friendly",
  },
];

export function getTemplateById(id: string): IndustryTemplate | undefined {
  return industryTemplates.find((t) => t.id === id);
}

export function getTemplateNames(): Array<{ id: string; name: string; icon: string }> {
  return industryTemplates.map((t) => ({
    id: t.id,
    name: t.name,
    icon: t.icon,
  }));
}
