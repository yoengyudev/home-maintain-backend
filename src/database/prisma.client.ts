import { PrismaPg } from "@prisma/adapter-pg";
import { Env } from "../config/env.config";
import { PrismaClient } from "../generated/prisma/client";
import { logger } from "../utils/logger.util";

const adapter = new PrismaPg({ connectionString: Env.DATABASE_URL });
export const prisma = new PrismaClient({ adapter });


const connectDatabase = async () => {
    try {
        await prisma.$queryRaw`SELECT 1`;
        logger.info("Connected to database");
    } catch (error) {
        logger.error("Error connecting to database", error);
        process.exit(1);
    }
};

export default connectDatabase;