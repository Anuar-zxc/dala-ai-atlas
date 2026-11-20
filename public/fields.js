export const locations = {
  'Актобе': [57.21, 50.28], 'Алматы': [76.89, 43.24], 'Астана': [71.43, 51.13],
  'Атырау': [51.88, 47.11], 'Актау': [51.17, 43.65], 'Караганда': [73.09, 49.8],
  'Костанай': [63.62, 53.21], 'Кокшетау': [69.38, 53.28], 'Кызылорда': [65.51, 44.85],
  'Павлодар': [76.95, 52.29], 'Рудный': [63.12, 52.97], 'Семей': [80.23, 50.41],
  'Талдыкорган': [78.37, 45.02], 'Тараз': [71.37, 42.9], 'Уральск': [51.37, 51.23],
  'Усть-Каменогорск': [82.61, 49.95], 'Шымкент': [69.6, 42.32],
  'Петропавловск': [69.15, 54.87], 'Конаев': [77.07, 43.88],
  'Туркестан': [68.25, 43.30], 'Жезказган': [67.71, 47.78],
};

export const stages = {
  mvp: 'MVP / прототип',
  pilot: 'Пилот / бета',
  live: 'Работающий продукт',
  growth: 'Рост / венчурный раунд',
  unknown: 'Стадия уточняется',
};

export function stageOf(project) {
  if (Object.hasOwn(stages, project.stageKey)) return project.stageKey;
  const stage = project.stage || '';
  if (/\b(?:series|seed|growth)\b|масштабирован/i.test(stage)) return 'growth';
  if (/пилот|бета|beta/i.test(stage)) return 'pilot';
  if (/\bmvp\b|прототип/i.test(stage)) return 'mvp';
  if (/коммерческ|работающ|запущен|университетский продукт/i.test(stage)) return 'live';
  return 'unknown';
}

export function mergeCatalog(baseline, changes) {
  const byId = new Map(baseline.map(project => [project.id, project]));
  for (const [id, change] of Object.entries(changes)) {
    if (change.hidden) byId.delete(id);
    else byId.set(id, change.project);
  }
  return [...byId.values()];
}
