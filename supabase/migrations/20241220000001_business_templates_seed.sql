-- Migration: Business Templates Seed Data (Session 9)
-- Spec Reference: Part 5, Lines 216-220; Part 9, Lines 1143-1152
-- Purpose: Pre-populated templates for 20+ business types

-- ============================================
-- Home Services Templates
-- ============================================

INSERT INTO business_templates (type_slug, type_name, default_services, default_faqs, urgency_triggers, sort_order) VALUES

-- HVAC
('hvac', 'HVAC / Heating & Cooling', 
  '[
    {"name": "AC Repair", "description": "Diagnosis and repair of air conditioning systems", "duration_minutes": 120, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Furnace Repair", "description": "Diagnosis and repair of heating systems", "duration_minutes": 120, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "AC Installation", "description": "New air conditioning system installation", "duration_minutes": 480, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Furnace Installation", "description": "New heating system installation", "duration_minutes": 480, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Seasonal Maintenance", "description": "Preventive maintenance and tune-up", "duration_minutes": 90, "price_cents": 14900, "price_type": "fixed", "is_bookable": true},
    {"name": "Duct Cleaning", "description": "Professional air duct cleaning", "duration_minutes": 180, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Thermostat Installation", "description": "Smart or standard thermostat installation", "duration_minutes": 60, "price_cents": null, "price_type": "quote", "is_bookable": true}
  ]'::jsonb,
  '[
    {"question": "Do you offer emergency service?", "answer": "Yes, we offer 24/7 emergency HVAC service. Call us anytime for urgent heating or cooling issues."},
    {"question": "How often should I have my HVAC system serviced?", "answer": "We recommend servicing your system twice a year - once before summer for AC and once before winter for heating."},
    {"question": "Do you provide free estimates?", "answer": "Yes, we provide free estimates for all installations and major repairs."},
    {"question": "What brands do you service?", "answer": "We service all major brands including Carrier, Trane, Lennox, Rheem, and more."},
    {"question": "How long does a typical repair take?", "answer": "Most repairs can be completed in 1-2 hours. Complex issues may require additional time or follow-up visits."},
    {"question": "Do you offer financing?", "answer": "Yes, we offer flexible financing options for new system installations."}
  ]'::jsonb,
  ARRAY['no heat', 'no AC', 'no air conditioning', 'not cooling', 'not heating', 'furnace not working', 'AC broken'],
  1
),

-- Plumbing
('plumbing', 'Plumbing',
  '[
    {"name": "Drain Cleaning", "description": "Professional drain clearing and cleaning", "duration_minutes": 60, "price_cents": 14900, "price_type": "fixed", "is_bookable": true},
    {"name": "Leak Repair", "description": "Repair of pipe and fixture leaks", "duration_minutes": 90, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Water Heater Repair", "description": "Water heater diagnosis and repair", "duration_minutes": 120, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Water Heater Installation", "description": "New water heater installation", "duration_minutes": 240, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Toilet Repair", "description": "Toilet repair or replacement", "duration_minutes": 60, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Faucet Installation", "description": "Faucet replacement and installation", "duration_minutes": 60, "price_cents": 12900, "price_type": "fixed", "is_bookable": true},
    {"name": "Sewer Line Service", "description": "Sewer line inspection and cleaning", "duration_minutes": 180, "price_cents": null, "price_type": "quote", "is_bookable": true}
  ]'::jsonb,
  '[
    {"question": "Do you offer emergency plumbing service?", "answer": "Yes, we provide 24/7 emergency plumbing service for urgent issues like major leaks, flooding, or no water."},
    {"question": "How much does a typical service call cost?", "answer": "Our service call fee varies. We provide upfront pricing before any work begins."},
    {"question": "Do you give free estimates?", "answer": "Yes, we offer free estimates for larger jobs and installations."},
    {"question": "Are you licensed and insured?", "answer": "Yes, we are fully licensed, bonded, and insured for your protection."},
    {"question": "How quickly can you come out?", "answer": "For emergencies, we aim to respond within 1-2 hours. For non-urgent issues, we often have same-day or next-day availability."},
    {"question": "What forms of payment do you accept?", "answer": "We accept cash, checks, and all major credit cards."}
  ]'::jsonb,
  ARRAY['flooding', 'water everywhere', 'pipe burst', 'no hot water', 'sewage', 'backup', 'overflowing'],
  2
),

-- Electrical
('electrical', 'Electrical',
  '[
    {"name": "Electrical Repair", "description": "General electrical troubleshooting and repair", "duration_minutes": 90, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Outlet Installation", "description": "New outlet installation or replacement", "duration_minutes": 60, "price_cents": 12900, "price_type": "fixed", "is_bookable": true},
    {"name": "Panel Upgrade", "description": "Electrical panel upgrade or replacement", "duration_minutes": 480, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Lighting Installation", "description": "Light fixture installation", "duration_minutes": 60, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Ceiling Fan Installation", "description": "Ceiling fan installation or replacement", "duration_minutes": 90, "price_cents": 14900, "price_type": "fixed", "is_bookable": true},
    {"name": "Whole House Generator", "description": "Generator installation and setup", "duration_minutes": 480, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "EV Charger Installation", "description": "Electric vehicle charger installation", "duration_minutes": 240, "price_cents": null, "price_type": "quote", "is_bookable": true}
  ]'::jsonb,
  '[
    {"question": "Do you handle emergency electrical work?", "answer": "Yes, we provide 24/7 emergency electrical service for safety issues like power outages, sparking outlets, or electrical fires."},
    {"question": "Are you licensed electricians?", "answer": "Yes, all our electricians are fully licensed, insured, and undergo regular training."},
    {"question": "Do you offer free estimates?", "answer": "Yes, we provide free estimates for all major electrical projects."},
    {"question": "How long does it take to install an EV charger?", "answer": "Most EV charger installations can be completed in 2-4 hours, depending on your electrical setup."},
    {"question": "Can you help with permits?", "answer": "Yes, we handle all necessary permits and inspections for your electrical work."},
    {"question": "Do you work on older homes?", "answer": "Absolutely. We specialize in both modern and older home electrical systems, including knob-and-tube upgrades."}
  ]'::jsonb,
  ARRAY['no power', 'sparking', 'electrical fire', 'burning smell', 'shock', 'power out'],
  3
),

-- Roofing
('roofing', 'Roofing',
  '[
    {"name": "Roof Inspection", "description": "Complete roof inspection and assessment", "duration_minutes": 60, "price_cents": 0, "price_type": "fixed", "is_bookable": true},
    {"name": "Roof Repair", "description": "Repair of leaks, damaged shingles, and flashing", "duration_minutes": 180, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Full Roof Replacement", "description": "Complete roof tear-off and replacement", "duration_minutes": 1440, "price_cents": null, "price_type": "quote", "is_bookable": false},
    {"name": "Emergency Tarp Service", "description": "Emergency tarping for active leaks", "duration_minutes": 120, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Gutter Installation", "description": "New gutter system installation", "duration_minutes": 240, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Gutter Cleaning", "description": "Professional gutter cleaning service", "duration_minutes": 90, "price_cents": 14900, "price_type": "fixed", "is_bookable": true}
  ]'::jsonb,
  '[
    {"question": "Do you offer free roof inspections?", "answer": "Yes, we provide free roof inspections and estimates for all potential customers."},
    {"question": "How long does a roof replacement take?", "answer": "Most residential roof replacements can be completed in 1-3 days, weather permitting."},
    {"question": "Do you offer emergency service?", "answer": "Yes, we provide emergency tarping service for active leaks to protect your home until repairs can be made."},
    {"question": "What roofing materials do you work with?", "answer": "We install and repair asphalt shingles, metal roofing, tile, and flat roof systems."},
    {"question": "Do you handle insurance claims?", "answer": "Yes, we work directly with insurance companies and can help document storm damage for your claim."},
    {"question": "What warranty do you offer?", "answer": "We offer manufacturer warranties on materials plus our own workmanship warranty. Details vary by project."}
  ]'::jsonb,
  ARRAY['roof leak', 'leaking roof', 'water coming in', 'storm damage', 'tree fell on roof'],
  4
),

-- Landscaping
('landscaping', 'Landscaping',
  '[
    {"name": "Lawn Maintenance", "description": "Regular mowing, edging, and blowing", "duration_minutes": 60, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Landscape Design", "description": "Custom landscape design consultation", "duration_minutes": 90, "price_cents": 0, "price_type": "fixed", "is_bookable": true},
    {"name": "Planting & Installation", "description": "Tree, shrub, and flower installation", "duration_minutes": 240, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Irrigation Installation", "description": "Sprinkler system design and installation", "duration_minutes": 480, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Hardscaping", "description": "Patios, walkways, and retaining walls", "duration_minutes": 480, "price_cents": null, "price_type": "quote", "is_bookable": false},
    {"name": "Seasonal Cleanup", "description": "Spring or fall yard cleanup", "duration_minutes": 180, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Tree Trimming", "description": "Professional tree and shrub pruning", "duration_minutes": 120, "price_cents": null, "price_type": "quote", "is_bookable": true}
  ]'::jsonb,
  '[
    {"question": "Do you offer free estimates?", "answer": "Yes, we provide free on-site estimates for all landscaping projects."},
    {"question": "How often should I have my lawn maintained?", "answer": "During growing season, we recommend weekly or bi-weekly maintenance for the best results."},
    {"question": "Do you design and install or just maintain?", "answer": "We offer both! From complete landscape design and installation to ongoing maintenance services."},
    {"question": "What areas do you serve?", "answer": "We serve the local area. Call us to confirm we service your location."},
    {"question": "Do you remove debris?", "answer": "Yes, we haul away all debris and leave your property clean after every service."},
    {"question": "Do you offer seasonal contracts?", "answer": "Yes, we offer seasonal and annual maintenance contracts with discounted rates."}
  ]'::jsonb,
  ARRAY[]::text[],
  5
),

-- House Cleaning
('cleaning', 'House Cleaning',
  '[
    {"name": "Standard Cleaning", "description": "Regular cleaning of all rooms", "duration_minutes": 120, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Deep Cleaning", "description": "Thorough deep cleaning including baseboards, inside appliances", "duration_minutes": 240, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Move In/Out Cleaning", "description": "Complete cleaning for moving transitions", "duration_minutes": 300, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Recurring Service", "description": "Weekly, bi-weekly, or monthly cleaning", "duration_minutes": 120, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Office Cleaning", "description": "Commercial office cleaning service", "duration_minutes": 120, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Post-Construction Cleaning", "description": "Cleaning after renovation or construction", "duration_minutes": 360, "price_cents": null, "price_type": "quote", "is_bookable": true}
  ]'::jsonb,
  '[
    {"question": "What is included in a standard cleaning?", "answer": "Standard cleaning includes dusting, vacuuming, mopping, bathroom sanitization, and kitchen cleaning."},
    {"question": "Do I need to provide cleaning supplies?", "answer": "No, we bring all our own professional-grade cleaning supplies and equipment."},
    {"question": "Are your cleaners background checked?", "answer": "Yes, all our cleaning professionals undergo thorough background checks and are fully insured."},
    {"question": "How do you price your services?", "answer": "Pricing depends on home size, cleaning type, and frequency. We provide free quotes."},
    {"question": "Can I request the same cleaner each time?", "answer": "Yes, we try to send the same cleaner for recurring services to ensure consistency."},
    {"question": "What if I am not satisfied?", "answer": "Your satisfaction is guaranteed. If you are not happy, we will re-clean the area at no charge."}
  ]'::jsonb,
  ARRAY[]::text[],
  6
),

-- Pest Control
('pest_control', 'Pest Control',
  '[
    {"name": "General Pest Treatment", "description": "Treatment for common household pests", "duration_minutes": 60, "price_cents": 14900, "price_type": "fixed", "is_bookable": true},
    {"name": "Termite Inspection", "description": "Complete termite inspection and report", "duration_minutes": 90, "price_cents": 0, "price_type": "fixed", "is_bookable": true},
    {"name": "Termite Treatment", "description": "Termite elimination and prevention", "duration_minutes": 240, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Rodent Control", "description": "Mouse and rat elimination program", "duration_minutes": 60, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Bed Bug Treatment", "description": "Bed bug elimination service", "duration_minutes": 180, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Mosquito Treatment", "description": "Yard mosquito control service", "duration_minutes": 45, "price_cents": 9900, "price_type": "fixed", "is_bookable": true}
  ]'::jsonb,
  '[
    {"question": "Are your treatments safe for pets and children?", "answer": "Yes, we use pet and family-safe products. We will advise on any precautions needed."},
    {"question": "How quickly can you come out?", "answer": "We often have same-day or next-day availability for pest emergencies."},
    {"question": "Do you offer ongoing pest prevention?", "answer": "Yes, we offer monthly, quarterly, and annual prevention plans to keep pests away."},
    {"question": "Do you guarantee your work?", "answer": "Yes, our treatments come with a satisfaction guarantee. If pests return, so do we."},
    {"question": "What pests do you treat?", "answer": "We handle ants, roaches, spiders, rodents, termites, bed bugs, mosquitoes, wasps, and more."},
    {"question": "Do I need to leave during treatment?", "answer": "For most treatments, you can stay home. We will advise if any preparation is needed."}
  ]'::jsonb,
  ARRAY['termites', 'bed bugs', 'infestation', 'swarm'],
  7
),

-- ============================================
-- Automotive Templates
-- ============================================

-- Auto Repair
('auto_repair', 'Auto Repair',
  '[
    {"name": "Oil Change", "description": "Full synthetic or conventional oil change", "duration_minutes": 30, "price_cents": 4900, "price_type": "fixed", "is_bookable": true},
    {"name": "Brake Service", "description": "Brake pad replacement and rotor inspection", "duration_minutes": 120, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Diagnostic", "description": "Computer diagnostic and troubleshooting", "duration_minutes": 60, "price_cents": 9900, "price_type": "fixed", "is_bookable": true},
    {"name": "Tire Service", "description": "Tire rotation, balancing, or replacement", "duration_minutes": 60, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "AC Service", "description": "Air conditioning diagnostic and recharge", "duration_minutes": 60, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Transmission Service", "description": "Transmission fluid flush and inspection", "duration_minutes": 120, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "General Repair", "description": "Engine, suspension, or electrical repairs", "duration_minutes": 120, "price_cents": null, "price_type": "quote", "is_bookable": true}
  ]'::jsonb,
  '[
    {"question": "Do you work on all makes and models?", "answer": "Yes, we service all domestic and foreign vehicles."},
    {"question": "Do you offer loaner cars?", "answer": "We can arrange loaner vehicles or shuttle service for major repairs. Ask about availability."},
    {"question": "How long does a typical repair take?", "answer": "Most routine services take 1-2 hours. Major repairs may require a day or more."},
    {"question": "Do you provide written estimates?", "answer": "Yes, we always provide a written estimate before beginning any work."},
    {"question": "Are you ASE certified?", "answer": "Yes, our mechanics are ASE certified professionals."},
    {"question": "Do you offer any warranties?", "answer": "Yes, we warranty our parts and labor. Specific terms depend on the repair."}
  ]'::jsonb,
  ARRAY['car wont start', 'broke down', 'check engine light', 'smoking', 'overheating'],
  8
),

-- Auto Detailing
('auto_detailing', 'Auto Detailing',
  '[
    {"name": "Basic Wash", "description": "Exterior wash, dry, and windows", "duration_minutes": 30, "price_cents": 2500, "price_type": "fixed", "is_bookable": true},
    {"name": "Interior Detail", "description": "Full interior vacuum, wipe-down, and conditioning", "duration_minutes": 90, "price_cents": 7900, "price_type": "fixed", "is_bookable": true},
    {"name": "Exterior Detail", "description": "Hand wash, clay bar, polish, and wax", "duration_minutes": 180, "price_cents": 14900, "price_type": "fixed", "is_bookable": true},
    {"name": "Full Detail", "description": "Complete interior and exterior detail", "duration_minutes": 300, "price_cents": 19900, "price_type": "fixed", "is_bookable": true},
    {"name": "Ceramic Coating", "description": "Professional ceramic coating application", "duration_minutes": 480, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Paint Correction", "description": "Swirl removal and paint restoration", "duration_minutes": 480, "price_cents": null, "price_type": "quote", "is_bookable": true}
  ]'::jsonb,
  '[
    {"question": "Do you come to me or do I come to you?", "answer": "We offer both mobile detailing service and shop service. Your choice!"},
    {"question": "How long does a full detail take?", "answer": "A full detail typically takes 4-5 hours depending on vehicle size and condition."},
    {"question": "What is ceramic coating?", "answer": "Ceramic coating is a liquid polymer that bonds to paint for long-lasting protection and shine."},
    {"question": "Do you detail boats/RVs?", "answer": "Yes, we detail cars, trucks, SUVs, boats, RVs, and motorcycles."},
    {"question": "How often should I detail my car?", "answer": "We recommend a full detail every 3-6 months, with regular washes in between."},
    {"question": "Can you remove pet hair?", "answer": "Absolutely! Our interior detail includes thorough pet hair removal."}
  ]'::jsonb,
  ARRAY[]::text[],
  9
),

-- ============================================
-- Medical/Wellness Templates
-- ============================================

-- Dental
('dental', 'Dental Office',
  '[
    {"name": "Dental Exam", "description": "Comprehensive dental examination", "duration_minutes": 60, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Teeth Cleaning", "description": "Professional dental cleaning", "duration_minutes": 60, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "X-Rays", "description": "Dental x-ray imaging", "duration_minutes": 30, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Filling", "description": "Tooth filling procedure", "duration_minutes": 60, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Crown", "description": "Dental crown fitting", "duration_minutes": 90, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Teeth Whitening", "description": "Professional whitening treatment", "duration_minutes": 90, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Emergency Visit", "description": "Emergency dental care", "duration_minutes": 30, "price_cents": null, "price_type": "quote", "is_bookable": true}
  ]'::jsonb,
  '[
    {"question": "Do you accept my insurance?", "answer": "We accept most major dental insurance plans. Please call us with your insurance details and we can verify coverage."},
    {"question": "Are you accepting new patients?", "answer": "Yes, we are currently accepting new patients! Call to schedule your first appointment."},
    {"question": "Do you offer payment plans?", "answer": "Yes, we offer flexible payment options and financing for dental work."},
    {"question": "What if I have a dental emergency?", "answer": "We reserve time for same-day emergency appointments. Call us immediately if you have severe pain."},
    {"question": "How often should I have a dental checkup?", "answer": "We recommend checkups and cleanings every 6 months for optimal dental health."},
    {"question": "Do you offer sedation dentistry?", "answer": "Yes, we offer sedation options for patients with dental anxiety. Ask about our comfort options."}
  ]'::jsonb,
  ARRAY['tooth pain', 'broken tooth', 'dental emergency', 'severe pain', 'knocked out tooth'],
  10
),

-- Chiropractic
('chiropractic', 'Chiropractic',
  '[
    {"name": "Initial Consultation", "description": "New patient exam and assessment", "duration_minutes": 60, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Adjustment", "description": "Spinal adjustment treatment", "duration_minutes": 30, "price_cents": 7500, "price_type": "fixed", "is_bookable": true},
    {"name": "X-Ray Imaging", "description": "Diagnostic x-rays", "duration_minutes": 30, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Massage Therapy", "description": "Therapeutic massage session", "duration_minutes": 60, "price_cents": 8500, "price_type": "fixed", "is_bookable": true},
    {"name": "Decompression Therapy", "description": "Spinal decompression treatment", "duration_minutes": 30, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Follow-up Visit", "description": "Return visit and adjustment", "duration_minutes": 20, "price_cents": 5500, "price_type": "fixed", "is_bookable": true}
  ]'::jsonb,
  '[
    {"question": "Do you accept insurance?", "answer": "Yes, we accept most major insurance plans including auto injury and workers comp claims."},
    {"question": "How many visits will I need?", "answer": "Treatment plans vary by condition. After your initial exam, we will recommend a personalized plan."},
    {"question": "Is chiropractic care safe?", "answer": "Yes, chiropractic care is very safe when performed by a licensed chiropractor like our team."},
    {"question": "What conditions do you treat?", "answer": "We treat back pain, neck pain, headaches, sciatica, sports injuries, and more."},
    {"question": "Do I need a referral?", "answer": "No referral is needed. You can schedule directly with us."},
    {"question": "What should I wear to my appointment?", "answer": "Wear comfortable, loose-fitting clothing that allows you to move freely."}
  ]'::jsonb,
  ARRAY['severe pain', 'cant move', 'accident', 'injury'],
  11
),

-- Med Spa
('med_spa', 'Med Spa',
  '[
    {"name": "Consultation", "description": "Free consultation for new clients", "duration_minutes": 30, "price_cents": 0, "price_type": "fixed", "is_bookable": true},
    {"name": "Botox", "description": "Botox injection treatment", "duration_minutes": 30, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Dermal Fillers", "description": "Lip and facial filler treatments", "duration_minutes": 45, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Chemical Peel", "description": "Professional chemical peel treatment", "duration_minutes": 45, "price_cents": 15000, "price_type": "fixed", "is_bookable": true},
    {"name": "Microneedling", "description": "Collagen induction therapy", "duration_minutes": 60, "price_cents": 30000, "price_type": "fixed", "is_bookable": true},
    {"name": "Laser Treatment", "description": "Laser skin rejuvenation", "duration_minutes": 60, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "IV Therapy", "description": "Vitamin IV infusion", "duration_minutes": 45, "price_cents": 15000, "price_type": "fixed", "is_bookable": true}
  ]'::jsonb,
  '[
    {"question": "Is there a consultation fee?", "answer": "No, your initial consultation is complimentary. We will discuss your goals and create a personalized plan."},
    {"question": "How long do results last?", "answer": "Results vary by treatment. Botox lasts 3-4 months, fillers 6-18 months depending on the product."},
    {"question": "Is there any downtime?", "answer": "Most treatments have minimal downtime. We will discuss what to expect during your consultation."},
    {"question": "Are your treatments safe?", "answer": "Yes, all treatments are performed by licensed medical professionals using FDA-approved products."},
    {"question": "Do you offer financing?", "answer": "Yes, we offer financing options to help make treatments more affordable."},
    {"question": "How do I prepare for my appointment?", "answer": "Avoid blood thinners and alcohol 24 hours before injectable treatments. We will provide specific instructions."}
  ]'::jsonb,
  ARRAY[]::text[],
  12
),

-- Massage Therapy
('massage', 'Massage Therapy',
  '[
    {"name": "Swedish Massage", "description": "Relaxing full-body massage", "duration_minutes": 60, "price_cents": 8500, "price_type": "fixed", "is_bookable": true},
    {"name": "Deep Tissue Massage", "description": "Therapeutic deep tissue work", "duration_minutes": 60, "price_cents": 9500, "price_type": "fixed", "is_bookable": true},
    {"name": "Sports Massage", "description": "Athletic performance and recovery massage", "duration_minutes": 60, "price_cents": 9500, "price_type": "fixed", "is_bookable": true},
    {"name": "Hot Stone Massage", "description": "Heated stone massage therapy", "duration_minutes": 90, "price_cents": 12500, "price_type": "fixed", "is_bookable": true},
    {"name": "Prenatal Massage", "description": "Massage for expecting mothers", "duration_minutes": 60, "price_cents": 8500, "price_type": "fixed", "is_bookable": true},
    {"name": "Couples Massage", "description": "Side-by-side massage for two", "duration_minutes": 60, "price_cents": 17000, "price_type": "fixed", "is_bookable": true}
  ]'::jsonb,
  '[
    {"question": "What should I wear?", "answer": "You will undress to your comfort level and be draped with sheets throughout the massage."},
    {"question": "How early should I arrive?", "answer": "Please arrive 10-15 minutes early to complete paperwork and relax before your session."},
    {"question": "Can I request a specific therapist?", "answer": "Yes, you can request a specific therapist when booking."},
    {"question": "Do you offer gift certificates?", "answer": "Yes, gift certificates are available and make wonderful presents!"},
    {"question": "How often should I get a massage?", "answer": "For maintenance, monthly massages work well. For therapeutic goals, more frequent sessions may help."},
    {"question": "What is your cancellation policy?", "answer": "We request 24 hours notice for cancellations to avoid a cancellation fee."}
  ]'::jsonb,
  ARRAY[]::text[],
  13
),

-- Hair Salon
('salon', 'Hair Salon',
  '[
    {"name": "Haircut", "description": "Professional haircut and style", "duration_minutes": 45, "price_cents": 4500, "price_type": "fixed", "is_bookable": true},
    {"name": "Color", "description": "Single-process hair color", "duration_minutes": 90, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Highlights", "description": "Partial or full highlights", "duration_minutes": 120, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Blowout", "description": "Shampoo and blowdry styling", "duration_minutes": 45, "price_cents": 4000, "price_type": "fixed", "is_bookable": true},
    {"name": "Deep Conditioning", "description": "Intensive hair treatment", "duration_minutes": 30, "price_cents": 3500, "price_type": "fixed", "is_bookable": true},
    {"name": "Balayage", "description": "Hand-painted highlight technique", "duration_minutes": 180, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Bridal Styling", "description": "Wedding hair styling", "duration_minutes": 90, "price_cents": null, "price_type": "quote", "is_bookable": true}
  ]'::jsonb,
  '[
    {"question": "Do I need an appointment?", "answer": "Appointments are recommended but we do accept walk-ins based on availability."},
    {"question": "How do I prepare for a color appointment?", "answer": "Come with unwashed hair from 1-2 days prior. Avoid styling products."},
    {"question": "How long will my appointment take?", "answer": "Haircuts take 45 minutes. Color services vary from 90 minutes to 3+ hours depending on the service."},
    {"question": "Do you do consultations?", "answer": "Yes, we offer free consultations to discuss your goals and provide pricing for complex services."},
    {"question": "What products do you use?", "answer": "We use professional salon-grade products. Ask your stylist about our retail products."},
    {"question": "What is your cancellation policy?", "answer": "We require 24 hours notice for cancellations to avoid a fee."}
  ]'::jsonb,
  ARRAY[]::text[],
  14
),

-- ============================================
-- Professional Services Templates
-- ============================================

-- Law Office
('legal', 'Law Office',
  '[
    {"name": "Initial Consultation", "description": "Case evaluation and legal advice", "duration_minutes": 60, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Document Review", "description": "Legal document review and analysis", "duration_minutes": 60, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Contract Drafting", "description": "Contract preparation and review", "duration_minutes": 120, "price_cents": null, "price_type": "quote", "is_bookable": false},
    {"name": "Representation", "description": "Court or mediation representation", "duration_minutes": 240, "price_cents": null, "price_type": "quote", "is_bookable": false},
    {"name": "Estate Planning", "description": "Will and trust preparation", "duration_minutes": 90, "price_cents": null, "price_type": "quote", "is_bookable": true}
  ]'::jsonb,
  '[
    {"question": "What areas of law do you practice?", "answer": "Please ask about our specific practice areas. We can direct you to the right attorney."},
    {"question": "Do you offer free consultations?", "answer": "Initial consultations vary by case type. Call to discuss your situation and consultation options."},
    {"question": "How are your fees structured?", "answer": "Fee structures depend on the type of case - hourly, flat fee, or contingency. We discuss fees upfront."},
    {"question": "How quickly can I get an appointment?", "answer": "We try to accommodate urgent matters quickly. Call and we will work to fit you in."},
    {"question": "What should I bring to my consultation?", "answer": "Bring any relevant documents, correspondence, and a list of questions you have."},
    {"question": "Do you handle cases in multiple states?", "answer": "Please call to discuss the specifics of your situation and jurisdiction."}
  ]'::jsonb,
  ARRAY['arrested', 'served papers', 'emergency custody', 'restraining order'],
  15
),

-- Accounting/Tax
('accounting', 'Accounting & Tax',
  '[
    {"name": "Tax Preparation", "description": "Individual or business tax return preparation", "duration_minutes": 60, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Tax Planning", "description": "Proactive tax strategy consultation", "duration_minutes": 60, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Bookkeeping", "description": "Monthly bookkeeping services", "duration_minutes": 60, "price_cents": null, "price_type": "quote", "is_bookable": false},
    {"name": "Payroll Services", "description": "Payroll processing and compliance", "duration_minutes": 60, "price_cents": null, "price_type": "quote", "is_bookable": false},
    {"name": "Business Formation", "description": "LLC or corporation setup", "duration_minutes": 90, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "IRS Representation", "description": "Audit representation and resolution", "duration_minutes": 60, "price_cents": null, "price_type": "quote", "is_bookable": true}
  ]'::jsonb,
  '[
    {"question": "How much does tax preparation cost?", "answer": "Fees depend on return complexity. Simple returns start at one rate, business returns vary. Call for a quote."},
    {"question": "What documents do I need for my tax appointment?", "answer": "Bring W-2s, 1099s, mortgage interest statements, charitable donation receipts, and last years return."},
    {"question": "Do you handle IRS audits?", "answer": "Yes, we provide full IRS audit representation and can help resolve tax issues."},
    {"question": "Are you accepting new clients?", "answer": "Yes, we welcome new individual and business clients throughout the year."},
    {"question": "Can you help with back taxes?", "answer": "Yes, we help clients catch up on unfiled returns and negotiate with the IRS when needed."},
    {"question": "Do you work with small businesses?", "answer": "Absolutely. We specialize in small business accounting, tax, and advisory services."}
  ]'::jsonb,
  ARRAY['irs', 'audit', 'tax deadline'],
  16
),

-- Real Estate
('real_estate', 'Real Estate',
  '[
    {"name": "Buyer Consultation", "description": "Home buyer strategy session", "duration_minutes": 60, "price_cents": 0, "price_type": "fixed", "is_bookable": true},
    {"name": "Seller Consultation", "description": "Home selling strategy and pricing", "duration_minutes": 60, "price_cents": 0, "price_type": "fixed", "is_bookable": true},
    {"name": "Property Showing", "description": "Scheduled home tour", "duration_minutes": 60, "price_cents": 0, "price_type": "fixed", "is_bookable": true},
    {"name": "Market Analysis", "description": "Comparative market analysis", "duration_minutes": 45, "price_cents": 0, "price_type": "fixed", "is_bookable": true},
    {"name": "Open House", "description": "Public property showing", "duration_minutes": 180, "price_cents": 0, "price_type": "fixed", "is_bookable": false}
  ]'::jsonb,
  '[
    {"question": "How do I get started buying a home?", "answer": "Schedule a buyer consultation. We will discuss your needs, budget, and the buying process."},
    {"question": "What is your commission rate?", "answer": "Commission rates are negotiable and discussed during our initial consultation."},
    {"question": "How long does it take to sell a home?", "answer": "Market time varies by area and price point. We will provide data for your specific market."},
    {"question": "Do you work with first-time buyers?", "answer": "Absolutely! We love helping first-time buyers navigate the process."},
    {"question": "What areas do you serve?", "answer": "We serve the local area and surrounding communities. Call to confirm your area."},
    {"question": "Should I get pre-approved before looking at homes?", "answer": "Yes, we strongly recommend getting pre-approved so you know your budget and can move quickly."}
  ]'::jsonb,
  ARRAY[]::text[],
  17
),

-- Insurance
('insurance', 'Insurance Agency',
  '[
    {"name": "Quote Consultation", "description": "Insurance needs assessment and quotes", "duration_minutes": 30, "price_cents": 0, "price_type": "fixed", "is_bookable": true},
    {"name": "Policy Review", "description": "Annual coverage review", "duration_minutes": 45, "price_cents": 0, "price_type": "fixed", "is_bookable": true},
    {"name": "Claims Assistance", "description": "Help filing an insurance claim", "duration_minutes": 30, "price_cents": 0, "price_type": "fixed", "is_bookable": true},
    {"name": "Business Insurance", "description": "Commercial insurance consultation", "duration_minutes": 60, "price_cents": 0, "price_type": "fixed", "is_bookable": true},
    {"name": "Life Insurance", "description": "Life insurance needs analysis", "duration_minutes": 45, "price_cents": 0, "price_type": "fixed", "is_bookable": true}
  ]'::jsonb,
  '[
    {"question": "What types of insurance do you offer?", "answer": "We offer auto, home, life, business, and many other types of insurance coverage."},
    {"question": "Can you beat my current rate?", "answer": "We will shop multiple carriers to find you the best coverage and price. Schedule a quote consultation."},
    {"question": "How do I file a claim?", "answer": "Call us and we will walk you through the claims process and help you file."},
    {"question": "When can I make changes to my policy?", "answer": "You can make changes anytime. Some changes take effect immediately, others at renewal."},
    {"question": "Do you offer bundle discounts?", "answer": "Yes, bundling multiple policies often qualifies you for significant discounts."},
    {"question": "What do I need to get a quote?", "answer": "Basic information about what you want to insure. For auto, your drivers license and vehicle info."}
  ]'::jsonb,
  ARRAY['accident', 'claim', 'damage', 'emergency'],
  18
),

-- ============================================
-- Restaurant Template
-- ============================================

('restaurant', 'Restaurant',
  '[
    {"name": "Reservation", "description": "Table reservation", "duration_minutes": 90, "price_cents": 0, "price_type": "hidden", "is_bookable": true},
    {"name": "Private Event", "description": "Private dining or event booking", "duration_minutes": 180, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Catering Inquiry", "description": "Off-site catering consultation", "duration_minutes": 30, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Takeout Order", "description": "Phone-in takeout order", "duration_minutes": 15, "price_cents": null, "price_type": "hidden", "is_bookable": false}
  ]'::jsonb,
  '[
    {"question": "What are your hours?", "answer": "Please ask for our current hours of operation."},
    {"question": "Do you take reservations?", "answer": "Yes, we accept reservations. We can book one for you now if you would like."},
    {"question": "Do you have vegetarian options?", "answer": "Yes, we have several vegetarian and vegan-friendly options on our menu."},
    {"question": "Do you accommodate food allergies?", "answer": "We take allergies seriously. Please inform your server of any allergies when you arrive."},
    {"question": "Do you do catering?", "answer": "Yes, we offer catering for events. Schedule a consultation to discuss your needs."},
    {"question": "Is there parking available?", "answer": "Please ask about parking options at our location."}
  ]'::jsonb,
  ARRAY[]::text[],
  19
),

-- ============================================
-- Other/Generic Template
-- ============================================

('other', 'Other Business Type',
  '[
    {"name": "Consultation", "description": "Initial consultation", "duration_minutes": 60, "price_cents": 0, "price_type": "fixed", "is_bookable": true},
    {"name": "Service Appointment", "description": "Standard service appointment", "duration_minutes": 60, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Follow-up", "description": "Follow-up appointment", "duration_minutes": 30, "price_cents": null, "price_type": "quote", "is_bookable": true}
  ]'::jsonb,
  '[
    {"question": "What are your hours?", "answer": "Please ask for our current business hours."},
    {"question": "Do you offer free estimates?", "answer": "Please ask about our consultation and estimate policy."},
    {"question": "How quickly can I get an appointment?", "answer": "Availability varies. We will work to accommodate your schedule."},
    {"question": "What forms of payment do you accept?", "answer": "Please ask about accepted payment methods."},
    {"question": "Are you licensed and insured?", "answer": "Please ask about our licensing and insurance coverage."}
  ]'::jsonb,
  ARRAY[]::text[],
  99
);

-- Create a comment for documentation
COMMENT ON TABLE business_templates IS 'Pre-populated business type templates with default services and FAQs. 20+ types covering home services, automotive, medical/wellness, professional services, and more.';
