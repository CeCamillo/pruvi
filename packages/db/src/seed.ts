import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { subject } from "./schema/subjects";
import { question } from "./schema/questions";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const db = drizzle(DATABASE_URL);

interface SeedQuestion {
  content: string;
  options: string[];
  correctOptionIndex: number;
  difficulty: "easy" | "medium" | "hard";
  requiresCalculation: boolean;
  source: string;
}

const subjects = [
  { name: "Matemática", slug: "matematica" },
  { name: "Biologia", slug: "biologia" },
  { name: "Física", slug: "fisica" },
  { name: "Química", slug: "quimica" },
  { name: "Português", slug: "portugues" },
] as const;

const questionsBySubject: Record<string, SeedQuestion[]> = {
  matematica: [
    // --- EASY ---
    {
      content: "Qual é o valor de 2³?",
      options: ["4", "6", "8", "16"],
      correctOptionIndex: 2,
      difficulty: "easy",
      requiresCalculation: false,
      source: "ENEM 2019",
    },
    {
      content:
        "Se um produto custa R$ 80,00 e recebe um desconto de 25%, qual é o preço final?",
      options: ["R$ 55,00", "R$ 60,00", "R$ 65,00", "R$ 70,00"],
      correctOptionIndex: 1,
      difficulty: "easy",
      requiresCalculation: true,
      source: "ENEM 2020",
    },
    {
      content: "Qual é a área de um quadrado com lado de 5 cm?",
      options: ["10 cm²", "20 cm²", "25 cm²", "30 cm²"],
      correctOptionIndex: 2,
      difficulty: "easy",
      requiresCalculation: true,
      source: "ENEM 2018",
    },
    {
      content: "O número 0,75 equivale a qual fração?",
      options: ["1/2", "2/3", "3/4", "4/5"],
      correctOptionIndex: 2,
      difficulty: "easy",
      requiresCalculation: false,
      source: "ENEM 2019",
    },
    {
      content:
        "Em uma turma de 40 alunos, 60% são meninas. Quantos meninos há na turma?",
      options: ["12", "16", "20", "24"],
      correctOptionIndex: 1,
      difficulty: "easy",
      requiresCalculation: true,
      source: "ENEM 2021",
    },
    {
      content: "Qual é o valor de √144?",
      options: ["10", "11", "12", "14"],
      correctOptionIndex: 2,
      difficulty: "easy",
      requiresCalculation: false,
      source: "ENEM 2020",
    },
    {
      content:
        "Um retângulo tem base 8 cm e altura 3 cm. Qual é o seu perímetro?",
      options: ["22 cm", "24 cm", "11 cm", "16 cm"],
      correctOptionIndex: 0,
      difficulty: "easy",
      requiresCalculation: true,
      source: "ENEM 2019",
    },
    {
      content:
        "Se f(x) = 2x + 3, qual é o valor de f(4)?",
      options: ["8", "10", "11", "14"],
      correctOptionIndex: 2,
      difficulty: "easy",
      requiresCalculation: true,
      source: "ENEM 2022",
    },
    // --- MEDIUM ---
    {
      content:
        "Qual é a solução da equação 3x - 7 = 2x + 5?",
      options: ["x = 10", "x = 12", "x = -2", "x = 2"],
      correctOptionIndex: 1,
      difficulty: "medium",
      requiresCalculation: true,
      source: "ENEM 2021",
    },
    {
      content:
        "Um investimento rende 10% ao ano em juros simples. Qual é o montante após 3 anos de um capital de R$ 2.000,00?",
      options: [
        "R$ 2.200,00",
        "R$ 2.400,00",
        "R$ 2.600,00",
        "R$ 2.800,00",
      ],
      correctOptionIndex: 2,
      difficulty: "medium",
      requiresCalculation: true,
      source: "ENEM 2020",
    },
    {
      content: "Qual é o discriminante da equação x² - 5x + 6 = 0?",
      options: ["1", "-1", "25", "11"],
      correctOptionIndex: 0,
      difficulty: "medium",
      requiresCalculation: true,
      source: "ENEM 2022",
    },
    {
      content:
        "Em uma PA de razão 3, o primeiro termo é 2. Qual é o 10° termo?",
      options: ["27", "29", "30", "32"],
      correctOptionIndex: 1,
      difficulty: "medium",
      requiresCalculation: true,
      source: "ENEM 2021",
    },
    {
      content:
        "A probabilidade de tirar um número par ao lançar um dado honesto é:",
      options: ["1/6", "1/3", "1/2", "2/3"],
      correctOptionIndex: 2,
      difficulty: "medium",
      requiresCalculation: false,
      source: "ENEM 2019",
    },
    {
      content:
        "Se log₁₀(x) = 3, qual é o valor de x?",
      options: ["30", "100", "300", "1000"],
      correctOptionIndex: 3,
      difficulty: "medium",
      requiresCalculation: false,
      source: "ENEM 2020",
    },
    {
      content:
        "O volume de um cubo com aresta de 4 cm é:",
      options: ["16 cm³", "32 cm³", "48 cm³", "64 cm³"],
      correctOptionIndex: 3,
      difficulty: "medium",
      requiresCalculation: true,
      source: "ENEM 2022",
    },
    {
      content:
        "Em um triângulo retângulo com catetos de 3 e 4, qual é a hipotenusa?",
      options: ["5", "6", "7", "√7"],
      correctOptionIndex: 0,
      difficulty: "medium",
      requiresCalculation: true,
      source: "ENEM 2021",
    },
    // --- HARD ---
    {
      content:
        "Qual é a soma dos 20 primeiros termos de uma PA onde a₁ = 3 e a₂₀ = 60?",
      options: ["600", "630", "660", "690"],
      correctOptionIndex: 1,
      difficulty: "hard",
      requiresCalculation: true,
      source: "ENEM 2022",
    },
    {
      content:
        "Quantos anagramas podem ser formados com a palavra AMOR?",
      options: ["12", "16", "24", "36"],
      correctOptionIndex: 2,
      difficulty: "hard",
      requiresCalculation: true,
      source: "ENEM 2021",
    },
    {
      content:
        "Um cone tem raio da base 3 cm e altura 4 cm. Qual é seu volume? (use π ≈ 3,14)",
      options: [
        "12,56 cm³",
        "25,12 cm³",
        "37,68 cm³",
        "50,24 cm³",
      ],
      correctOptionIndex: 2,
      difficulty: "hard",
      requiresCalculation: true,
      source: "ENEM 2020",
    },
    {
      content:
        "Resolva o sistema: { 2x + y = 10, x - y = 2 }. O valor de x é:",
      options: ["3", "4", "5", "6"],
      correctOptionIndex: 1,
      difficulty: "hard",
      requiresCalculation: true,
      source: "ENEM 2022",
    },
    {
      content:
        "Uma função quadrática tem vértice em (2, -3) e passa por (0, 1). O coeficiente 'a' vale:",
      options: ["-1", "1", "-2", "2"],
      correctOptionIndex: 1,
      difficulty: "hard",
      requiresCalculation: true,
      source: "ENEM 2021",
    },
    {
      content:
        "A derivada de f(x) = x³ - 3x² + 2x no ponto x = 1 é:",
      options: ["-1", "0", "1", "2"],
      correctOptionIndex: 0,
      difficulty: "hard",
      requiresCalculation: true,
      source: "ENEM 2022",
    },
  ],
  biologia: [
    // --- EASY ---
    {
      content: "Qual organela é responsável pela respiração celular?",
      options: [
        "Ribossomo",
        "Mitocôndria",
        "Complexo de Golgi",
        "Lisossomo",
      ],
      correctOptionIndex: 1,
      difficulty: "easy",
      requiresCalculation: false,
      source: "ENEM 2019",
    },
    {
      content: "O DNA é formado por qual tipo de molécula?",
      options: ["Proteínas", "Lipídios", "Nucleotídeos", "Carboidratos"],
      correctOptionIndex: 2,
      difficulty: "easy",
      requiresCalculation: false,
      source: "ENEM 2020",
    },
    {
      content:
        "Qual é o processo pelo qual as plantas produzem seu próprio alimento?",
      options: [
        "Respiração celular",
        "Fermentação",
        "Fotossíntese",
        "Quimiossíntese",
      ],
      correctOptionIndex: 2,
      difficulty: "easy",
      requiresCalculation: false,
      source: "ENEM 2018",
    },
    {
      content: "As hemácias são responsáveis pelo transporte de:",
      options: ["Nutrientes", "Oxigênio", "Hormônios", "Anticorpos"],
      correctOptionIndex: 1,
      difficulty: "easy",
      requiresCalculation: false,
      source: "ENEM 2019",
    },
    {
      content: "Qual é o maior órgão do corpo humano?",
      options: ["Fígado", "Pulmão", "Pele", "Intestino"],
      correctOptionIndex: 2,
      difficulty: "easy",
      requiresCalculation: false,
      source: "ENEM 2021",
    },
    {
      content: "O sistema nervoso central é formado por:",
      options: [
        "Encéfalo e medula espinhal",
        "Nervos e gânglios",
        "Simpático e parassimpático",
        "Neurônios e glias",
      ],
      correctOptionIndex: 0,
      difficulty: "easy",
      requiresCalculation: false,
      source: "ENEM 2020",
    },
    {
      content: "As bactérias são organismos classificados como:",
      options: ["Eucariotos", "Procariotos", "Vírus", "Fungos"],
      correctOptionIndex: 1,
      difficulty: "easy",
      requiresCalculation: false,
      source: "ENEM 2022",
    },
    {
      content: "O coração humano possui quantas câmaras?",
      options: ["2", "3", "4", "5"],
      correctOptionIndex: 2,
      difficulty: "easy",
      requiresCalculation: false,
      source: "ENEM 2019",
    },
    // --- MEDIUM ---
    {
      content:
        "Na meiose, o crossing-over ocorre durante qual fase?",
      options: [
        "Prófase I",
        "Metáfase I",
        "Anáfase II",
        "Telófase II",
      ],
      correctOptionIndex: 0,
      difficulty: "medium",
      requiresCalculation: false,
      source: "ENEM 2021",
    },
    {
      content:
        "Qual é a relação ecológica entre o peixe-palhaço e a anêmona?",
      options: [
        "Parasitismo",
        "Comensalismo",
        "Mutualismo",
        "Competição",
      ],
      correctOptionIndex: 2,
      difficulty: "medium",
      requiresCalculation: false,
      source: "ENEM 2020",
    },
    {
      content:
        "O ciclo de Krebs ocorre em qual compartimento celular?",
      options: [
        "Citoplasma",
        "Núcleo",
        "Matriz mitocondrial",
        "Retículo endoplasmático",
      ],
      correctOptionIndex: 2,
      difficulty: "medium",
      requiresCalculation: false,
      source: "ENEM 2022",
    },
    {
      content:
        "A seleção natural proposta por Darwin é baseada em:",
      options: [
        "Uso e desuso dos órgãos",
        "Herança de caracteres adquiridos",
        "Variação e sobrevivência diferencial",
        "Mutação dirigida",
      ],
      correctOptionIndex: 2,
      difficulty: "medium",
      requiresCalculation: false,
      source: "ENEM 2019",
    },
    {
      content:
        "O tipo sanguíneo é determinado por um sistema com três alelos: IA, IB e i. Quantos genótipos são possíveis?",
      options: ["3", "4", "6", "8"],
      correctOptionIndex: 2,
      difficulty: "medium",
      requiresCalculation: false,
      source: "ENEM 2021",
    },
    {
      content:
        "A eutrofização de um lago é causada principalmente por:",
      options: [
        "Metais pesados",
        "Excesso de nutrientes (N e P)",
        "Radiação ultravioleta",
        "Chuva ácida",
      ],
      correctOptionIndex: 1,
      difficulty: "medium",
      requiresCalculation: false,
      source: "ENEM 2020",
    },
    {
      content:
        "A enzima DNA polimerase atua na:",
      options: [
        "Transcrição do RNA",
        "Tradução de proteínas",
        "Replicação do DNA",
        "Splicing do mRNA",
      ],
      correctOptionIndex: 2,
      difficulty: "medium",
      requiresCalculation: false,
      source: "ENEM 2022",
    },
    {
      content:
        "O bioma Cerrado é caracterizado por:",
      options: [
        "Árvores de grande porte e dossel fechado",
        "Vegetação rasteira e arbustiva com troncos retorcidos",
        "Mangues e restingas",
        "Florestas de coníferas",
      ],
      correctOptionIndex: 1,
      difficulty: "medium",
      requiresCalculation: false,
      source: "ENEM 2021",
    },
    // --- HARD ---
    {
      content:
        "Na técnica de PCR (Reação em Cadeia da Polimerase), a enzima utilizada é a Taq polimerase porque:",
      options: [
        "É mais barata que outras polimerases",
        "Funciona em temperatura ambiente",
        "É termorresistente, suportando ciclos de alta temperatura",
        "Não precisa de primers para funcionar",
      ],
      correctOptionIndex: 2,
      difficulty: "hard",
      requiresCalculation: false,
      source: "ENEM 2022",
    },
    {
      content:
        "A teoria endossimbiótica explica a origem de:",
      options: [
        "Ribossomos e lisossomos",
        "Mitocôndrias e cloroplastos",
        "Retículo endoplasmático e complexo de Golgi",
        "Citoesqueleto e centríolos",
      ],
      correctOptionIndex: 1,
      difficulty: "hard",
      requiresCalculation: false,
      source: "ENEM 2021",
    },
    {
      content:
        "O efeito fundador é um caso especial de:",
      options: [
        "Seleção natural",
        "Mutação",
        "Deriva genética",
        "Migração",
      ],
      correctOptionIndex: 2,
      difficulty: "hard",
      requiresCalculation: false,
      source: "ENEM 2020",
    },
    {
      content:
        "Na cadeia respiratória, o aceptor final de elétrons é:",
      options: ["NAD+", "FAD", "O₂", "CO₂"],
      correctOptionIndex: 2,
      difficulty: "hard",
      requiresCalculation: false,
      source: "ENEM 2022",
    },
    {
      content:
        "A síndrome de Down é causada por uma trissomia do cromossomo:",
      options: ["13", "18", "21", "23"],
      correctOptionIndex: 2,
      difficulty: "hard",
      requiresCalculation: false,
      source: "ENEM 2019",
    },
    {
      content:
        "O processo de transcrição reversa é realizado por qual enzima?",
      options: [
        "RNA polimerase",
        "DNA polimerase",
        "Transcriptase reversa",
        "Helicase",
      ],
      correctOptionIndex: 2,
      difficulty: "hard",
      requiresCalculation: false,
      source: "ENEM 2021",
    },
  ],
  fisica: [
    // --- EASY ---
    {
      content: "Qual é a unidade de medida de força no SI?",
      options: ["Joule", "Newton", "Watt", "Pascal"],
      correctOptionIndex: 1,
      difficulty: "easy",
      requiresCalculation: false,
      source: "ENEM 2019",
    },
    {
      content:
        "Um carro percorre 120 km em 2 horas. Qual é sua velocidade média?",
      options: ["40 km/h", "50 km/h", "60 km/h", "80 km/h"],
      correctOptionIndex: 2,
      difficulty: "easy",
      requiresCalculation: true,
      source: "ENEM 2020",
    },
    {
      content:
        "A aceleração da gravidade na superfície da Terra é aproximadamente:",
      options: ["5 m/s²", "8 m/s²", "10 m/s²", "15 m/s²"],
      correctOptionIndex: 2,
      difficulty: "easy",
      requiresCalculation: false,
      source: "ENEM 2018",
    },
    {
      content: "Qual tipo de energia está associado ao movimento?",
      options: [
        "Energia potencial",
        "Energia cinética",
        "Energia térmica",
        "Energia nuclear",
      ],
      correctOptionIndex: 1,
      difficulty: "easy",
      requiresCalculation: false,
      source: "ENEM 2019",
    },
    {
      content:
        "Um objeto de 5 kg está em repouso sobre uma mesa. Qual é seu peso? (g = 10 m/s²)",
      options: ["5 N", "10 N", "50 N", "500 N"],
      correctOptionIndex: 2,
      difficulty: "easy",
      requiresCalculation: true,
      source: "ENEM 2021",
    },
    {
      content: "A velocidade da luz no vácuo é aproximadamente:",
      options: [
        "3 × 10⁶ m/s",
        "3 × 10⁸ m/s",
        "3 × 10¹⁰ m/s",
        "3 × 10¹² m/s",
      ],
      correctOptionIndex: 1,
      difficulty: "easy",
      requiresCalculation: false,
      source: "ENEM 2020",
    },
    {
      content:
        "Segundo a 1ª Lei de Newton, um corpo em repouso tende a:",
      options: [
        "Acelerar",
        "Permanecer em repouso",
        "Desacelerar",
        "Mudar de direção",
      ],
      correctOptionIndex: 1,
      difficulty: "easy",
      requiresCalculation: false,
      source: "ENEM 2022",
    },
    {
      content: "A unidade de potência no SI é:",
      options: ["Joule", "Newton", "Watt", "Volt"],
      correctOptionIndex: 2,
      difficulty: "easy",
      requiresCalculation: false,
      source: "ENEM 2019",
    },
    // --- MEDIUM ---
    {
      content:
        "Um projétil é lançado horizontalmente de uma altura de 80 m. Quanto tempo leva para atingir o solo? (g = 10 m/s²)",
      options: ["2 s", "4 s", "8 s", "16 s"],
      correctOptionIndex: 1,
      difficulty: "medium",
      requiresCalculation: true,
      source: "ENEM 2021",
    },
    {
      content:
        "Qual é a energia cinética de um objeto de 2 kg movendo-se a 10 m/s?",
      options: ["20 J", "50 J", "100 J", "200 J"],
      correctOptionIndex: 2,
      difficulty: "medium",
      requiresCalculation: true,
      source: "ENEM 2020",
    },
    {
      content:
        "Uma onda sonora tem frequência de 340 Hz e velocidade de 340 m/s. Qual é seu comprimento de onda?",
      options: ["0,5 m", "1 m", "2 m", "10 m"],
      correctOptionIndex: 1,
      difficulty: "medium",
      requiresCalculation: true,
      source: "ENEM 2022",
    },
    {
      content:
        "A 2ª Lei de Newton estabelece que F = m·a. Qual é a aceleração de um corpo de 4 kg submetido a uma força de 20 N?",
      options: ["4 m/s²", "5 m/s²", "10 m/s²", "80 m/s²"],
      correctOptionIndex: 1,
      difficulty: "medium",
      requiresCalculation: true,
      source: "ENEM 2021",
    },
    {
      content:
        "Em um circuito elétrico, a resistência equivalente de dois resistores de 6 Ω em paralelo é:",
      options: ["3 Ω", "6 Ω", "12 Ω", "36 Ω"],
      correctOptionIndex: 0,
      difficulty: "medium",
      requiresCalculation: true,
      source: "ENEM 2020",
    },
    {
      content:
        "O fenômeno da refração ocorre quando a luz:",
      options: [
        "É refletida por uma superfície",
        "Muda de meio e altera sua velocidade",
        "É absorvida por um material",
        "Sofre interferência destrutiva",
      ],
      correctOptionIndex: 1,
      difficulty: "medium",
      requiresCalculation: false,
      source: "ENEM 2022",
    },
    {
      content:
        "A pressão exercida por uma coluna de água de 10 m de altura é: (ρ = 1000 kg/m³, g = 10 m/s²)",
      options: ["10⁴ Pa", "10⁵ Pa", "10⁶ Pa", "10³ Pa"],
      correctOptionIndex: 0,
      difficulty: "medium",
      requiresCalculation: true,
      source: "ENEM 2021",
    },
    {
      content:
        "A eficiência de uma máquina térmica que absorve 500 J e realiza 200 J de trabalho é:",
      options: ["20%", "30%", "40%", "60%"],
      correctOptionIndex: 2,
      difficulty: "medium",
      requiresCalculation: true,
      source: "ENEM 2020",
    },
    // --- HARD ---
    {
      content:
        "Um satélite orbita a Terra a uma altitude onde g = 4 m/s². Se a massa do satélite é 500 kg, qual é a força gravitacional sobre ele?",
      options: ["1000 N", "2000 N", "4000 N", "5000 N"],
      correctOptionIndex: 1,
      difficulty: "hard",
      requiresCalculation: true,
      source: "ENEM 2022",
    },
    {
      content:
        "Na equação de Einstein E = mc², se a massa convertida é 1 kg, qual é a energia liberada? (c = 3 × 10⁸ m/s)",
      options: ["3 × 10⁸ J", "9 × 10⁸ J", "9 × 10¹⁶ J", "3 × 10¹⁶ J"],
      correctOptionIndex: 2,
      difficulty: "hard",
      requiresCalculation: true,
      source: "ENEM 2021",
    },
    {
      content:
        "O efeito fotoelétrico comprova que a luz tem natureza:",
      options: [
        "Ondulatória",
        "Corpuscular",
        "Mecânica",
        "Eletromagnética contínua",
      ],
      correctOptionIndex: 1,
      difficulty: "hard",
      requiresCalculation: false,
      source: "ENEM 2020",
    },
    {
      content:
        "Um transformador ideal tem 200 espiras no primário e 1000 no secundário. Se a tensão no primário é 110 V, qual é a tensão no secundário?",
      options: ["22 V", "110 V", "550 V", "1100 V"],
      correctOptionIndex: 2,
      difficulty: "hard",
      requiresCalculation: true,
      source: "ENEM 2022",
    },
    {
      content:
        "Na dilatação linear, uma barra de aço de 2 m com coeficiente α = 12 × 10⁻⁶ °C⁻¹ sofre aquecimento de 50°C. Qual é a variação de comprimento?",
      options: ["0,6 mm", "1,2 mm", "2,4 mm", "12 mm"],
      correctOptionIndex: 1,
      difficulty: "hard",
      requiresCalculation: true,
      source: "ENEM 2021",
    },
    {
      content:
        "O princípio da incerteza de Heisenberg afirma que é impossível determinar simultaneamente com precisão:",
      options: [
        "Massa e velocidade",
        "Posição e momento",
        "Energia e temperatura",
        "Carga e campo elétrico",
      ],
      correctOptionIndex: 1,
      difficulty: "hard",
      requiresCalculation: false,
      source: "ENEM 2022",
    },
  ],
  quimica: [
    // --- EASY ---
    {
      content: "Qual é o símbolo químico do ouro?",
      options: ["Ag", "Au", "Or", "Go"],
      correctOptionIndex: 1,
      difficulty: "easy",
      requiresCalculation: false,
      source: "ENEM 2019",
    },
    {
      content: "A água (H₂O) é formada por quantos átomos?",
      options: ["1", "2", "3", "4"],
      correctOptionIndex: 2,
      difficulty: "easy",
      requiresCalculation: false,
      source: "ENEM 2020",
    },
    {
      content: "Qual é o pH de uma solução neutra a 25°C?",
      options: ["0", "1", "7", "14"],
      correctOptionIndex: 2,
      difficulty: "easy",
      requiresCalculation: false,
      source: "ENEM 2018",
    },
    {
      content: "A tabela periódica organiza os elementos por:",
      options: [
        "Ordem alfabética",
        "Número atômico crescente",
        "Massa molecular",
        "Data de descoberta",
      ],
      correctOptionIndex: 1,
      difficulty: "easy",
      requiresCalculation: false,
      source: "ENEM 2019",
    },
    {
      content: "Qual gás é essencial para a combustão?",
      options: ["Nitrogênio", "Hélio", "Oxigênio", "Hidrogênio"],
      correctOptionIndex: 2,
      difficulty: "easy",
      requiresCalculation: false,
      source: "ENEM 2021",
    },
    {
      content: "O número atômico do carbono é:",
      options: ["4", "6", "8", "12"],
      correctOptionIndex: 1,
      difficulty: "easy",
      requiresCalculation: false,
      source: "ENEM 2020",
    },
    {
      content: "As ligações iônicas ocorrem entre:",
      options: [
        "Dois metais",
        "Dois não-metais",
        "Um metal e um não-metal",
        "Dois gases nobres",
      ],
      correctOptionIndex: 2,
      difficulty: "easy",
      requiresCalculation: false,
      source: "ENEM 2022",
    },
    {
      content: "A fórmula do gás carbônico é:",
      options: ["CO", "CO₂", "C₂O", "CO₃"],
      correctOptionIndex: 1,
      difficulty: "easy",
      requiresCalculation: false,
      source: "ENEM 2019",
    },
    // --- MEDIUM ---
    {
      content:
        "Qual é a massa molar da água (H₂O)? (H = 1, O = 16)",
      options: ["16 g/mol", "17 g/mol", "18 g/mol", "20 g/mol"],
      correctOptionIndex: 2,
      difficulty: "medium",
      requiresCalculation: true,
      source: "ENEM 2021",
    },
    {
      content:
        "Na reação de neutralização HCl + NaOH → NaCl + H₂O, o sal formado é:",
      options: [
        "Ácido",
        "Básico",
        "Neutro",
        "Anfótero",
      ],
      correctOptionIndex: 2,
      difficulty: "medium",
      requiresCalculation: false,
      source: "ENEM 2020",
    },
    {
      content:
        "Quantos mols de CO₂ são produzidos na combustão completa de 1 mol de CH₄? CH₄ + 2O₂ → CO₂ + 2H₂O",
      options: ["0,5 mol", "1 mol", "2 mol", "3 mol"],
      correctOptionIndex: 1,
      difficulty: "medium",
      requiresCalculation: false,
      source: "ENEM 2022",
    },
    {
      content:
        "A geometria molecular da água (H₂O) é:",
      options: ["Linear", "Angular", "Trigonal plana", "Tetraédrica"],
      correctOptionIndex: 1,
      difficulty: "medium",
      requiresCalculation: false,
      source: "ENEM 2021",
    },
    {
      content:
        "O número de oxidação do manganês no KMnO₄ é:",
      options: ["+2", "+4", "+5", "+7"],
      correctOptionIndex: 3,
      difficulty: "medium",
      requiresCalculation: true,
      source: "ENEM 2020",
    },
    {
      content:
        "Uma solução com concentração de 0,5 mol/L de NaCl contém quantos mols em 2 litros?",
      options: ["0,25 mol", "0,5 mol", "1 mol", "2 mol"],
      correctOptionIndex: 2,
      difficulty: "medium",
      requiresCalculation: true,
      source: "ENEM 2022",
    },
    {
      content:
        "O fenômeno da chuva ácida está relacionado à emissão de:",
      options: [
        "CO₂ e CH₄",
        "SO₂ e NOₓ",
        "O₃ e CFC",
        "CO e H₂S",
      ],
      correctOptionIndex: 1,
      difficulty: "medium",
      requiresCalculation: false,
      source: "ENEM 2021",
    },
    {
      content:
        "Isômeros são compostos com mesma fórmula molecular mas:",
      options: [
        "Mesmo ponto de fusão",
        "Mesma estrutura",
        "Estruturas diferentes",
        "Mesmo número atômico",
      ],
      correctOptionIndex: 2,
      difficulty: "medium",
      requiresCalculation: false,
      source: "ENEM 2020",
    },
    // --- HARD ---
    {
      content:
        "Segundo a lei de Hess, a variação de entalpia de uma reação depende:",
      options: [
        "Do caminho da reação",
        "Apenas dos estados inicial e final",
        "Da velocidade da reação",
        "Da pressão ambiente",
      ],
      correctOptionIndex: 1,
      difficulty: "hard",
      requiresCalculation: false,
      source: "ENEM 2022",
    },
    {
      content:
        "A constante de equilíbrio Kc para a reação N₂ + 3H₂ ⇌ 2NH₃ é expressa como:",
      options: [
        "[NH₃]² / ([N₂][H₂]³)",
        "[N₂][H₂]³ / [NH₃]²",
        "[NH₃] / ([N₂][H₂])",
        "2[NH₃] / ([N₂] + 3[H₂])",
      ],
      correctOptionIndex: 0,
      difficulty: "hard",
      requiresCalculation: false,
      source: "ENEM 2021",
    },
    {
      content:
        "Na eletrólise da água, qual gás é produzido no cátodo?",
      options: ["Oxigênio", "Hidrogênio", "Cloro", "Nitrogênio"],
      correctOptionIndex: 1,
      difficulty: "hard",
      requiresCalculation: false,
      source: "ENEM 2020",
    },
    {
      content:
        "O polímero PET (politereftalato de etileno) é formado por reação de:",
      options: [
        "Adição",
        "Condensação",
        "Substituição",
        "Eliminação",
      ],
      correctOptionIndex: 1,
      difficulty: "hard",
      requiresCalculation: false,
      source: "ENEM 2022",
    },
    {
      content:
        "A hibridização do carbono no metano (CH₄) é:",
      options: ["sp", "sp²", "sp³", "sp³d"],
      correctOptionIndex: 2,
      difficulty: "hard",
      requiresCalculation: false,
      source: "ENEM 2021",
    },
    {
      content:
        "Qual é a concentração de íons H⁺ em uma solução com pH = 3?",
      options: ["10⁻¹ mol/L", "10⁻³ mol/L", "10⁻⁷ mol/L", "3 mol/L"],
      correctOptionIndex: 1,
      difficulty: "hard",
      requiresCalculation: false,
      source: "ENEM 2020",
    },
  ],
  portugues: [
    // --- EASY ---
    {
      content:
        'Na frase "Os meninos correram para o parque", qual é o sujeito?',
      options: ["correram", "para o parque", "Os meninos", "o parque"],
      correctOptionIndex: 2,
      difficulty: "easy",
      requiresCalculation: false,
      source: "ENEM 2019",
    },
    {
      content: 'O plural de "cidadão" é:',
      options: ["cidadãos", "cidadões", "cidadães", "cidadãs"],
      correctOptionIndex: 0,
      difficulty: "easy",
      requiresCalculation: false,
      source: "ENEM 2020",
    },
    {
      content: 'Qual é a classe gramatical da palavra "rapidamente"?',
      options: ["Adjetivo", "Advérbio", "Substantivo", "Verbo"],
      correctOptionIndex: 1,
      difficulty: "easy",
      requiresCalculation: false,
      source: "ENEM 2018",
    },
    {
      content: 'Em "Ela comprou um vestido bonito", "bonito" é um:',
      options: [
        "Substantivo",
        "Advérbio",
        "Adjetivo",
        "Pronome",
      ],
      correctOptionIndex: 2,
      difficulty: "easy",
      requiresCalculation: false,
      source: "ENEM 2019",
    },
    {
      content: 'A palavra "imprevisível" possui qual prefixo?',
      options: ["pre-", "im-", "vel-", "ível-"],
      correctOptionIndex: 1,
      difficulty: "easy",
      requiresCalculation: false,
      source: "ENEM 2021",
    },
    {
      content:
        'Qual figura de linguagem está presente em "Ela é uma flor"?',
      options: ["Metonímia", "Hipérbole", "Metáfora", "Ironia"],
      correctOptionIndex: 2,
      difficulty: "easy",
      requiresCalculation: false,
      source: "ENEM 2020",
    },
    {
      content: 'O verbo "fazer" na terceira pessoa do pretérito perfeito é:',
      options: ["fazia", "fez", "faz", "fizera"],
      correctOptionIndex: 1,
      difficulty: "easy",
      requiresCalculation: false,
      source: "ENEM 2022",
    },
    {
      content: "Sinônimo de 'perspicaz' é:",
      options: ["Lento", "Astuto", "Tímido", "Generoso"],
      correctOptionIndex: 1,
      difficulty: "easy",
      requiresCalculation: false,
      source: "ENEM 2019",
    },
    // --- MEDIUM ---
    {
      content:
        'Em "Chovia muito quando saímos", a oração subordinada é:',
      options: [
        "Chovia muito",
        "quando saímos",
        "Chovia quando",
        "muito quando saímos",
      ],
      correctOptionIndex: 1,
      difficulty: "medium",
      requiresCalculation: false,
      source: "ENEM 2021",
    },
    {
      content:
        'Qual é a função sintática de "de chocolate" em "O bolo de chocolate é gostoso"?',
      options: [
        "Adjunto adverbial",
        "Complemento nominal",
        "Adjunto adnominal",
        "Predicativo do sujeito",
      ],
      correctOptionIndex: 2,
      difficulty: "medium",
      requiresCalculation: false,
      source: "ENEM 2020",
    },
    {
      content:
        'O uso da crase é obrigatório em qual alternativa?',
      options: [
        "Fui a Roma",
        "Refiro-me à questão levantada",
        "Ele saiu a pé",
        "Cheguei a casa",
      ],
      correctOptionIndex: 1,
      difficulty: "medium",
      requiresCalculation: false,
      source: "ENEM 2022",
    },
    {
      content:
        "O Modernismo brasileiro de 1922 tinha como principal objetivo:",
      options: [
        "Valorizar a estética parnasiana",
        "Romper com os padrões acadêmicos da arte",
        "Retomar os ideais do Arcadismo",
        "Imitar a literatura europeia",
      ],
      correctOptionIndex: 1,
      difficulty: "medium",
      requiresCalculation: false,
      source: "ENEM 2021",
    },
    {
      content:
        'Em "Os alunos cujos pais compareceram...", "cujos" é um pronome:',
      options: [
        "Demonstrativo",
        "Indefinido",
        "Relativo",
        "Pessoal",
      ],
      correctOptionIndex: 2,
      difficulty: "medium",
      requiresCalculation: false,
      source: "ENEM 2020",
    },
    {
      content:
        "Machado de Assis é considerado o principal representante do:",
      options: [
        "Romantismo",
        "Naturalismo",
        "Realismo",
        "Parnasianismo",
      ],
      correctOptionIndex: 2,
      difficulty: "medium",
      requiresCalculation: false,
      source: "ENEM 2022",
    },
    {
      content:
        'A concordância verbal está correta em:',
      options: [
        "Fazem dois anos que não viajo",
        "Houveram muitos problemas",
        "Existem muitas razões para isso",
        "Precisam-se de funcionários",
      ],
      correctOptionIndex: 2,
      difficulty: "medium",
      requiresCalculation: false,
      source: "ENEM 2021",
    },
    {
      content:
        'Qual alternativa apresenta um exemplo de intertextualidade?',
      options: [
        "Um poema que segue a métrica clássica",
        "Um texto que cita ou referencia outro texto",
        "Um romance escrito em primeira pessoa",
        "Uma crônica publicada em jornal",
      ],
      correctOptionIndex: 1,
      difficulty: "medium",
      requiresCalculation: false,
      source: "ENEM 2020",
    },
    // --- HARD ---
    {
      content:
        'Em "Não me venha com desculpas", a colocação pronominal usada é:',
      options: [
        "Ênclise",
        "Mesóclise",
        "Próclise",
        "Apóclise",
      ],
      correctOptionIndex: 2,
      difficulty: "hard",
      requiresCalculation: false,
      source: "ENEM 2022",
    },
    {
      content:
        "Grande Sertão: Veredas, de Guimarães Rosa, pertence a qual movimento literário?",
      options: [
        "Regionalismo de 30",
        "Terceira geração modernista",
        "Pós-modernismo",
        "Concretismo",
      ],
      correctOptionIndex: 1,
      difficulty: "hard",
      requiresCalculation: false,
      source: "ENEM 2021",
    },
    {
      content:
        'A função da linguagem predominante em "Feche a porta, por favor" é:',
      options: [
        "Referencial",
        "Emotiva",
        "Conativa (apelativa)",
        "Fática",
      ],
      correctOptionIndex: 2,
      difficulty: "hard",
      requiresCalculation: false,
      source: "ENEM 2020",
    },
    {
      content:
        'Na análise sintática de "É necessário que estudemos", a oração "que estudemos" é:',
      options: [
        "Subordinada substantiva subjetiva",
        "Subordinada adjetiva restritiva",
        "Subordinada adverbial causal",
        "Coordenada sindética explicativa",
      ],
      correctOptionIndex: 0,
      difficulty: "hard",
      requiresCalculation: false,
      source: "ENEM 2022",
    },
    {
      content:
        "O conceito de 'antropofagia cultural' foi proposto por:",
      options: [
        "Mário de Andrade",
        "Oswald de Andrade",
        "Manuel Bandeira",
        "Carlos Drummond de Andrade",
      ],
      correctOptionIndex: 1,
      difficulty: "hard",
      requiresCalculation: false,
      source: "ENEM 2021",
    },
    {
      content:
        'Qual é a diferença entre "por que", "porque", "por quê" e "porquê"?',
      options: [
        "Não há diferença, são intercambiáveis",
        "'Por que' é interrogativo, 'porque' é explicativo, 'por quê' no final de frase, 'porquê' é substantivo",
        "Apenas 'porque' e 'por que' existem na norma culta",
        "'Porquê' é usado apenas em textos informais",
      ],
      correctOptionIndex: 1,
      difficulty: "hard",
      requiresCalculation: false,
      source: "ENEM 2020",
    },
  ],
};

async function seed() {
  console.log("🌱 Seeding database...\n");

  // Insert subjects
  const insertedSubjects = await db
    .insert(subject)
    .values(subjects.map((s) => ({ name: s.name, slug: s.slug })))
    .returning();

  console.log(`✓ Inserted ${insertedSubjects.length} subjects`);

  // Build a map of slug → id
  const subjectMap = new Map(
    insertedSubjects.map((s) => [s.slug, s.id])
  );

  // Insert questions for each subject
  let totalQuestions = 0;
  for (const [slug, questions] of Object.entries(questionsBySubject)) {
    const subjectId = subjectMap.get(slug);
    if (!subjectId) {
      console.error(`Subject not found for slug: ${slug}`);
      continue;
    }

    const rows = questions.map((q) => ({
      subjectId,
      content: q.content,
      options: q.options,
      correctOptionIndex: q.correctOptionIndex,
      difficulty: q.difficulty,
      requiresCalculation: q.requiresCalculation,
      source: q.source,
    }));

    await db.insert(question).values(rows);
    totalQuestions += rows.length;
    console.log(
      `  ✓ ${slug}: ${rows.length} questions (${questions.filter((q) => q.difficulty === "easy").length} easy, ${questions.filter((q) => q.difficulty === "medium").length} medium, ${questions.filter((q) => q.difficulty === "hard").length} hard)`
    );
  }

  console.log(`\n✓ Total: ${totalQuestions} questions seeded`);
  console.log("🌱 Seeding complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
