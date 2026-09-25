// Single source of truth for the /tarief/ Q&As.
// Used by both the visible list and the FAQPage JSON-LD in src/pages/tarief.astro,
// so the schema text always matches what readers (and AI assistants) see.
//
// Every fact here repeats something the site already says. Keep it that way:
//   price + terms        -> src/components/Pricing.astro (price card)
//   gratis proefmaand    -> Pricing.astro (a price-card term) and src/pages/index.astro
//                           (meta description); still offered, confirmed by the owner,
//                           Iwan Stepanova, on 25 Sep 2026
//   what is included     -> Pricing.astro includes, Services.astro, HowItWorks.astro
//   no notice, no fine   -> src/data/faqs.ts
//   webdesign separate   -> Services.astro (own card), src/pages/webdesign.astro (no price)
//   who we are           -> src/pages/over.astro, Footer.astro, Founder.astro
// tests/ai-visibility.test.mjs fails if a price or term here drifts from the price card.
export const tariefFaqs = [
  {
    question: 'Wat kost Bureau Intake?',
    answer:
      '€590 per maand: één vast tarief voor lokale vindbaarheid. Het is maandelijks opzegbaar, er is geen jaarcontract en er zijn geen opstartkosten. Je begint met een gratis proefmaand.',
  },
  {
    question: 'Wat krijg ik voor €590 per maand?',
    answer:
      "Wij maken je praktijk zichtbaar in Google Maps en AI-zoekmachines. Daarvoor zorgen we voor een professioneel en compleet Google Bedrijfsprofiel, werken we aan meer en betere reviews van patiënten, zorgen we dat je naam, adres en telefoonnummer overal hetzelfde staan en optimaliseren we je bestaande website, zodat die gevonden wordt. Professionele praktijkfoto's zijn inbegrepen. Elke maand krijg je inzicht in wat het oplevert.",
  },
  {
    question: 'Zit ik ergens aan vast?',
    answer:
      'Nee. Er is geen jaarcontract: je kunt maandelijks opzeggen. Geen opzegtermijn, geen boete. Wij verdienen je vertrouwen elke maand opnieuw.',
  },
  {
    question: 'Is er een proefperiode?',
    answer:
      'Ja. Je begint met een gratis proefmaand. Geen verplichting totdat jij overtuigd bent. Ga je door, dan betaal je €590 per maand, maandelijks opzegbaar.',
  },
  {
    question: 'Valt een nieuwe website onder het tarief?',
    answer:
      'Nee. Het tarief is voor lokale vindbaarheid. Daarbinnen optimaliseren we je bestaande website, zodat Google en patiënten je beter vinden. Een nieuwe website laten bouwen is een aparte dienst. Wil je daar meer over weten, neem dan contact op.',
  },
  {
    question: 'Wat is Bureau Intake?',
    answer:
      'Bureau Intake is een marketingbureau dat uitsluitend werkt voor fysiotherapiepraktijken in Nederland. Wij maken praktijken zichtbaar in Google, Google Maps en AI-zoekmachines. Het bureau is gevestigd in Alkmaar en opgericht door Iwan Stepanova.',
  },
  {
    question: 'Hoe begin ik?',
    answer:
      'Plan een vrijblijvende kennismaking, telefonisch of op locatie. Daarin nemen we je situatie en je doelen door. Je bereikt ons via het contactformulier of via hallo@bureauintake.nl.',
  },
];
