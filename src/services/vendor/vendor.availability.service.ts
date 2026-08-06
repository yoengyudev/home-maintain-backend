import { prisma } from "../../database/prisma.client";
import { NotFoundException, BadRequestException } from "../../utils/app-error.util";

interface UpdateAvailabilityData {
  workingDays?: string[];
  workingHours?: Record<string, { start: string; end: string }[]>;
  unavailableDates?: string[];
  temporaryPause?: boolean;
}

export class VendorAvailabilityService {
  static async getAvailability(userId: string) {
    const providerProfile = await prisma.providerProfile.findUnique({
      where: { userId },
      include: {
        businessProfile: true
      }
    });

    if (!providerProfile) {
      throw new NotFoundException("Provider profile not found");
    }

    if (!providerProfile.businessProfile) {
      // Return default availability if no business profile exists
      return {
        workingDays: [],
        workingHours: {},
        unavailableDates: [],
        temporaryPause: false
      };
    }

    // Parse workingHours JSON if it exists
    let workingHours = {};
    if (providerProfile.businessProfile.workingHours) {
      try {
        workingHours = typeof providerProfile.businessProfile.workingHours === 'string'
          ? JSON.parse(providerProfile.businessProfile.workingHours as string)
          : providerProfile.businessProfile.workingHours;
      } catch (e) {
        console.error('Error parsing workingHours JSON:', e);
        workingHours = {};
      }
    }

    return {
      workingDays: providerProfile.businessProfile.workingDays,
      workingHours,
      unavailableDates: providerProfile.businessProfile.unavailableDates.map((date: Date) => date.toISOString().split('T')[0]),
      temporaryPause: providerProfile.businessProfile.temporarilyPaused
    };
  }

  static async updateAvailability(userId: string, data: UpdateAvailabilityData) {
    const providerProfile = await prisma.providerProfile.findUnique({
      where: { userId },
      include: {
        businessProfile: true
      }
    });

    if (!providerProfile) {
      throw new NotFoundException("Provider profile not found");
    }

    // Convert unavailable dates from strings to Date objects
    const unavailableDatesAsDates = data.unavailableDates 
      ? data.unavailableDates.map(dateStr => new Date(dateStr))
      : [];

    // Convert workingHours object to JSON string
    const workingHoursJson = data.workingHours ? JSON.stringify(data.workingHours) : '{}';

    if (providerProfile.businessProfile) {
      // Update existing business profile
      const updated = await prisma.providerBusinessProfile.update({
        where: { id: providerProfile.businessProfile.id },
        data: {
          ...(data.workingDays !== undefined && { workingDays: data.workingDays }),
          ...(data.workingHours !== undefined && { workingHours: workingHoursJson }),
          ...(data.unavailableDates !== undefined && { unavailableDates: unavailableDatesAsDates }),
          ...(data.temporaryPause !== undefined && { temporarilyPaused: data.temporaryPause })
        }
      });

      // Parse workingHours JSON for response
      let workingHours = {};
      if (updated.workingHours) {
        try {
          workingHours = typeof updated.workingHours === 'string'
            ? JSON.parse(updated.workingHours as string)
            : updated.workingHours;
        } catch (e) {
          console.error('Error parsing workingHours JSON:', e);
          workingHours = {};
        }
      }

      return {
        workingDays: updated.workingDays,
        workingHours,
        unavailableDates: updated.unavailableDates.map((date: Date) => date.toISOString().split('T')[0]),
        temporaryPause: updated.temporarilyPaused
      };
    } else {
      // Create new business profile
      const created = await prisma.providerBusinessProfile.create({
        data: {
          providerProfileId: providerProfile.id,
          businessName: 'Business',
          workingDays: data.workingDays || [],
          workingHours: workingHoursJson,
          unavailableDates: unavailableDatesAsDates,
          temporarilyPaused: data.temporaryPause || false
        }
      });

      // Parse workingHours JSON for response
      let workingHours = {};
      if (created.workingHours) {
        try {
          workingHours = typeof created.workingHours === 'string'
            ? JSON.parse(created.workingHours as string)
            : created.workingHours;
        } catch (e) {
          console.error('Error parsing workingHours JSON:', e);
          workingHours = {};
        }
      }

      return {
        workingDays: created.workingDays,
        workingHours,
        unavailableDates: created.unavailableDates.map((date: Date) => date.toISOString().split('T')[0]),
        temporaryPause: created.temporarilyPaused
      };
    }
  }
}
