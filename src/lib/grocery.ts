import { formatQuantity, isHeading, parseIngredient } from './ingredients';
import { CATEGORIES, type CategoryId, type GroceryItem } from './types';

export { CATEGORIES };

// Keywords match the start of a word ("paradižnik" matches "paradižniki").
// A trailing "=" means the whole word must match exactly ("sol=" does not match "solata").
// Lists cover English, Slovenian, German, Spanish, French, Italian, Portuguese and Croatian.
// Spices come first so "black pepper" isn't filed under vegetables.
const KEYWORDS: [CategoryId, string[]][] = [
  // Coconut milk is a pantry item, not milk.
  ['pantry', [
    'coconut milk', 'kokosmilch', 'leche de coco', 'lait de coco', 'latte di cocco', 'leite de coco',
    'kokosovo mleko', 'kokosovega mleka', 'kokosovo mlijeko', 'kokosovog mlijeka',
  ]],
  ['spices', [
    'sol=', 'soli=', 'salt=', 'salz', 'sal=', 'sel=', 'sale=',
    'poper', 'papar', 'black pepper', 'pepper flakes', 'pfeffer', 'pimienta', 'poivre', 'pepe=', 'pimenta',
    'cimet', 'cinnamon', 'zimt', 'canela', 'cannella', 'cannelle',
    'paprika v prahu', 'paprikapulver', 'pimentón', 'kumin', 'cumin', 'kreuzkümmel', 'comino', 'cominho',
    'origan', 'oregano', 'orégano', 'orégão', 'timijan', 'thyme', 'thymian', 'tomillo', 'thym', 'timo=', 'tomilho',
    'rožmarin', 'ružmarin', 'rosemary', 'rosmarin', 'romero', 'romarin', 'alecrim', 'kurkum', 'turmeric', 'cúrcuma',
    'curcuma', 'curry', 'caril', 'kari', 'muškatn', 'nutmeg', 'muskat', 'nuez moscada', 'muscade', 'noce moscata', 'noz-moscada',
    'vanilij', 'vanilla', 'vanille', 'vainilla', 'vaniglia', 'baunilha', 'ketchup', 'kečap', 'gorčic', 'senf',
    'mustard', 'mostaza', 'moutarde', 'senape', 'mostarda', 'majonez', 'mayo', 'mayonnaise', 'mayonesa', 'maionese',
    'sojin', 'soy sauce', 'sojasoße', 'sojasauce', 'salsa de soja', 'sauce soja', 'salsa di soia', 'molho de soja',
    'kis=', 'kisa=', 'ocat', 'octa=', 'vinegar', 'essig', 'vinagre', 'vinaigre', 'aceto', 'sriracha', 'pesto',
    'chili', 'čili', 'lovorov', 'lovor', 'bay leaf', 'lorbeer', 'laurel', 'laurier', 'alloro', 'louro',
    'začimb', 'spice', 'gewürz', 'especia', 'épice', 'spezi', 'especiaria', 'vegeta',
  ]],
  ['produce', [
    'paradižnik', 'rajčic', 'tomat', 'pomodor', 'čebul', 'onion', 'zwiebel', 'cebolla', 'oignon', 'cipoll', 'cebola',
    'luk=', 'luka=', 'shallot', 'schalotte', 'chalota', 'échalote', 'scalogn', 'česen', 'česna', 'češnjak', 'garlic',
    'knoblauch', 'ajo=', 'ajos=', 'ail=', 'aglio', 'alho', 'krompir', 'krumpir', 'potato', 'kartoffel', 'patata',
    'pomme de terre', 'pommes de terre', 'batata', 'korenj', 'mrkv', 'carrot', 'karotte', 'möhre', 'zanahori',
    'carotte', 'carot', 'cenour', 'paprik', 'bell pepper', 'pimiento', 'poivron', 'peperon', 'pimentão', 'pimento=', 'pimentos=',
    'kumar', 'krastav', 'cucumber', 'gurke', 'pepino', 'concombre', 'cetriol', 'solat', 'salat', 'lettuce', 'lechuga',
    'laitue', 'lattuga', 'alface', 'špinač', 'spinach', 'spinat', 'espinaca', 'épinard', 'spinaci', 'espinafre',
    'bučk', 'tikvic', 'zucchin', 'calabacín', 'courgette', 'curgete', 'buč', 'pumpkin', 'kürbis', 'calabaza',
    'potiron', 'citrouille', 'zucca', 'abóbora', 'jajčevec', 'patlidžan', 'eggplant', 'aubergine', 'berenjena',
    'melanzan', 'beringela', 'brokol', 'broccoli', 'brócoli', 'brocoli', 'brócolos', 'cvetač', 'cvjetač',
    'cauliflower', 'blumenkohl', 'coliflor', 'chou-fleur', 'cavolfiore', 'couve-flor', 'zelje', 'kupus', 'cabbage',
    'kohl=', 'col=', 'chou=', 'cavolo', 'couve', 'gob', 'gljiv', 'mushroom', 'pilz', 'champiñón', 'champignon', 'seta=',
    'setas=', 'fungh', 'cogumel', 'šampinjon', 'por=', 'poriluk', 'leek', 'lauch', 'puerro', 'poireau', 'porro',
    'alho-francês', 'zelen', 'celer', 'sellerie', 'apio', 'céleri', 'sedano', 'aipo', 'avokad', 'avocado', 'aguacate',
    'abacate', 'limon', 'lemon', 'zitrone', 'citron', 'limão', 'lime', 'limet', 'limett', 'lima=', 'jabolk', 'jabuk',
    'apple', 'apfel', 'äpfel', 'manzana', 'pomme', 'mela=', 'mele=', 'maçã', 'banan', 'plátano', 'jagod', 'strawberr',
    'erdbeer', 'fresa', 'fraise', 'fragol', 'morango', 'borovnic', 'blueberr', 'heidelbeer', 'arándano', 'myrtille',
    'mirtill', 'mirtilo', 'malin', 'raspberr', 'himbeer', 'frambues', 'framboise', 'lampon', 'framboesa',
    'pomaranč', 'naranč', 'orange', 'naranja', 'arancia', 'arance', 'laranja', 'grozdj', 'grožđ', 'grape', 'traube',
    'uva=', 'uvas=', 'raisin blanc', 'hrušk', 'krušk', 'pear', 'birne', 'pera=', 'peras=', 'poire', 'breskev',
    'breskv', 'peach', 'pfirsich', 'melocotón', 'pêche', 'pesca', 'pêssego', 'mang', 'ananas', 'pineapple', 'piña',
    'abacaxi', 'peteršilj', 'peršin', 'parsley', 'petersilie', 'perejil', 'persil', 'prezzemolo',
    'koriander', 'korijand', 'cilantro', 'coriandr', 'coriandol', 'coentro', 'meta=', 'metvic', 'mint', 'minze', 'menta', 'menthe', 'hortelã',
    'bazilik', 'bosiljak', 'basil', 'basilikum', 'albahaca', 'basilic', 'basilico', 'manjericão', 'drobnjak',
    'vlasac', 'chive', 'schnittlauch', 'cebollino', 'ciboulette', 'erba cipollina', 'cebolinho', 'ingver', 'đumbir',
    'ginger', 'ingwer', 'jengibre', 'gingembre', 'zenzero', 'gengibre', 'rukol', 'rikul', 'arugula', 'rucola',
    'rúcula', 'roquette', 'koruz', 'kukuruz', 'corn=', 'mais=', 'maíz', 'maïs', 'milho', 'grah', 'grašak', 'peas',
    'erbsen', 'guisante', 'petits pois', 'piselli', 'ervilha', 'stročj', 'mahun', 'green bean', 'grüne bohnen',
    'judía verde', 'haricots verts', 'fagiolini', 'feijão-verde', 'redkvic', 'rotkvic', 'radish', 'radieschen',
    'rábano', 'radis', 'ravanell', 'rabanete', 'rdeča pesa', 'cikl', 'beet', 'rote bete', 'remolacha', 'betterave',
    'barbabietol', 'beterraba', 'sladki krompir', 'sweet potato', 'süßkartoffel', 'boniato', 'patate douce',
    'kale', 'ohrovt', 'kelj', 'grünkohl', 'mladi luk', 'spring onion', 'scallion', 'frühlingszwiebel', 'cebolleta',
  ]],
  ['meat', [
    'piščan', 'piščanč', 'pilet', 'piletin', 'pileć', 'chicken', 'hähnchen', 'huhn', 'hühn', 'pollo', 'poulet', 'frango',
    'puran', 'purica', 'turkey', 'pute', 'truthahn', 'pavo', 'dinde', 'tacchino', 'peru=', 'govej', 'govedin',
    'junetin', 'beef', 'rind', 'ternera', 'vacuno', 'boeuf', 'bœuf', 'manzo', 'vaca=', 'svinj', 'pork', 'schwein',
    'cerdo', 'porc', 'maiale', 'porco', 'mlet', 'ground', 'hackfleisch', 'faschiert', 'carne picada', 'haché',
    'macinat', 'carne picada', 'slanin', 'bacon', 'speck', 'panceta', 'lardon', 'pancetta', 'pršut', 'prosciutto',
    'šunk', 'ham=', 'schinken', 'jamón', 'jambon', 'presunto', 'klobas', 'kobasic', 'sausage', 'wurst', 'würst',
    'salchich', 'saucisse', 'salsicc', 'chouriço', 'chorizo', 'salam', 'jagnj', 'janjet', 'lamb', 'lamm', 'cordero',
    'agneau', 'agnello', 'borrego', 'teleti', 'teletin', 'veal', 'kalb', 'veau', 'vitello', 'vitela', 'losos',
    'salmon', 'salmón', 'saumon', 'salmone', 'salmão', 'lachs', 'tun', 'tuna', 'thunfisch', 'atún', 'thon', 'tonno',
    'atum', 'riba', 'ribe', 'fish', 'fisch', 'pescado', 'poisson', 'pesce', 'peixe', 'kozic', 'škamp', 'shrimp',
    'prawn', 'garnele', 'gamba', 'crevette', 'gamber', 'camarão', 'camarões', 'oslič', 'oslić', 'bakalar', 'cod=',
    'kabeljau', 'bacalao', 'cabillaud', 'merluzzo', 'bacalhau', 'file', 'zrezek', 'odrezak', 'steak', 'čevapčič',
    'meso=', 'mesa=', 'fleisch', 'carne=', 'viande',
  ]],
  ['dairy', [
    'mlek', 'mlijek', 'milk', 'milch', 'leche', 'lait', 'latte', 'leite', 'jajc', 'jaja', 'jaje', 'egg', 'ei=', 'eier',
    'huevo', 'oeuf', 'œuf', 'uovo', 'uova', 'ovo=', 'ovos=', 'maslo', 'masla', 'maslac', 'butter', 'mantequilla',
    'beurre', 'burro=', 'manteiga', 'smetan', 'vrhnj', 'cream', 'sahne', 'nata=', 'crème', 'panna', 'natas=', 'jogurt',
    'joghurt', 'yogurt', 'yoghurt', 'yogur', 'yaourt', 'iogurte', 'sir=', 'sira=', 'siri=', 'cheese', 'käse', 'queso',
    'fromage', 'formaggi', 'queijo', 'parmezan', 'parmesan', 'parmigian', 'mozzarel', 'skut', 'quark', 'ricotta',
    'feta', 'mascarpone', 'kisla smetana', 'kiselo vrhnje', 'sour cream', 'schmand', 'saure sahne', 'kefir',
    'cottage', 'gouda', 'cheddar', 'emmental',
  ]],
  ['bakery', [
    'kruh', 'bread', 'brot', 'pan=', 'pain=', 'pane=', 'pão', 'toast', 'žemlj', 'peciv', 'bun=', 'buns=', 'brötchen',
    'semmel', 'panecillo', 'tortilj', 'tortilla', 'pita', 'bageta', 'baguette', 'listnato', 'lisnato', 'puff pastry',
    'blätterteig', 'hojaldre', 'pâte feuilletée', 'pasta sfoglia', 'massa folhada', 'testo za', 'tijesto za',
    'krušne drobtine', 'krušne mrvice', 'breadcrumb', 'semmelbrösel', 'paniermehl', 'pan rallado', 'chapelure',
    'pangrattato', 'pão ralado', 'drobtin', 'mrvic',
  ]],
  ['frozen', ['zamrznjen', 'smrznut', 'frozen', 'tiefkühl', 'gefroren', 'congelad', 'surgelé', 'surgelat', 'sladoled', 'ice cream', 'eis=', 'helado', 'glace', 'gelato', 'gelado']],
  ['drinks', [
    'vino', 'wine', 'wein', 'vin=', 'vinho', 'pivo', 'beer', 'bier', 'cerveza', 'bière', 'birra', 'cerveja', 'sok=',
    'juice', 'saft', 'zumo', 'jugo', 'jus=', 'succo', 'sumo=', 'kava', 'coffee', 'kaffee', 'café', 'caffè', 'čaj',
    'tea=', 'tee=', 'té=', 'thé', 'chá', 'mineraln', 'voda=', 'water=', 'wasser', 'agua=', 'eau=', 'acqua', 'água',
  ]],
  ['pantry', [
    'mok', 'brašn', 'flour', 'mehl', 'harina', 'farine', 'farina', 'farinha', 'sladkor', 'šećer', 'sugar', 'zucker',
    'azúcar', 'sucre', 'zucchero', 'açúcar', 'riž', 'rice', 'reis', 'arroz', 'riz=', 'riso=', 'testenin', 'tjestenin',
    'pasta', 'nudel', 'pâtes', 'massa=', 'špaget', 'spaghetti', 'espagueti', 'njok', 'gnocchi', 'olj', 'ulj', 'oil',
    'öl=', 'olivenöl', 'aceite', 'huile', 'olio', 'azeite', 'óleo', 'olivno', 'kvas', 'yeast', 'hefe', 'levadura',
    'levure', 'lievito', 'fermento', 'pecilni', 'prašak za pecivo', 'baking', 'backpulver', 'natron', 'polvo de hornear',
    'bicarbonat', 'soda bikarbon', 'med=', 'medu=', 'honey', 'honig', 'miel', 'miele', 'mel=', 'čokolad', 'chocolat',
    'schokolad', 'cioccolat', 'kakav', 'kakao', 'cocoa', 'cacao', 'cacau', 'oves', 'ovsen', 'zob', 'oat', 'hafer',
    'avena', 'avoine', 'flocchi', 'aveia', 'oreh', 'orah', 'walnut', 'walnuss', 'nuez', 'noix', 'noce=', 'noz=',
    'mandlj', 'badem', 'almond', 'mandel', 'almendra', 'amande', 'mandorl', 'amêndoa', 'lešnik', 'lješnjak', 'hazelnut',
    'haselnuss', 'avellana', 'noisette', 'nocciol', 'avelã', 'arašid', 'kikiriki', 'peanut', 'erdnuss', 'cacahuete',
    'maní', 'cacahuète', 'arachid', 'amendoim', 'fižol', 'grah=', 'bean', 'bohne', 'judía', 'alubia', 'frijol',
    'haricot', 'fagiol', 'feijão', 'čičerik', 'slanutak', 'chickpea', 'kichererbse', 'garbanzo', 'pois chiche',
    'ceci=', 'grão', 'leč', 'lentil', 'linse', 'lenteja', 'lentille', 'lenticchi', 'lentilha', 'kuskus', 'couscous',
    'cuscús', 'cuscuz', 'kvinoj', 'kvinoja', 'quinoa', 'jušn', 'temeljac', 'broth', 'stock', 'brühe', 'fond=',
    'caldo', 'bouillon', 'brodo', 'paradižnikova mezga', 'pelat', 'passata', 'tomato paste', 'tomatenmark',
    'concentrado de tomate', 'concentré de tomate', 'kokosov', 'coconut', 'kokos', 'coco=', 'noix de coco', 'cocco',
    'rozin', 'grožđic', 'raisin=', 'raisins=', 'rosine', 'pasa=', 'pasas=', 'uvetta', 'passa=', 'semen', 'sjemenk',
    'seed', 'samen', 'semilla', 'graine', 'semi=', 'semente', 'polent', 'zdrob', 'griz', 'grieß', 'sémola', 'semoule',
    'semolino', 'sêmola', 'škrob', 'gustin', 'cornstarch', 'stärke', 'maicena', 'maïzena', 'amido', 'želatin',
    'gelatin', 'gélatine', 'gelatina',
  ]],
];

const PRECOMPILED = KEYWORDS.map(([category, words]) => ({
  category,
  phrases: words.filter((w) => w.includes(' ')),
  exact: words.filter((w) => w.endsWith('=')).map((w) => w.slice(0, -1)),
  prefixes: words.filter((w) => !w.includes(' ') && !w.endsWith('=')),
}));

export function categorize(name: string): CategoryId {
  const text = name.toLowerCase();
  const words = text.split(/[^\p{L}-]+/u).filter(Boolean);
  for (const { category, phrases, exact, prefixes } of PRECOMPILED) {
    if (
      phrases.some((p) => text.includes(p)) ||
      exact.some((e) => words.includes(e)) ||
      prefixes.some((p) => words.some((w) => w.startsWith(p)))
    ) {
      return category;
    }
  }
  return 'other';
}

// Category names stored by the first, Slovenian-only version of the app.
const LEGACY_CATEGORIES: Record<string, CategoryId> = {
  'Sadje in zelenjava': 'produce',
  'Meso in ribe': 'meat',
  'Mlečni izdelki in jajca': 'dairy',
  'Kruh in pekovski izdelki': 'bakery',
  Shramba: 'pantry',
  'Začimbe in omake': 'spices',
  Zamrznjeno: 'frozen',
  Pijače: 'drinks',
  Drugo: 'other',
};

export function toCategoryId(value: string): CategoryId {
  return (CATEGORIES as readonly string[]).includes(value) ? (value as CategoryId) : LEGACY_CATEGORIES[value] ?? 'other';
}

/** Strips preparation notes so "čebula, drobno sesekljana" and "čebula" merge. */
export function normalizeName(name: string): string {
  return name
    .replace(/\([^)]*\)/g, '')
    .split(/,| - | – /)[0]
    .replace(/\s+/g, ' ')
    .trim();
}

// Metric units are converted to a base unit so "500 g" and "1 kg" add up.
const BASE_UNITS: Record<string, [string, number]> = {
  mg: ['g', 0.001], g: ['g', 1], kg: ['g', 1000],
  ml: ['ml', 1], cl: ['ml', 10], dl: ['ml', 100], l: ['ml', 1000],
};

function toBase(quantity: number | undefined, unitKey: string | undefined, unit: string | undefined) {
  const base = unitKey && BASE_UNITS[unitKey];
  if (base && quantity !== undefined) return { quantity: quantity * base[1], unit: base[0], key: base[0] };
  return { quantity, unit, key: unitKey ?? '' };
}

export function newId(): string {
  return crypto.randomUUID();
}

/**
 * Merges ingredient lines into an existing grocery list. Items with the same name and a
 * compatible unit are summed; everything else is added as a new item.
 */
export function addToGroceryList(
  list: GroceryItem[],
  lines: string[],
  factor = 1,
  recipeId?: string,
): GroceryItem[] {
  const result = list.map((item) => ({ ...item, recipeIds: [...item.recipeIds] }));
  for (const line of lines) {
    if (!line.trim() || isHeading(line)) continue;
    const parsed = parseIngredient(line);
    const name = normalizeName(parsed.name) || parsed.raw;
    const scaled = parsed.quantity !== undefined ? parsed.quantity * factor : undefined;
    const { quantity, unit, key } = toBase(scaled, parsed.unitKey, parsed.unit);
    const existing = result.find(
      (item) =>
        !item.checked &&
        item.name.toLowerCase() === name.toLowerCase() &&
        unitKeyOf(item) === key &&
        (item.quantity === undefined) === (quantity === undefined),
    );
    if (existing) {
      if (existing.quantity !== undefined && quantity !== undefined) existing.quantity += quantity;
      if (recipeId && !existing.recipeIds.includes(recipeId)) existing.recipeIds.push(recipeId);
    } else {
      result.push({
        id: newId(),
        name,
        quantity,
        unit,
        category: categorize(name),
        checked: false,
        recipeIds: recipeId ? [recipeId] : [],
      });
    }
  }
  return result;
}

function unitKeyOf(item: GroceryItem): string {
  if (!item.unit) return '';
  const parsed = parseIngredient(`1 ${item.unit} x`);
  return toBase(1, parsed.unitKey, item.unit).key || item.unit.toLowerCase();
}

export function formatGroceryAmount(item: GroceryItem, decimal = ','): string {
  if (item.quantity === undefined) return '';
  if (item.unit === 'g' && item.quantity >= 1000) return `${formatQuantity(item.quantity / 1000, decimal)} kg`;
  if (item.unit === 'ml' && item.quantity >= 1000) return `${formatQuantity(item.quantity / 1000, decimal)} l`;
  return [formatQuantity(item.quantity, decimal), item.unit].filter(Boolean).join(' ');
}

export function groceryListAsText(items: GroceryItem[], categoryLabel: (id: CategoryId) => string, decimal = ','): string {
  return CATEGORIES.map((category) => {
    const inCategory = items.filter((i) => i.category === category && !i.checked);
    if (!inCategory.length) return '';
    const lines = inCategory.map((i) => `• ${[formatGroceryAmount(i, decimal), i.name].filter(Boolean).join(' ')}`);
    return `${categoryLabel(category)}\n${lines.join('\n')}`;
  })
    .filter(Boolean)
    .join('\n\n');
}
