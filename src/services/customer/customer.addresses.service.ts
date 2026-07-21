import { prisma } from "../../database/prisma.client";
import type { Lang } from "../../i18n/messages";
import { t } from "../../i18n/translate";
import {
    NotFoundException,
} from "../../utils/app-error.util";
import { nextPublicId } from "../../utils/public-id.util";
import type { z } from "zod";
import type {
    customerCreateAddressSchema,
    customerUpdateAddressSchema,
} from "../../validators/customer/address.validator";

type CreateAddressDto = z.infer<typeof customerCreateAddressSchema>;
type UpdateAddressDto = z.infer<typeof customerUpdateAddressSchema>;

export class CustomerAddressesService {
    static async list(userId: string, lang: Lang) {
        const customer = await this.requireCustomerProfile(userId, lang);

        const addresses = await prisma.customerAddress.findMany({
            where: { customerProfileId: customer.id },
            orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
        });

        return addresses.map((address) => this.format(address));
    }

    static async getById(userId: string, id: string, lang: Lang) {
        const customer = await this.requireCustomerProfile(userId, lang);
        const address = await prisma.customerAddress.findFirst({
            where: {
                customerProfileId: customer.id,
                OR: [{ id }, { publicId: id }],
            },
        });

        if (!address) {
            throw new NotFoundException(t("CUSTOMER_ADDRESS_NOT_FOUND", lang));
        }

        return this.format(address);
    }

    static async create(userId: string, data: CreateAddressDto, lang: Lang) {
        const customer = await this.requireCustomerProfile(userId, lang);
        const publicId = await nextPublicId("ADDR", "customerAddress");

        if (data.isDefault) {
            await prisma.customerAddress.updateMany({
                where: { customerProfileId: customer.id, isDefault: true },
                data: { isDefault: false },
            });
        }

        const address = await prisma.customerAddress.create({
            data: {
                publicId,
                customerProfileId: customer.id,
                label: data.label,
                fullName: data.fullName,
                phone: data.phone,
                addressLine: data.addressLine,
                notes: data.notes ?? null,
                latitude: data.latitude ?? null,
                longitude: data.longitude ?? null,
                detectedLocation: data.detectedLocation ?? null,
                isDefault: data.isDefault ?? false,
            },
        });

        return this.format(address);
    }

    static async update(
        userId: string,
        id: string,
        data: UpdateAddressDto,
        lang: Lang
    ) {
        const customer = await this.requireCustomerProfile(userId, lang);
        const existing = await prisma.customerAddress.findFirst({
            where: {
                customerProfileId: customer.id,
                OR: [{ id }, { publicId: id }],
            },
        });

        if (!existing) {
            throw new NotFoundException(t("CUSTOMER_ADDRESS_NOT_FOUND", lang));
        }

        if (data.isDefault === true) {
            await prisma.customerAddress.updateMany({
                where: {
                    customerProfileId: customer.id,
                    isDefault: true,
                    NOT: { id: existing.id },
                },
                data: { isDefault: false },
            });
        }

        const address = await prisma.customerAddress.update({
            where: { id: existing.id },
            data: {
                ...(data.label !== undefined ? { label: data.label } : {}),
                ...(data.fullName !== undefined ? { fullName: data.fullName } : {}),
                ...(data.phone !== undefined ? { phone: data.phone } : {}),
                ...(data.addressLine !== undefined ? { addressLine: data.addressLine } : {}),
                ...(data.notes !== undefined ? { notes: data.notes } : {}),
                ...(data.latitude !== undefined ? { latitude: data.latitude } : {}),
                ...(data.longitude !== undefined ? { longitude: data.longitude } : {}),
                ...(data.detectedLocation !== undefined
                    ? { detectedLocation: data.detectedLocation }
                    : {}),
                ...(data.isDefault !== undefined ? { isDefault: data.isDefault } : {}),
            },
        });

        return this.format(address);
    }

    static async remove(userId: string, id: string, lang: Lang) {
        const customer = await this.requireCustomerProfile(userId, lang);
        const existing = await prisma.customerAddress.findFirst({
            where: {
                customerProfileId: customer.id,
                OR: [{ id }, { publicId: id }],
            },
        });

        if (!existing) {
            throw new NotFoundException(t("CUSTOMER_ADDRESS_NOT_FOUND", lang));
        }

        await prisma.customerAddress.delete({ where: { id: existing.id } });
        return { id: existing.id, publicId: existing.publicId };
    }

    static format(address: {
        id: string;
        publicId: string;
        label: string;
        fullName: string;
        phone: string;
        addressLine: string;
        notes: string | null;
        latitude: { toNumber?: () => number } | number | string | null;
        longitude: { toNumber?: () => number } | number | string | null;
        detectedLocation: string | null;
        isDefault: boolean;
    }) {
        return {
            id: address.id,
            publicId: address.publicId,
            label: address.label,
            fullName: address.fullName,
            phone: address.phone,
            addressLine: address.addressLine,
            notes: address.notes,
            latitude: this.toNumber(address.latitude),
            longitude: this.toNumber(address.longitude),
            detectedLocation: address.detectedLocation,
            isDefault: address.isDefault,
        };
    }

    private static async requireCustomerProfile(userId: string, lang: Lang) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { customerProfile: true },
        });

        if (!user?.customerProfile) {
            throw new NotFoundException(t("CUSTOMER_NOT_FOUND", lang));
        }

        return user.customerProfile;
    }

    private static toNumber(value: { toNumber?: () => number } | number | string | null | undefined) {
        if (value === null || value === undefined) return null;
        if (typeof value === "number") return value;
        if (typeof value === "string") return Number(value);
        if (typeof value.toNumber === "function") return value.toNumber();
        return Number(value);
    }
}
