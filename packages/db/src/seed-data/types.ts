export type QuestionSeed = {
  body: string;
  options: [string, string, string, string];
  correctOptionIndex: 0 | 1 | 2 | 3;
  difficulty: 1 | 2 | 3;
  source?: string;
};
