const colors = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  gray: '\x1b[90m',
};

function ts(): string {
  return new Date().toLocaleTimeString('th-TH', { hour12: false });
}

export const log = {
  info: (msg: string): void => {
    console.log(`${colors.gray}[${ts()}]${colors.reset} ${colors.cyan}i${colors.reset}  ${msg}`);
  },
  ok: (msg: string): void => {
    console.log(`${colors.gray}[${ts()}]${colors.reset} ${colors.green}+${colors.reset}  ${msg}`);
  },
  warn: (msg: string): void => {
    console.log(`${colors.gray}[${ts()}]${colors.reset} ${colors.yellow}!${colors.reset}  ${msg}`);
  },
  err: (msg: string): void => {
    console.log(`${colors.gray}[${ts()}]${colors.reset} ${colors.red}x${colors.reset}  ${msg}`);
  },
};
