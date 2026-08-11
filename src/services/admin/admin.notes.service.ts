import { prisma } from "../../database/prisma.client";
import { BadRequestException } from "../../utils/app-error.util";
import type { Lang } from "../../i18n/messages";
import { t } from "../../i18n/translate";

function formatNote(note: any) {
    return {
        id: note.id,
        publicId: note.publicId,
        body: note.body,
        relatedModule: note.relatedModule,
        relatedRecordId: note.relatedRecordId,
        relatedRoute: note.relatedRoute,
        createdAt: note.createdAt.toISOString(),
        adminName: note.adminProfile?.fullName ?? null,
    };
}

export class AdminNotesService {
    static async list(relatedModule: string, relatedRecordId: string, lang: Lang) {
        if (!relatedModule || !relatedRecordId) {
            throw new BadRequestException(t("ADMIN_NOTE_TARGET_REQUIRED", lang));
        }

        const notes = await prisma.internalAdminNote.findMany({
            where: { relatedModule, relatedRecordId },
            include: { adminProfile: { select: { fullName: true } } },
            orderBy: { createdAt: "desc" },
        });

        return { items: notes.map(formatNote) };
    }

    static async create(
        adminUserId: string,
        data: { body: string; relatedModule: string; relatedRecordId: string; relatedRoute?: string },
        lang: Lang
    ) {
        const body = data.body.trim();
        if (!body) {
            throw new BadRequestException(t("ADMIN_NOTE_BODY_REQUIRED", lang));
        }
        if (!data.relatedModule || !data.relatedRecordId) {
            throw new BadRequestException(t("ADMIN_NOTE_TARGET_REQUIRED", lang));
        }

        const adminProfile = await prisma.adminProfile.findFirst({ where: { userId: adminUserId } });

        const note = await prisma.internalAdminNote.create({
            data: {
                publicId: `NOTE-${Date.now()}`,
                adminProfileId: adminProfile?.id ?? null,
                body,
                relatedModule: data.relatedModule,
                relatedRecordId: data.relatedRecordId,
                relatedRoute: data.relatedRoute ?? null,
            },
            include: { adminProfile: { select: { fullName: true } } },
        });

        return formatNote(note);
    }
}
