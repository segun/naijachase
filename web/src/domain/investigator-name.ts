export function investigatorNameProblem(value:string):string|null {
  const name=value.trim();
  if(name.length<3||name.length>32) return "Investigator Name must be between 3 and 32 characters.";
  if(!/^[A-Za-z0-9_-]+$/.test(name)) return "Investigator Name can contain only letters, numbers, hyphens (-), and underscores (_). Do not use spaces or @.";
  return null;
}
