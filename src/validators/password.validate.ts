export const validatePassword = (password: string): boolean => {
    if (typeof password !== "string") return false;

    const strongPasswordRegex =
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_\-+=\[\]{};:'",.<>?/\\|`~]).{8,}$/;

    return strongPasswordRegex.test(password);
};