export const getEnv = (key: string, defaultValue?: string) => {
    const val = process.env[key];

    if (val === undefined || val === null) {
        if (defaultValue !== undefined) return defaultValue;
        throw new Error(`Environment variable ${key} is not set`);
    }

    return val;
};