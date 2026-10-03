export function projectStyle(name: string, sphere: string) {
  const variants: [RegExp, string, string][] = [
    [/кур|сигар/i, 'smoking', '#e86a72'],
    [/зуб|стомат/i, 'tooth', '#2dbbeb'],
    [/сон|сна|спать/i, 'sleep', '#9a72df'],
    [/питани|рацион|еда/i, 'food', '#f39440'],
    [/вод[аыу]|пить/i, 'water', '#18badb'],
    [/трениров|спорт|фитнес/i, 'sport', '#20c69b'],
    [/обслед|медицин/i, 'medical', '#26bea5'],
  ];
  const match = variants.find(([pattern]) => pattern.test(name));
  const colors: Record<string, string> = {
    health: '#ed748d',
    sport: '#20c69b',
    growth: '#8880e4',
    english: '#239de7',
    finance: '#eeb741',
    together: '#dc8ab4',
    driving: '#40a6cc',
    tasks: '#688fdf',
    hobby: '#aa7add',
  };
  return {
    kind: match?.[1] ?? sphere,
    color: match?.[2] ?? colors[sphere] ?? '#239de7',
  };
}
