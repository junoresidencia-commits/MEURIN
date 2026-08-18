// Banco de alimentos (seed curado) com nutrientes relevantes para nefrologia.
// Valores APROXIMADOS por 100 g de parte comestível, com base em tabelas brasileiras
// (TBCA/USP e TACO/UNICAMP). Fonte indicada por item. Não substitui a tabela oficial;
// serve para estimativa e educação. Ampliável por importação futura (TBCA completa).

export interface FoodItem {
  id: string;
  name: string;
  /** Estado do alimento (cru, cozido, etc.) — evita valores fixos sem contexto. */
  state?: string;
  source: "TBCA" | "TACO";
  /** Medida caseira de referência e seu peso em gramas (para porção). */
  measure?: string;
  measureGrams?: number;
  /** Por 100 g. */
  kcal: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
  sodium_mg: number;
  potassium_mg: number;
  phosphorus_mg: number;
  calcium_mg: number;
}

// Nutrientes calculados para uma porção em gramas.
export interface FoodPortionNutrients {
  grams: number;
  kcal: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
  sodium_mg: number;
  potassium_mg: number;
  phosphorus_mg: number;
  calcium_mg: number;
}

export const FOODS_BR: FoodItem[] = [
  // Frutas
  { id: "banana-nanica", name: "Banana nanica", state: "crua", source: "TACO", measure: "1 unidade média", measureGrams: 86, kcal: 92, protein_g: 1.4, carb_g: 23.8, fat_g: 0.1, sodium_mg: 0, potassium_mg: 376, phosphorus_mg: 27, calcium_mg: 3 },
  { id: "maca", name: "Maçã", state: "crua com casca", source: "TACO", measure: "1 unidade média", measureGrams: 130, kcal: 56, protein_g: 0.3, carb_g: 15.2, fat_g: 0, sodium_mg: 0, potassium_mg: 116, phosphorus_mg: 9, calcium_mg: 3 },
  { id: "mamao", name: "Mamão formosa", state: "cru", source: "TACO", measure: "1 fatia média", measureGrams: 130, kcal: 45, protein_g: 0.8, carb_g: 11.6, fat_g: 0.1, sodium_mg: 0, potassium_mg: 222, phosphorus_mg: 5, calcium_mg: 25 },
  { id: "laranja", name: "Laranja pera", state: "crua", source: "TACO", measure: "1 unidade média", measureGrams: 130, kcal: 37, protein_g: 1, carb_g: 8.9, fat_g: 0.1, sodium_mg: 0, potassium_mg: 163, phosphorus_mg: 18, calcium_mg: 22 },
  { id: "melancia", name: "Melancia", state: "crua", source: "TACO", measure: "1 fatia", measureGrams: 200, kcal: 33, protein_g: 0.9, carb_g: 8.1, fat_g: 0, sodium_mg: 0, potassium_mg: 104, phosphorus_mg: 11, calcium_mg: 8 },
  { id: "uva", name: "Uva itália", state: "crua", source: "TACO", measure: "1 cacho pequeno", measureGrams: 100, kcal: 53, protein_g: 0.7, carb_g: 13.6, fat_g: 0.2, sodium_mg: 0, potassium_mg: 162, phosphorus_mg: 15, calcium_mg: 4 },
  // Hortaliças / legumes
  { id: "batata-cozida", name: "Batata inglesa", state: "cozida", source: "TACO", measure: "1 unidade média", measureGrams: 100, kcal: 52, protein_g: 1.2, carb_g: 11.9, fat_g: 0, sodium_mg: 2, potassium_mg: 302, phosphorus_mg: 39, calcium_mg: 4 },
  { id: "arroz-branco", name: "Arroz branco", state: "cozido", source: "TACO", measure: "1 escumadeira", measureGrams: 80, kcal: 128, protein_g: 2.5, carb_g: 28.1, fat_g: 0.2, sodium_mg: 1, potassium_mg: 15, phosphorus_mg: 20, calcium_mg: 4 },
  { id: "feijao-carioca", name: "Feijão carioca", state: "cozido", source: "TACO", measure: "1 concha", measureGrams: 140, kcal: 76, protein_g: 4.8, carb_g: 13.6, fat_g: 0.5, sodium_mg: 2, potassium_mg: 256, phosphorus_mg: 88, calcium_mg: 27 },
  { id: "tomate", name: "Tomate", state: "cru", source: "TACO", measure: "1 unidade média", measureGrams: 90, kcal: 15, protein_g: 1.1, carb_g: 3.1, fat_g: 0.2, sodium_mg: 1, potassium_mg: 222, phosphorus_mg: 20, calcium_mg: 7 },
  { id: "alface", name: "Alface lisa", state: "crua", source: "TACO", measure: "2 folhas", measureGrams: 20, kcal: 11, protein_g: 1.3, carb_g: 1.7, fat_g: 0.2, sodium_mg: 7, potassium_mg: 267, phosphorus_mg: 31, calcium_mg: 38 },
  { id: "cenoura-cozida", name: "Cenoura", state: "cozida", source: "TACO", measure: "1 colher servir", measureGrams: 40, kcal: 30, protein_g: 0.8, carb_g: 6.7, fat_g: 0.2, sodium_mg: 5, potassium_mg: 172, phosphorus_mg: 15, calcium_mg: 23 },
  // Cereais e pães
  { id: "pao-frances", name: "Pão francês", state: "assado", source: "TACO", measure: "1 unidade", measureGrams: 50, kcal: 300, protein_g: 8, carb_g: 58.6, fat_g: 3.1, sodium_mg: 648, potassium_mg: 135, phosphorus_mg: 95, calcium_mg: 16 },
  { id: "macarrao", name: "Macarrão", state: "cozido", source: "TACO", measure: "1 pegador", measureGrams: 100, kcal: 111, protein_g: 3.4, carb_g: 23.1, fat_g: 0.6, sodium_mg: 1, potassium_mg: 24, phosphorus_mg: 33, calcium_mg: 6 },
  { id: "aveia", name: "Aveia em flocos", state: "crua", source: "TACO", measure: "1 colher sopa", measureGrams: 15, kcal: 394, protein_g: 13.9, carb_g: 66.6, fat_g: 8.5, sodium_mg: 5, potassium_mg: 336, phosphorus_mg: 153, calcium_mg: 48 },
  // Proteínas
  { id: "frango-peito", name: "Peito de frango", state: "grelhado", source: "TACO", measure: "1 filé médio", measureGrams: 100, kcal: 159, protein_g: 32, carb_g: 0, fat_g: 2.5, sodium_mg: 51, potassium_mg: 337, phosphorus_mg: 210, calcium_mg: 4 },
  { id: "carne-bovina", name: "Carne bovina (patinho)", state: "grelhada", source: "TACO", measure: "1 bife médio", measureGrams: 100, kcal: 219, protein_g: 35.9, carb_g: 0, fat_g: 7.3, sodium_mg: 52, potassium_mg: 440, phosphorus_mg: 226, calcium_mg: 4 },
  { id: "ovo", name: "Ovo de galinha", state: "cozido", source: "TACO", measure: "1 unidade", measureGrams: 50, kcal: 146, protein_g: 13.3, carb_g: 0.6, fat_g: 9.5, sodium_mg: 168, potassium_mg: 132, phosphorus_mg: 160, calcium_mg: 49 },
  { id: "tilapia", name: "Tilápia (filé)", state: "grelhada", source: "TACO", measure: "1 filé", measureGrams: 100, kcal: 129, protein_g: 26.2, carb_g: 0, fat_g: 2.3, sodium_mg: 52, potassium_mg: 302, phosphorus_mg: 205, calcium_mg: 14 },
  // Laticínios
  { id: "leite-integral", name: "Leite de vaca integral", state: "líquido", source: "TACO", measure: "1 copo", measureGrams: 200, kcal: 61, protein_g: 3.2, carb_g: 4.7, fat_g: 3.3, sodium_mg: 50, potassium_mg: 150, phosphorus_mg: 93, calcium_mg: 123 },
  { id: "queijo-minas", name: "Queijo minas frescal", state: "-", source: "TACO", measure: "1 fatia", measureGrams: 30, kcal: 264, protein_g: 17.4, carb_g: 3.2, fat_g: 20.2, sodium_mg: 30, potassium_mg: 60, phosphorus_mg: 360, calcium_mg: 579 },
  { id: "iogurte-natural", name: "Iogurte natural integral", state: "-", source: "TACO", measure: "1 pote", measureGrams: 170, kcal: 51, protein_g: 4.1, carb_g: 1.9, fat_g: 3, sodium_mg: 52, potassium_mg: 172, phosphorus_mg: 96, calcium_mg: 143 },
  // Ultraprocessados de referência (para alertas de sódio/fósforo)
  { id: "presunto", name: "Presunto", state: "processado", source: "TACO", measure: "2 fatias", measureGrams: 30, kcal: 94, protein_g: 14.4, carb_g: 3, fat_g: 2.5, sodium_mg: 1200, potassium_mg: 300, phosphorus_mg: 250, calcium_mg: 9 },
  { id: "refrigerante-cola", name: "Refrigerante cola", state: "líquido", source: "TBCA", measure: "1 lata", measureGrams: 350, kcal: 43, protein_g: 0, carb_g: 11, fat_g: 0, sodium_mg: 8, potassium_mg: 2, phosphorus_mg: 17, calcium_mg: 2 },
  { id: "miojo", name: "Macarrão instantâneo", state: "preparado", source: "TBCA", measure: "1 pacote", measureGrams: 80, kcal: 436, protein_g: 9, carb_g: 60, fat_g: 17, sodium_mg: 1800, potassium_mg: 130, phosphorus_mg: 110, calcium_mg: 20 },
];

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export function searchFoods(q: string, limit = 20): FoodItem[] {
  const term = norm(q || "");
  if (!term) return FOODS_BR.slice(0, limit);
  return FOODS_BR.filter((f) => norm(f.name).includes(term)).slice(0, limit);
}

export function getFood(id: string): FoodItem | undefined {
  return FOODS_BR.find((f) => f.id === id);
}

/** Calcula os nutrientes de uma porção (gramas) a partir dos valores por 100 g. */
export function nutrientsForGrams(food: FoodItem, grams: number): FoodPortionNutrients {
  const f = grams / 100;
  const r = (n: number) => Math.round(n * f * 10) / 10;
  const ri = (n: number) => Math.round(n * f);
  return {
    grams,
    kcal: ri(food.kcal),
    protein_g: r(food.protein_g),
    carb_g: r(food.carb_g),
    fat_g: r(food.fat_g),
    sodium_mg: ri(food.sodium_mg),
    potassium_mg: ri(food.potassium_mg),
    phosphorus_mg: ri(food.phosphorus_mg),
    calcium_mg: ri(food.calcium_mg),
  };
}
