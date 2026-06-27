const colors = {
    reset: "\x1b[0m",
    info: "\x1b[36m",
    error: "\x1b[31m",
    warn: "\x1b[33m",
    debug: "\x1b[35m",
    trace: "\x1b[90m",
    fatal: "\x1b[91m",
    child: "\x1b[32m",
} as const;

const withColor = (label: string, color: string) => `${color}${label}${colors.reset}`;

export const logger = {
    info: (...args: any[]) => console.log(withColor("[INFO]", colors.info), ...args),
    error: (...args: any[]) => console.error(withColor("[ERROR]", colors.error), ...args),
    warn: (...args: any[]) => console.warn(withColor("[WARN]", colors.warn), ...args),
    debug: (...args: any[]) => console.debug(withColor("[DEBUG]", colors.debug), ...args),
    trace: (...args: any[]) => console.trace(withColor("[TRACE]", colors.trace), ...args),
    fatal: (...args: any[]) => console.error(withColor("[FATAL]", colors.fatal), ...args),
    child: (...args: any[]) => console.log(withColor("[CHILD]", colors.child), ...args),
};