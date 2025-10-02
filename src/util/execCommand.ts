import { execaSync } from "execa";

export const execCommand = (
  command: string,
  args: string[] = [],
  options: {
    cwd?: string;
  } = {}
): string => {
  // const fullCommand = `${command} ${args.map((arg) => `'${arg}'`).join(" ")}`;
  const { cwd } = options;
  const result = execaSync(command, args, cwd ? { cwd } : {});
  return result.stdout;
};
