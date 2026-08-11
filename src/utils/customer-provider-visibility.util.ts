import { ProviderStatus } from "../generated/prisma/enums";

/** Approved providers who are not on a temporary duty pause. */
export const availableToCustomersWhere = {
    status: ProviderStatus.ACTIVE,
    NOT: {
        businessProfile: {
            is: { temporarilyPaused: true },
        },
    },
} as const;
