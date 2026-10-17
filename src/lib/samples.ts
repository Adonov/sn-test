import type { Recipe } from './types';

type Sample = Omit<Recipe, 'id' | 'favorite' | 'createdAt' | 'updatedAt'>;

export const SAMPLE_RECIPES: Sample[] = [
  {
    title: 'Palačinke',
    description: 'Klasične tanke palačinke za zajtrk ali sladico.',
    servings: 4,
    prepMinutes: 10,
    cookMinutes: 20,
    ingredients: ['250 g moke', '500 ml mleka', '2 jajci', '1 ščepec soli', '1 žlica sladkorja', '2 žlici olja'],
    steps: [
      'V skledi z metlico zmešaj moko, sol in sladkor.',
      'Postopoma prilivaj mleko in mešaj, da ni grudic. Dodaj jajci in olje.',
      'Testo pusti počivati 10 minut.',
      'Ponev segrej in jo rahlo naolji. Vlij zajemalko testa in ga razporedi po dnu.',
      'Peci približno 1 minuto na vsaki strani, dokler palačinka ni zlato rjava.',
    ],
    tags: ['sladica', 'zajtrk', 'vegetarijansko'],
  },
  {
    title: 'Piščančji curry s kokosovim mlekom',
    description: 'Hiter in kremast curry za delovni dan.',
    servings: 4,
    prepMinutes: 15,
    cookMinutes: 25,
    ingredients: [
      '600 g piščančjih prsi, narezanih na kocke',
      '1 čebula, sesekljana',
      '3 stroki česna',
      '1 žlica naribanega ingverja',
      '2 žlici curryja v prahu',
      '400 ml kokosovega mleka',
      '1 pločevinka paradižnika',
      '200 g riža',
      '1 ščepec soli',
      'svež koriander za serviranje',
    ],
    steps: [
      'Riž skuhaj po navodilih na embalaži.',
      'V ponvi na olju 5 minut prepražuj čebulo, nato dodaj česen in ingver.',
      'Dodaj piščanca in ga popeci z vseh strani. Potresi s curryjem.',
      'Prilij kokosovo mleko in paradižnik ter kuhaj 15 minut.',
      'Solí po okusu in postrezi z rižem in koriandrom.',
    ],
    tags: ['kosilo', 'večerja', 'hitro'],
  },
  {
    title: 'Grška solata',
    description: 'Sveža poletna solata s feto.',
    servings: 2,
    prepMinutes: 10,
    ingredients: [
      '3 paradižniki',
      '1 kumara',
      '1 rdeča čebula',
      '1 zelena paprika',
      '150 g feta sira',
      '12 črnih oliv',
      '3 žlice olivnega olja',
      '1 žlička origana',
    ],
    steps: [
      'Paradižnik, kumaro in papriko nareži na večje kose, čebulo na tanke kolobarje.',
      'Zelenjavo stresi v skledo, dodaj olive in na vrh položi feto.',
      'Pokapaj z olivnim oljem in potresi z origanom.',
    ],
    tags: ['solata', 'vegetarijansko', 'hitro'],
  },
];
