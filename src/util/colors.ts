// ANSI escape codes for terminal colors
const RED = '\x1b[31m';
const BLUE = '\x1b[34m';
const GREEN = '\x1b[32m';
const RESET = '\x1b[0m';

export const red = (message: string) => console.log(`${RED}${message}${RESET}`);
export const blue = (message: string) => console.log(`${BLUE}${message}${RESET}`);
export const green = (message: string) => console.log(`${GREEN}${message}${RESET}`);
