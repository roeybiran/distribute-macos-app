// ANSI escape codes for terminal colors
const ansiRed = '\u001B[31m';
const ansiBlue = '\u001B[34m';
const ansiGreen = '\u001B[32m';
const ansiReset = '\u001B[0m';

export const red = (message: string) => {
	console.log(`${ansiRed}==> ${ansiReset}${message}`);
};

export const blue = (message: string) => {
	console.log(`${ansiBlue}==> ${ansiReset}${message}`);
};

export const green = (message: string) => {
	console.log(`${ansiGreen}==> ${ansiReset}${message}`);
};
