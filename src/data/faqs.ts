// Single source of truth for the homepage FAQ.
// Used by both Pricing.astro (rendered) and index.astro (FAQPage JSON-LD)
// so the schema text always matches what Google sees on the page.
export const faqs = [
  {
    question: 'Hoe snel zie ik resultaat?',
    answer:
      'De eerste verbeteringen zie je binnen 2–4 weken. De grootste groei komt na 2–3 maanden — dat is hoe lokale vindbaarheid werkt.',
  },
  {
    question: 'Wat als het niet werkt?',
    answer:
      'Dan stop je. Geen opzegtermijn, geen boete. Wij verdienen je vertrouwen elke maand opnieuw.',
  },
  {
    question: 'Kan ik echt elk moment stoppen?',
    answer:
      'Ja. Maandelijks opzegbaar betekent precies dat. Geen kleine lettertjes, geen verborgen clausules.',
  },
  {
    question: 'Wat kost één extra patiënt mij?',
    answer:
      'Gemiddeld levert één nieuwe patiënt €270 aan omzet op (6 behandelingen × €45). Bij 3 extra patiënten per maand verdien je de investering ruim terug.',
  },
];
