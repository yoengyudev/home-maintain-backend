import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  AccountStatus,
  AuditEventType,
  AuditSeverity,
  BookingIssueStatus,
  BookingStatus,
  LanguageCode,
  NotificationStatus,
  NotificationType,
  PrismaClient,
  ProviderStatus,
  ProviderVerificationStatus,
  ServiceModerationStatus,
  ServiceStatus,
  UserRole,
} from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });
// Bcrypt hash for 'FixItHome@2026'
const ADMIN_PASSWORD_HASH = '$2b$10$Uo23/Y0q/uH./zKz9z7Etuw49XqfC820fE8rQO8Poy/z80w3p5986';

const at = (value: string) => new Date(value);

async function main() {
  const categorySeeds = [
    ['CAT-001', 'Plumbing', 'ជាងទុយោទឹក', 'plumbing'],
    ['CAT-002', 'Air Conditioning', 'ម៉ាស៊ីនត្រជាក់', 'air-conditioning'],
    ['CAT-003', 'Electrical', 'ជាងអគ្គិសនី', 'electrical'],
    ['CAT-004', 'House Cleaning', 'សម្អាតផ្ទះ', 'house-cleaning'],
    ['CAT-005', 'Locksmith', 'ជាងសោ', 'locksmith'],
    ['CAT-006', 'Appliance Repair', 'ជួសជុលឧបករណ៍', 'appliance-repair'],
  ] as const;

  const categories = new Map<string, { id: string }>();
  for (const [publicId, nameEn, nameKm, slug] of categorySeeds) {
    const category = await prisma.serviceCategory.upsert({
      where: { publicId },
      update: { nameEn, nameKm, slug, isActive: true },
      create: { publicId, nameEn, nameKm, slug, isActive: true },
      select: { id: true },
    });
    categories.set(publicId, category);
  }

  const areaSeeds = [
    ['AREA-001', 'Phnom Penh', 'ភ្នំពេញ', 'phnom-penh'],
    ['AREA-002', 'Siem Reap', 'សៀមរាប', 'siem-reap'],
    ['AREA-003', 'Battambang', 'បាត់ដំបង', 'battambang'],
    ['AREA-004', 'Kampot', 'កំពត', 'kampot'],
    ['AREA-005', 'Sihanoukville', 'ព្រះសីហនុ', 'sihanoukville'],
    ['AREA-006', 'Kep', 'កែប', 'kep'],
  ] as const;

  const areas = new Map<string, { id: string }>();
  for (const [publicId, nameEn, nameKm, slug] of areaSeeds) {
    const area = await prisma.serviceArea.upsert({
      where: { publicId },
      update: { nameEn, nameKm, slug, provinceOrCity: nameEn, isActive: true },
      create: { publicId, nameEn, nameKm, slug, provinceOrCity: nameEn, isActive: true },
      select: { id: true },
    });
    areas.set(publicId, area);
  }

  const adminUser = await prisma.user.upsert({
    where: { email: 'sokha.chan@fixithome.com' },
    update: { publicId: 'USR-ADM-001', role: UserRole.ADMIN, accountStatus: AccountStatus.ACTIVE },
    create: {
      publicId: 'USR-ADM-001',
      email: 'sokha.chan@fixithome.com',
      phone: '+85512000001',
      passwordHash: ADMIN_PASSWORD_HASH,
      role: UserRole.ADMIN,
      accountStatus: AccountStatus.ACTIVE,
    },
  });
  const admin = await prisma.adminProfile.upsert({
    where: { userId: adminUser.id },
    update: { fullName: 'Sokha Chan', jobTitle: 'Platform Administrator' },
    create: { publicId: 'ADM-001', userId: adminUser.id, fullName: 'Sokha Chan', jobTitle: 'Platform Administrator' },
  });
  await prisma.userPreference.upsert({
    where: { userId: adminUser.id },
    update: { language: LanguageCode.EN },
    create: { userId: adminUser.id, language: LanguageCode.EN },
  });

  const providerSeeds = [
    ['PRV-001', 'Angkor Plumbing & Repairs', 'Sokun Mead', 'contact@angkorplumbing.com', '+85512345678', 'CAT-001', 'AREA-002', ProviderStatus.ACTIVE],
    ['PRV-002', 'PP Aircon Expert Services', 'Piseth Keo', 'piseth.keo@ppaircon.com', '+85515987654', 'CAT-002', 'AREA-001', ProviderStatus.ACTIVE],
    ['PRV-003', 'Chantou Housemaids & Cleaning', 'Chantou Som', 'info@chantoucleaning.com', '+85593555123', 'CAT-004', 'AREA-001', ProviderStatus.ACTIVE],
    ['PRV-004', 'Battambang Electrical Solution', 'Narin Phol', 'narin.phol@btbelectrical.com', '+85585777888', 'CAT-003', 'AREA-003', ProviderStatus.SUSPENDED],
    ['PRV-005', 'Modern Home Appliance Care', 'Sophea Tep', 'sophea.appliance@gmail.com', '+85598777666', 'CAT-006', 'AREA-001', ProviderStatus.PENDING_VERIFICATION],
    ['PRV-006', 'Phnom Penh Pro Plumbers Ltd', 'Dararith Khem', 'dararith@proplumbing.com', '+85511222333', 'CAT-001', 'AREA-001', ProviderStatus.PENDING_VERIFICATION],
    ['PRV-007', 'Kampot Smart Cooling Solutions', 'Bopa Nguon', 'bopa.smartcooling@gmail.com', '+85577111222', 'CAT-002', 'AREA-004', ProviderStatus.PENDING_VERIFICATION],
  ] as const;

  const providers = new Map<string, { id: string; userId: string }>();
  for (const [publicId, businessName, contactName, email, phone, categoryId, areaId, status] of providerSeeds) {
    const user = await prisma.user.upsert({
      where: { email },
      update: { phone, role: UserRole.PROVIDER, accountStatus: status === ProviderStatus.SUSPENDED ? AccountStatus.SUSPENDED : AccountStatus.ACTIVE },
      create: {
        publicId: `USR-${publicId}`,
        email,
        phone,
        passwordHash: ADMIN_PASSWORD_HASH,
        role: UserRole.PROVIDER,
        accountStatus: status === ProviderStatus.SUSPENDED ? AccountStatus.SUSPENDED : AccountStatus.ACTIVE,
      },
    });
    const provider = await prisma.providerProfile.upsert({
      where: { publicId },
      update: {
        contactName,
        status,
        primaryCategoryId: categories.get(categoryId)!.id,
        primaryAreaId: areas.get(areaId)!.id,
      },
      create: {
        publicId,
        userId: user.id,
        contactName,
        status,
        primaryCategoryId: categories.get(categoryId)!.id,
        primaryAreaId: areas.get(areaId)!.id,
        approvedAt: status === ProviderStatus.ACTIVE ? at('2026-04-05T03:00:00.000Z') : null,
      },
    });
    await prisma.providerBusinessProfile.upsert({
      where: { providerProfileId: provider.id },
      update: { businessName },
      create: {
        providerProfileId: provider.id,
        businessName,
        providerType: 'Business',
        cityProvince: areaSeeds.find(([id]) => id === areaId)?.[1],
        coverageSummary: areaSeeds.find(([id]) => id === areaId)?.[1],
        workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        workingHoursStart: '08:00',
        workingHoursEnd: '18:00',
      },
    });
    await prisma.userPreference.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id, language: LanguageCode.EN },
    });
    providers.set(publicId, { id: provider.id, userId: user.id });
  }

  const customerSeeds = [
    ['CST-001', 'Sovannmony Hak', 'mony.hak@gmail.com', '+85592888777', AccountStatus.ACTIVE],
    ['CST-002', 'Kosal Chea', 'kosal.chea@outlook.com', '+85570999111', AccountStatus.ACTIVE],
    ['CST-003', 'Srey Leak Sim', 'sim.sreyleak@gmail.com', '+85510444555', AccountStatus.ACTIVE],
    ['CST-004', 'Vannak Heng', 'vannak.heng@yahoo.com', '+85589333444', AccountStatus.ACTIVE],
    ['CST-005', 'Makara Oudom', 'makara.oudom@gmail.com', '+85595222888', AccountStatus.SUSPENDED],
  ] as const;

  const customers = new Map<string, { id: string; userId: string }>();
  for (const [publicId, fullName, email, phone, accountStatus] of customerSeeds) {
    const user = await prisma.user.upsert({
      where: { email },
      update: { phone, role: UserRole.CUSTOMER, accountStatus },
      create: { publicId: `USR-${publicId}`, email, phone, passwordHash: ADMIN_PASSWORD_HASH, role: UserRole.CUSTOMER, accountStatus },
    });
    const customer = await prisma.customerProfile.upsert({
      where: { publicId },
      update: { fullName },
      create: { publicId, userId: user.id, fullName },
    });
    await prisma.userPreference.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id, language: LanguageCode.EN, preferredContactMethod: 'phone' },
    });
    customers.set(publicId, { id: customer.id, userId: user.id });
  }

  const addresses = new Map<string, { id: string }>();
  for (const [customerId, publicId, fullName, phone, addressLine] of [
    ['CST-001', 'ADDR-001', 'Sovannmony Hak', '+85592888777', 'BKK1, Chamkar Mon, Phnom Penh'],
    ['CST-002', 'ADDR-002', 'Kosal Chea', '+85570999111', 'Svay Dangkum, Siem Reap'],
    ['CST-003', 'ADDR-003', 'Srey Leak Sim', '+85510444555', 'Toul Kork, Phnom Penh'],
  ] as const) {
    const address = await prisma.customerAddress.upsert({
      where: { publicId },
      update: { addressLine },
      create: { publicId, customerProfileId: customers.get(customerId)!.id, label: 'Home', fullName, phone, addressLine, isDefault: true },
      select: { id: true },
    });
    addresses.set(publicId, address);
  }

  const serviceSeeds = [
    ['SRV-001', 'Toilet Leak Repair & Seal', 'PRV-001', 'CAT-001', 35, ServiceStatus.ACTIVE, ServiceModerationStatus.NORMAL],
    ['SRV-002', 'Water Pump Repair & Pressure check', 'PRV-001', 'CAT-001', 55, ServiceStatus.ACTIVE, ServiceModerationStatus.NORMAL],
    ['SRV-003', 'Aircon Gas Refill & General Service', 'PRV-002', 'CAT-002', 15, ServiceStatus.ACTIVE, ServiceModerationStatus.NORMAL],
    ['SRV-004', 'AC Unit Main Board Repair', 'PRV-002', 'CAT-002', 85, ServiceStatus.DISABLED, ServiceModerationStatus.DISABLED_BY_ADMIN],
    ['SRV-005', 'Deep House Cleaning', 'PRV-003', 'CAT-004', 45, ServiceStatus.ACTIVE, ServiceModerationStatus.NORMAL],
    ['SRV-006', 'House Rewiring & Safety Inspections', 'PRV-004', 'CAT-003', 120, ServiceStatus.ACTIVE, ServiceModerationStatus.REQUIRES_REVIEW],
  ] as const;

  const services = new Map<string, { id: string }>();
  for (const [publicId, name, providerId, categoryId, price, serviceStatus, moderationStatus] of serviceSeeds) {
    const listing = await prisma.serviceListing.upsert({
      where: { publicId },
      update: { name, price, serviceStatus, moderationStatus },
      create: {
        publicId,
        providerProfileId: providers.get(providerId)!.id,
        categoryId: categories.get(categoryId)!.id,
        name,
        description: `${name} provided by a verified FixItHome service provider.`,
        price,
        priceUnit: 'service',
        pricingType: 'Fixed Price',
        duration: '1-2 hours',
        serviceStatus,
        moderationStatus,
      },
      select: { id: true },
    });
    services.set(publicId, listing);
    const providerArea = providerSeeds.find(([id]) => id === providerId)![6];
    await prisma.serviceListingArea.upsert({
      where: { serviceListingId_serviceAreaId: { serviceListingId: listing.id, serviceAreaId: areas.get(providerArea)!.id } },
      update: {},
      create: { serviceListingId: listing.id, serviceAreaId: areas.get(providerArea)!.id },
    });
  }

  const bookingSeeds = [
    ['BK-2026-001', 'CST-001', 'PRV-001', 'SRV-001', 'ADDR-001', 'AREA-002', '2026-06-18T02:00:00.000Z', 35, BookingStatus.ACCEPTED],
    ['BK-2026-002', 'CST-004', 'PRV-002', 'SRV-003', null, 'AREA-001', '2026-06-15T03:00:00.000Z', 15, BookingStatus.PENDING],
    ['BK-2026-003', 'CST-003', 'PRV-003', 'SRV-005', 'ADDR-003', 'AREA-001', '2026-06-17T08:00:00.000Z', 45, BookingStatus.IN_PROGRESS],
    ['BK-2026-004', 'CST-002', 'PRV-001', 'SRV-002', 'ADDR-002', 'AREA-002', '2026-06-16T07:00:00.000Z', 55, BookingStatus.CANCELLED],
    ['BK-2026-005', 'CST-001', 'PRV-002', 'SRV-003', 'ADDR-001', 'AREA-001', '2026-06-20T04:00:00.000Z', 30, BookingStatus.COMPLETED],
    ['BK-2026-007', 'CST-002', 'PRV-004', 'SRV-006', null, 'AREA-003', '2026-06-14T02:00:00.000Z', 120, BookingStatus.REJECTED],
  ] as const;

  const bookings = new Map<string, { id: string }>();
  for (const [publicId, customerId, providerId, serviceId, addressId, areaId, scheduledAt, estimatedTotal, status] of bookingSeeds) {
    const address = addressId ? addresses.get(addressId) : undefined;
    const booking = await prisma.booking.upsert({
      where: { publicId },
      update: { scheduledAt: at(scheduledAt), estimatedTotal, status },
      create: {
        publicId,
        customerProfileId: customers.get(customerId)!.id,
        providerProfileId: providers.get(providerId)!.id,
        serviceListingId: services.get(serviceId)!.id,
        customerAddressId: address?.id,
        serviceAreaId: areas.get(areaId)!.id,
        scheduledAt: at(scheduledAt),
        timeSlot: '09:00-11:00',
        quantity: estimatedTotal === 30 ? 2 : 1,
        estimatedTotal,
        serviceAddress: addressId ? `Saved customer address ${addressId}` : `Service address in ${areaId}`,
        status,
      },
      select: { id: true },
    });
    bookings.set(publicId, booking);
    await prisma.bookingStatusHistory.upsert({
      where: { publicId: `BSH-${publicId}` },
      update: { toStatus: status },
      create: { publicId: `BSH-${publicId}`, bookingId: booking.id, toStatus: status, reason: 'Seeded from frontend booking examples' },
    });
  }

  await prisma.bookingStatusHistory.upsert({
    where: { publicId: 'BSH-BK-2026-005-RESCHEDULED' },
    update: {},
    create: {
      publicId: 'BSH-BK-2026-005-RESCHEDULED',
      bookingId: bookings.get('BK-2026-005')!.id,
      fromStatus: BookingStatus.ACCEPTED,
      toStatus: BookingStatus.RESCHEDULED,
      reason: 'Provider schedule changed',
      changedAt: at('2026-06-16T04:00:00.000Z'),
    },
  });

  for (const [publicId, bookingId, status, summaryEn] of [
    ['ISS-001', 'BK-2026-002', BookingIssueStatus.NEEDS_REVIEW, 'Provider response overdue for more than 48 hours.'],
    ['ISS-002', 'BK-2026-004', BookingIssueStatus.DISPUTED, 'Late provider cancellation requires admin review.'],
  ] as const) {
    await prisma.bookingIssue.upsert({
      where: { publicId },
      update: { status, summaryEn },
      create: { publicId, bookingId: bookings.get(bookingId)!.id, status, summaryEn },
    });
  }

  const verification = await prisma.providerVerification.upsert({
    where: { publicId: 'VER-2026-004' },
    update: { status: ProviderVerificationStatus.UNDER_REVIEW },
    create: {
      publicId: 'VER-2026-004',
      providerProfileId: providers.get('PRV-005')!.id,
      status: ProviderVerificationStatus.UNDER_REVIEW,
      submittedAt: at('2026-06-11T04:00:00.000Z'),
    },
  });
  await prisma.providerVerificationDocument.upsert({
    where: { publicId: 'VERDOC-001' },
    update: {},
    create: { publicId: 'VERDOC-001', providerVerificationId: verification.id, documentType: 'Business registration', fileName: 'business-registration-demo.pdf', fileUrl: 'https://example.invalid/demo/business-registration.pdf', mimeType: 'application/pdf' },
  });
  await prisma.providerVerificationChecklistItem.upsert({
    where: { publicId: 'VERCHK-001' },
    update: {},
    create: { publicId: 'VERCHK-001', providerVerificationId: verification.id, label: 'Business information supplied', isComplete: true, sortOrder: 1 },
  });
  await prisma.providerVerificationTimelineItem.upsert({
    where: { publicId: 'VERTL-001' },
    update: {},
    create: { publicId: 'VERTL-001', providerVerificationId: verification.id, title: 'Submitted for review', status: ProviderVerificationStatus.UNDER_REVIEW, occurredAt: at('2026-06-11T04:00:00.000Z') },
  });

  await prisma.serviceModerationHistory.upsert({
    where: { publicId: 'SMH-001' },
    update: {},
    create: {
      publicId: 'SMH-001',
      serviceListingId: services.get('SRV-004')!.id,
      adminProfileId: admin.id,
      eventType: AuditEventType.DISABLED,
      reason: 'Policy violation reported in the admin moderation example.',
      resultingServiceStatus: ServiceStatus.DISABLED,
      resultingModerationStatus: ServiceModerationStatus.DISABLED_BY_ADMIN,
      createdAt: at('2026-06-17T04:30:00.000Z'),
    },
  });

  const auditSeeds = [
    ['AUD-001', AuditEventType.DISABLED, AuditSeverity.WARNING, 'Service disabled', 'Services', 'SRV-004'],
    ['AUD-002', AuditEventType.SUSPENDED, AuditSeverity.WARNING, 'Provider suspended', 'Providers', 'PRV-004'],
    ['AUD-003', AuditEventType.REQUESTED_CHANGES, AuditSeverity.NOTICE, 'Verification requested changes', 'Verifications', 'VER-2026-004'],
    ['AUD-004', AuditEventType.UPDATED, AuditSeverity.INFO, 'Category updated', 'Categories', 'CAT-002'],
    ['AUD-005', AuditEventType.UPDATED, AuditSeverity.INFO, 'Service area updated', 'Service Areas', 'AREA-003'],
    ['AUD-006', AuditEventType.SIGN_IN, AuditSeverity.INFO, 'Admin signed in', 'Authentication', 'ADM-001'],
  ] as const;
  for (const [publicId, eventType, severity, actionEn, relatedModule, relatedRecordId] of auditSeeds) {
    await prisma.auditLog.upsert({
      where: { publicId },
      update: { eventType, severity, actionEn },
      create: { publicId, adminProfileId: admin.id, actorName: 'Sokha Chan', eventType, severity, actionEn, relatedModule, relatedRecordId, createdAt: at(`2026-06-${10 + Number(publicId.slice(-1))}T03:00:00.000Z`) },
    });
  }

  const notificationSeeds = [
    ['NT-001', NotificationType.BOOKING, 'Booking issue requires review', 'Booking BK-2026-004 has a cancellation dispute.', 'Bookings', 'BK-2026-004', '/admin/bookings/BK-2026-004'],
    ['NT-002', NotificationType.SERVICE, 'Service moderation required', 'Service SRV-006 requires administrator review.', 'Services', 'SRV-006', '/admin/services/SRV-006'],
    ['NT-003', NotificationType.VERIFICATION, 'Overdue provider verification', 'Verification VER-2026-004 has waited more than 48 hours.', 'Verifications', 'VER-2026-004', '/admin/verifications/VER-2026-004'],
    ['NT-004', NotificationType.CATEGORY, 'Category moderation queue clear', 'Air Conditioning has no outstanding moderation flags.', 'Categories', 'CAT-002', '/admin/categories/CAT-002'],
    ['NT-005', NotificationType.PROVIDER, 'Provider account suspended', 'Battambang Electrical Solution has been suspended.', 'Providers', 'PRV-004', '/admin/providers/PRV-004'],
  ] as const;
  for (const [publicId, type, titleEn, messageEn, relatedModule, relatedRecordId, relatedRoute] of notificationSeeds) {
    await prisma.notification.upsert({
      where: { publicId },
      update: { titleEn, messageEn },
      create: { publicId, userId: adminUser.id, type, status: NotificationStatus.UNREAD, titleEn, messageEn, priority: type === NotificationType.VERIFICATION ? 'High' : 'Medium', relatedModule, relatedRecordId, relatedRoute },
    });
  }

  await prisma.internalAdminNote.upsert({
    where: { publicId: 'NOTE-001' },
    update: {},
    create: { publicId: 'NOTE-001', adminProfileId: admin.id, body: 'Follow up after the provider submits the corrected registration document.', relatedModule: 'Verifications', relatedRecordId: 'VER-2026-004', relatedRoute: '/admin/verifications/VER-2026-004' },
  });

  await prisma.review.upsert({
    where: { publicId: 'REV-001' },
    update: {},
    create: { publicId: 'REV-001', customerProfileId: customers.get('CST-001')!.id, providerProfileId: providers.get('PRV-002')!.id, serviceListingId: services.get('SRV-003')!.id, bookingId: bookings.get('BK-2026-005')!.id, rating: 5, comment: 'Quick, clean, and professional service.' },
  });

  console.log('Seed completed: taxonomy, users, profiles, services, bookings, verification, moderation, notifications, audit logs, notes, and review.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
