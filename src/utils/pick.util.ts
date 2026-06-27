export const pick = (obj: any, keys: string[]) => {
    const result: any = {};

    keys.forEach((key) => {
        if (obj[key] !== undefined) {
            result[key] = obj[key];
        }
    });

    return result;
};