import bcrypt from "bcrypt";
import { prisma } from "../src/database/prisma.client";
import {
    AccountStatus,
    AuditEventType,
    AuditSeverity,
    BookingIssueStatus,
    BookingStatus,
    CommissionStatus,
    CommissionType,
    DevicePlatform,
    FaqAudience,
    InvoiceStatus,
    LanguageCode,
    NotificationStatus,
    NotificationType,
    ProviderStatus,
    ProviderVerificationStatus,
    ServiceModerationStatus,
    ServiceStatus,
    SupportPageKey,
    SupportRequestStatus,
    UserRole,
} from "../src/generated/prisma/client";

async function main() {
    console.log("🌱 Starting complete 20-row database seeding across all modules...");

    const passwordHash = await bcrypt.hash("Password123!", 10);
    const now = new Date();

    // ==========================================
    // 1. SERVICE CATEGORIES (20 rows)
    // ==========================================
    console.log("-> Seeding 20 Service Categories...");
    const categoryData = [
        { nameEn: "Air Conditioner Repair & Cleaning", nameKm: "ជួសជុល និងលាងម៉ាស៊ីនត្រជាក់", slug: "ac-repair-cleaning", icon: "AirVent" },
        { nameEn: "Plumbing & Pipe Services", nameKm: "សេវាទឹក និងបំពង់ទឹក", slug: "plumbing-services", icon: "Wrench" },
        { nameEn: "Electrical Installation & Repair", nameKm: "តម្លើង និងជួសជុលប្រព័ន្ធអគ្គិសនី", slug: "electrical-repair", icon: "Zap" },
        { nameEn: "Deep Home Cleaning", nameKm: "សេវាបោសសម្អាតផ្ទះស៊ីជម្រៅ", slug: "home-cleaning", icon: "Sparkles" },
        { nameEn: "Appliance & Washing Machine Repair", nameKm: "ជួសជុលឧបករណ៍ និងម៉ាស៊ីនបោក", slug: "appliance-repair", icon: "Tv" },
        { nameEn: "Pest Control & Fumigation", nameKm: "កម្ចាត់សត្វល្អិតចង្រៃ", slug: "pest-control", icon: "ShieldAlert" },
        { nameEn: "House Painting & Wall Refurbishing", nameKm: "លាបថ្នាំផ្ទះ និងជួសជុលជញ្ជាំង", slug: "house-painting", icon: "Paintbrush" },
        { nameEn: "Carpentry & Furniture Assembly", nameKm: "ជាងឈើ និងដំឡើងគ្រឿងសង្ហារឹម", slug: "carpentry-furniture", icon: "Hammer" },
        { nameEn: "Gardening & Lawn Maintenance", nameKm: "ថែសួន និងកាត់ស្មៅ", slug: "gardening-lawn", icon: "Trees" },
        { nameEn: "Roof Leak Repair & Waterproofing", nameKm: "ជួសជុលដំបូលលិចទឹក និងការពារជម្រាបទឹក", slug: "roof-repair", icon: "Home" },
        { nameEn: "Locksmith & Security Key Services", nameKm: "ជាងសោ និងសុវត្ថិភាពសោ", slug: "locksmith-services", icon: "Key" },
        { nameEn: "House Moving & Heavy Relocation", nameKm: "សេវារើផ្ទះ និងដឹកជញ្ជូនធ្ងន់", slug: "moving-relocation", icon: "Truck" },
        { nameEn: "Sanitization & Disinfection", nameKm: "បាញ់ថ្នាំសម្លាប់មេរោគ", slug: "sanitization-disinfection", icon: "ShieldCheck" },
        { nameEn: "Solar Panel Installation & Care", nameKm: "ដំឡើង និងថែទាំផ្ទាំងសូឡា", slug: "solar-panel-care", icon: "Sun" },
        { nameEn: "CCTV & Security Alarm Systems", nameKm: "ដំឡើងកាមេរ៉ាសុវត្ថិភាព និងប្រព័ន្ធរោទិ៍", slug: "cctv-security-alarm", icon: "Camera" },
        { nameEn: "Glass & Window Cleaning", nameKm: "លាងកញ្ចក់ និងបង្អួចអគារ", slug: "window-cleaning", icon: "Maximize" },
        { nameEn: "Tiling & Floor Replacement", nameKm: "រៀបការ៉ូ និងប្តូរឥដ្ឋការ៉ូ", slug: "tiling-flooring", icon: "Grid" },
        { nameEn: "Swimming Pool Maintenance", nameKm: "ថែទាំ និងលាងអាងហែលទឹក", slug: "swimming-pool-maintenance", icon: "Droplets" },
        { nameEn: "Masonry & Concrete Works", nameKm: "ជាងបេតុង និងសំណង់ស៊ីម៉ងត៍", slug: "masonry-concrete", icon: "Layers" },
        { nameEn: "Interior Styling & Curtains", nameKm: "តុបតែងខាងក្នុង និងដំឡើងវាំងនន", slug: "interior-styling", icon: "Layout" },
    ];

    const categories = [];
    for (let i = 0; i < categoryData.length; i++) {
        const cat = categoryData[i];
        const publicId = `CAT-${String(i + 1).padStart(3, "0")}`;
        const record = await prisma.serviceCategory.upsert({
            where: { slug: cat.slug },
            update: {
                nameEn: cat.nameEn,
                nameKm: cat.nameKm,
                descriptionEn: `Professional ${cat.nameEn} services across Cambodia.`,
                descriptionKm: `សេវាកម្ម ${cat.nameKm} ប្រកបដោយវិជ្ជាជីវៈខ្ពស់។`,
                iconName: cat.icon,
                isActive: true,
            },
            create: {
                publicId,
                nameEn: cat.nameEn,
                nameKm: cat.nameKm,
                slug: cat.slug,
                descriptionEn: `Professional ${cat.nameEn} services across Cambodia.`,
                descriptionKm: `សេវាកម្ម ${cat.nameKm} ប្រកបដោយវិជ្ជាជីវៈខ្ពស់។`,
                iconName: cat.icon,
                isActive: true,
            },
        });
        categories.push(record);
    }

    // ==========================================
    // 2. SERVICE AREAS (20 rows)
    // ==========================================
    console.log("-> Seeding 20 Service Areas...");
    const areaData = [
        { nameEn: "Khan Chamkar Mon", nameKm: "ខណ្ឌចំការមន", slug: "khan-chamkar-mon", city: "Phnom Penh", lat: 11.5434, lng: 104.9282 },
        { nameEn: "Khan Doun Penh", nameKm: "ខណ្ឌដូនពេញ", slug: "khan-doun-penh", city: "Phnom Penh", lat: 11.5713, lng: 104.9282 },
        { nameEn: "Khan Prampir Meakkakra", nameKm: "ខណ្ឌ៧មករា", slug: "khan-prampir-meakkakra", city: "Phnom Penh", lat: 11.5645, lng: 104.9126 },
        { nameEn: "Khan Tuol Kouk", nameKm: "ខណ្ឌទួលគោក", slug: "khan-tuol-kouk", city: "Phnom Penh", lat: 11.5739, lng: 104.8996 },
        { nameEn: "Khan Dangkao", nameKm: "ខណ្ឌដង្កោ", slug: "khan-dangkao", city: "Phnom Penh", lat: 11.4886, lng: 104.8778 },
        { nameEn: "Khan Mean Chey", nameKm: "ខណ្ឌមានជ័យ", slug: "khan-mean-chey", city: "Phnom Penh", lat: 11.5208, lng: 104.9189 },
        { nameEn: "Khan Russey Keo", nameKm: "ខណ្ឌឫស្សីកែវ", slug: "khan-russey-keo", city: "Phnom Penh", lat: 11.6033, lng: 104.9082 },
        { nameEn: "Khan Saensokh", nameKm: "ខណ្ឌសែនសុខ", slug: "khan-saensokh", city: "Phnom Penh", lat: 11.5833, lng: 104.8694 },
        { nameEn: "Khan Pur Senchey", nameKm: "ខណ្ឌពោធិ៍សែនជ័យ", slug: "khan-pur-senchey", city: "Phnom Penh", lat: 11.5472, lng: 104.8361 },
        { nameEn: "Khan Chbar Ampov", nameKm: "ខណ្ឌច្បារអំពៅ", slug: "khan-chbar-ampov", city: "Phnom Penh", lat: 11.5244, lng: 104.9547 },
        { nameEn: "Khan Chroy Changvar", nameKm: "ខណ្ឌជ្រោយចង្វារ", slug: "khan-chroy-changvar", city: "Phnom Penh", lat: 11.6000, lng: 104.9400 },
        { nameEn: "Khan Preaek Pnov", nameKm: "ខណ្ឌព្រែកព្នៅ", slug: "khan-preaek-pnov", city: "Phnom Penh", lat: 11.6500, lng: 104.8200 },
        { nameEn: "Khan Boeng Keng Kang", nameKm: "ខណ្ឌបឹងកេងកង", slug: "khan-boeng-keng-kang", city: "Phnom Penh", lat: 11.5510, lng: 104.9220 },
        { nameEn: "Khan Kamboul", nameKm: "ខណ្ឌកំបូល", slug: "khan-kamboul", city: "Phnom Penh", lat: 11.5200, lng: 104.7700 },
        { nameEn: "Siem Reap Central", nameKm: "ក្រុងសៀមរាបកណ្តាល", slug: "siem-reap-central", city: "Siem Reap", lat: 13.3671, lng: 103.8448 },
        { nameEn: "Svay Dangkum", nameKm: "ស្វាយដង្គំ", slug: "svay-dangkum", city: "Siem Reap", lat: 13.3500, lng: 103.8300 },
        { nameEn: "Battambang Town", nameKm: "ក្រុងបាត់ដំបង", slug: "battambang-town", city: "Battambang", lat: 13.0957, lng: 103.2022 },
        { nameEn: "Sihanoukville Coastal", nameKm: "ក្រុងព្រះសីហនុ", slug: "sihanoukville-coastal", city: "Preah Sihanouk", lat: 10.6275, lng: 103.5221 },
        { nameEn: "Kampot Riverside", nameKm: "ក្រុងកំពត", slug: "kampot-riverside", city: "Kampot", lat: 10.5942, lng: 104.1640 },
        { nameEn: "Kep Beachfront", nameKm: "ក្រុងកែប", slug: "kep-beachfront", city: "Kep", lat: 10.4828, lng: 104.2949 },
    ];

    const areas = [];
    for (let i = 0; i < areaData.length; i++) {
        const area = areaData[i];
        const publicId = `AREA-${String(i + 1).padStart(3, "0")}`;
        const record = await prisma.serviceArea.upsert({
            where: { slug: area.slug },
            update: {
                nameEn: area.nameEn,
                nameKm: area.nameKm,
                provinceOrCity: area.city,
                latitude: area.lat,
                longitude: area.lng,
                radiusKm: 18.5,
                isActive: true,
            },
            create: {
                publicId,
                nameEn: area.nameEn,
                nameKm: area.nameKm,
                slug: area.slug,
                provinceOrCity: area.city,
                latitude: area.lat,
                longitude: area.lng,
                radiusKm: 18.5,
                isActive: true,
            },
        });
        areas.push(record);
    }

    // ==========================================
    // 3. ADMIN USERS & PROFILES (20 rows)
    // ==========================================
    console.log("-> Seeding 20 Admin Users & Profiles...");
    const adminNames = [
        "FixItHome SuperAdmin", "Rathana Meng", "Vireak Bun", "Channary Keo", "Piseth Long",
        "Sophea Heng", "Dara Sar", "Bopha Sam", "Kosal Chea", "Thida Ouk",
        "Sovannarith Kim", "Kolab Lim", "Vanna Meas", "Phearith Nguon", "Sreyneath Tea",
        "Mony Pen", "Chanthou Som", "Rithy Hong", "Sinath Duong", "Visal Chey"
    ];

    const adminProfiles = [];
    for (let i = 0; i < adminNames.length; i++) {
        const isFirst = i === 0;
        const email = isFirst ? "info.gtwotech@gmail.com" : `admin${i + 1}@fixithome.com`;
        const phone = isFirst ? "+85514277299" : `+855110000${String(i + 1).padStart(2, "0")}`;
        const userPublicId = `USR-ADM-${String(i + 1).padStart(3, "0")}`;
        const profilePublicId = `ADM-${String(i + 1).padStart(3, "0")}`;

        let user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            user = await prisma.user.create({
                data: {
                    publicId: userPublicId,
                    email,
                    phone,
                    passwordHash,
                    role: UserRole.ADMIN,
                    accountStatus: AccountStatus.ACTIVE,
                    emailVerifiedAt: now,
                    phoneVerifiedAt: now,
                },
            });
        }

        const profile = await prisma.adminProfile.upsert({
            where: { userId: user.id },
            update: {
                fullName: adminNames[i],
                jobTitle: isFirst ? "Super Administrator" : `Operations Lead Level ${i + 1}`,
                avatarUrl: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80`,
            },
            create: {
                publicId: profilePublicId,
                userId: user.id,
                fullName: adminNames[i],
                jobTitle: isFirst ? "Super Administrator" : `Operations Lead Level ${i + 1}`,
                avatarUrl: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80`,
            },
        });
        adminProfiles.push(profile);
    }

    // ==========================================
    // 4. CUSTOMER USERS & PROFILES (20 rows)
    // ==========================================
    console.log("-> Seeding 20 Customers & Profiles...");
    const customerNames = [
        "Kosal Chenda", "Phanith Sok", "Theara Nhem", "Davin Seng", "Sreyleak Chhum",
        "Ravy Khun", "Viseth Pich", "Kanha Ros", "Channak Yim", "Sreypov Kong",
        "Narith San", "Sreymao Prak", "Panha Mao", "Leakhena Prom", "Vibol Kuy",
        "Chantha Nuon", "Somnang Lay", "Botum Roeun", "Veasna Yin", "Sophat Thorn"
    ];

    const customerProfiles = [];
    const customerUsers = [];
    for (let i = 0; i < customerNames.length; i++) {
        const email = `customer${i + 1}@fixithome.com`;
        const phone = `+855120000${String(i + 1).padStart(2, "0")}`;
        const userPublicId = `USR-CUS-${String(i + 1).padStart(3, "0")}`;
        const profilePublicId = `CUS-${String(i + 1).padStart(3, "0")}`;

        let user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            user = await prisma.user.create({
                data: {
                    publicId: userPublicId,
                    email,
                    phone,
                    passwordHash,
                    role: UserRole.CUSTOMER,
                    accountStatus: AccountStatus.ACTIVE,
                    emailVerifiedAt: now,
                    phoneVerifiedAt: now,
                },
            });
        }
        customerUsers.push(user);

        const profile = await prisma.customerProfile.upsert({
            where: { userId: user.id },
            update: {
                fullName: customerNames[i],
                avatarUrl: `https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80`,
            },
            create: {
                publicId: profilePublicId,
                userId: user.id,
                fullName: customerNames[i],
                avatarUrl: `https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80`,
            },
        });
        customerProfiles.push(profile);
    }

    // ==========================================
    // 5. PROVIDER USERS & PROFILES (20 rows)
    // ==========================================
    console.log("-> Seeding 20 Providers & Business Profiles...");
    const providerBusinesses = [
        { contact: "Sokha Heng", business: "Phnom Penh Pro AC Services", type: "COMPANY" },
        { contact: "Vicheka Mom", business: "Quick Fix Plumbing Masters", type: "COMPANY" },
        { contact: "Bunly Taing", business: "VoltSafe Electrical Solutions", type: "INDIVIDUAL" },
        { contact: "Chanda Pov", business: "Crystal Clean Home Services", type: "COMPANY" },
        { contact: "Makara Chhun", business: "Smart Appliance Doctors", type: "INDIVIDUAL" },
        { contact: "Darith Tep", business: "SafeHome Pest Fumigation", type: "COMPANY" },
        { contact: "Sreynich Kry", business: "Rainbow Master Painters", type: "INDIVIDUAL" },
        { contact: "Hout Long", business: "Precision Woodcraft & Carpentry", type: "COMPANY" },
        { contact: "Bora Ly", business: "Green Oasis Gardeners", type: "INDIVIDUAL" },
        { contact: "Thierry Meas", business: "EverDry Roof & Waterproofing", type: "COMPANY" },
        { contact: "Phalla Horn", business: "24/7 Apex Locksmith Pro", type: "INDIVIDUAL" },
        { contact: "Sambath Yin", business: "SwiftRelocate Moving & Transport", type: "COMPANY" },
        { contact: "Kravann Tuy", business: "BioPure Disinfection Team", type: "COMPANY" },
        { contact: "Chetra Khem", business: "EcoSun Solar Installations", type: "COMPANY" },
        { contact: "Samnang Sim", business: "VisionGuard CCTV Systems", type: "INDIVIDUAL" },
        { contact: "Sopheap Eng", business: "ClearView Window Specialists", type: "INDIVIDUAL" },
        { contact: "Sovath Din", business: "SolidTile & Marble Crafters", type: "COMPANY" },
        { contact: "Rina Chheang", business: "AquaBlue Pool Care Services", type: "COMPANY" },
        { contact: "Bunthoeun Net", business: "StrongWall Masonry Experts", type: "COMPANY" },
        { contact: "Malis Phan", business: "Elegance Living Interior Decor", type: "COMPANY" },
    ];

    const providerProfiles = [];
    const providerUsers = [];
    for (let i = 0; i < providerBusinesses.length; i++) {
        const pb = providerBusinesses[i];
        const email = `provider${i + 1}@fixithome.com`;
        const phone = `+855150000${String(i + 1).padStart(2, "0")}`;
        const userPublicId = `USR-PRV-${String(i + 1).padStart(3, "0")}`;
        const profilePublicId = `PRV-${String(i + 1).padStart(3, "0")}`;

        let user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            user = await prisma.user.create({
                data: {
                    publicId: userPublicId,
                    email,
                    phone,
                    passwordHash,
                    role: UserRole.PROVIDER,
                    accountStatus: AccountStatus.ACTIVE,
                    emailVerifiedAt: now,
                    phoneVerifiedAt: now,
                },
            });
        }
        providerUsers.push(user);

        const assignedCat = categories[i % categories.length];
        const assignedArea = areas[i % areas.length];

        const profile = await prisma.providerProfile.upsert({
            where: { userId: user.id },
            update: {
                contactName: pb.contact,
                status: ProviderStatus.ACTIVE,
                primaryCategoryId: assignedCat.id,
                primaryAreaId: assignedArea.id,
                averageRating: 4.85,
                completedJobs: 15 + (i * 3),
                approvedAt: now,
                avatarUrl: `https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80`,
                coverUrl: `https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800&auto=format&fit=crop&q=80`,
            },
            create: {
                publicId: profilePublicId,
                userId: user.id,
                contactName: pb.contact,
                status: ProviderStatus.ACTIVE,
                primaryCategoryId: assignedCat.id,
                primaryAreaId: assignedArea.id,
                averageRating: 4.85,
                completedJobs: 15 + (i * 3),
                approvedAt: now,
                avatarUrl: `https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80`,
                coverUrl: `https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800&auto=format&fit=crop&q=80`,
            },
        });
        providerProfiles.push(profile);

        // Provider Business Profile (20 rows)
        await prisma.providerBusinessProfile.upsert({
            where: { providerProfileId: profile.id },
            update: {
                businessName: pb.business,
                providerType: pb.type,
                description: `Leading provider offering ${pb.business} with verified licenses and certified technicians.`,
                addressLine: `#${10 + i}, St. ${200 + i * 2}, Sangkat Boeng Keng Kang`,
                district: assignedArea.nameEn,
                cityProvince: assignedArea.provinceOrCity ?? "Phnom Penh",
                latitude: assignedArea.latitude,
                longitude: assignedArea.longitude,
                workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
                workingHours: { start: "08:00", end: "18:00" },
                maxBookingsPerSlot: 3,
                temporarilyPaused: false,
            },
            create: {
                providerProfileId: profile.id,
                businessName: pb.business,
                providerType: pb.type,
                description: `Leading provider offering ${pb.business} with verified licenses and certified technicians.`,
                addressLine: `#${10 + i}, St. ${200 + i * 2}, Sangkat Boeng Keng Kang`,
                district: assignedArea.nameEn,
                cityProvince: assignedArea.provinceOrCity ?? "Phnom Penh",
                latitude: assignedArea.latitude,
                longitude: assignedArea.longitude,
                workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
                workingHours: { start: "08:00", end: "18:00" },
                maxBookingsPerSlot: 3,
                temporarilyPaused: false,
            },
        });

        // Provider Service Area (20+ links)
        await prisma.providerServiceArea.upsert({
            where: {
                providerProfileId_serviceAreaId: {
                    providerProfileId: profile.id,
                    serviceAreaId: assignedArea.id,
                },
            },
            update: {},
            create: {
                providerProfileId: profile.id,
                serviceAreaId: assignedArea.id,
            },
        });
    }

    // ==========================================
    // 6. USER PREFERENCES (20 rows)
    // ==========================================
    console.log("-> Seeding 20 User Preferences...");
    for (let i = 0; i < 20; i++) {
        const u = customerUsers[i];
        await prisma.userPreference.upsert({
            where: { userId: u.id },
            update: {
                language: i % 2 === 0 ? LanguageCode.EN : LanguageCode.KM,
                preferredContactMethod: "TELEGRAM",
                emailNotifications: true,
                pushNotifications: true,
            },
            create: {
                userId: u.id,
                language: i % 2 === 0 ? LanguageCode.EN : LanguageCode.KM,
                preferredContactMethod: "TELEGRAM",
                emailNotifications: true,
                pushNotifications: true,
            },
        });
    }

    // ==========================================
    // 7. ACCOUNT SESSIONS (20 rows)
    // ==========================================
    console.log("-> Seeding 20 Account Sessions...");
    for (let i = 0; i < 20; i++) {
        const u = customerUsers[i];
        const tokenHash = `session_token_hash_value_${i + 1}`;
        const publicId = `SES-${String(i + 1).padStart(3, "0")}`;
        await prisma.accountSession.upsert({
            where: { publicId },
            update: { tokenHash },
            create: {
                publicId,
                userId: u.id,
                tokenHash,
                deviceName: i % 2 === 0 ? "iPhone 15 Pro" : "Samsung Galaxy S24",
                ipAddress: `192.168.1.${10 + i}`,
                userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
        });
    }

    // ==========================================
    // 8. FCM TOKENS (20 rows)
    // ==========================================
    console.log("-> Seeding 20 FCM Tokens...");
    for (let i = 0; i < 20; i++) {
        const u = customerUsers[i];
        const token = `fcm_device_token_kh_${i + 1}`;
        const publicId = `FCM-${String(i + 1).padStart(3, "0")}`;
        await prisma.fcmToken.upsert({
            where: { publicId },
            update: { token, isActive: true },
            create: {
                publicId,
                userId: u.id,
                token,
                platform: i % 2 === 0 ? DevicePlatform.IOS : DevicePlatform.ANDROID,
                deviceName: i % 2 === 0 ? "Apple iPhone" : "Google Pixel 8",
                isActive: true,
            },
        });
    }

    // ==========================================
    // 9. TELEGRAM ACCOUNTS (20 rows)
    // ==========================================
    console.log("-> Seeding 20 Telegram Accounts...");
    for (let i = 0; i < 20; i++) {
        const u = customerUsers[i];
        const chatId = `tg_chat_${800000 + i}`;
        const publicId = `TG-2026-${String(i + 1).padStart(3, "0")}`;
        await prisma.telegramAccount.upsert({
            where: { publicId },
            update: { chatId, isConnected: true },
            create: {
                publicId,
                userId: u.id,
                chatId,
                username: `kh_user_${i + 1}`,
                firstName: customerNames[i].split(" ")[0],
                lastName: customerNames[i].split(" ")[1] ?? "Khmer",
                isConnected: true,
            },
        });
    }

    // ==========================================
    // 10. TELEGRAM LINK TOKENS (20 rows)
    // ==========================================
    console.log("-> Seeding 20 Telegram Link Tokens...");
    for (let i = 0; i < 20; i++) {
        const u = customerUsers[i];
        const token = `tg_link_token_${i + 1}`;
        const existing = await prisma.telegramLinkToken.findUnique({ where: { token } });
        if (!existing) {
            await prisma.telegramLinkToken.create({
                data: {
                    token,
                    userId: u.id,
                    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                    usedAt: i % 2 === 0 ? now : null,
                },
            });
        }
    }

    // ==========================================
    // 11. TELEGRAM AUTH SESSIONS (20 rows)
    // ==========================================
    console.log("-> Seeding 20 Telegram Auth Sessions...");
    for (let i = 0; i < 20; i++) {
        const token = `tg_auth_sess_${i + 1}`;
        const existing = await prisma.telegramAuthSession.findUnique({ where: { token } });
        if (!existing) {
            await prisma.telegramAuthSession.create({
                data: {
                    token,
                    status: i % 2 === 0 ? "CONFIRMED" : "PENDING",
                    chatId: `auth_chat_${900000 + i}`,
                    username: `tg_auth_user_${i + 1}`,
                    firstName: "User",
                    lastName: `${i + 1}`,
                    expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
                },
            });
        }
    }

    // ==========================================
    // 12. PROVIDER VERIFICATION (20 rows)
    // ==========================================
    console.log("-> Seeding 20 Provider Verifications & Verification Details...");
    const verifications = [];
    for (let i = 0; i < 20; i++) {
        const provider = providerProfiles[i];
        const admin = adminProfiles[i % adminProfiles.length];
        const publicId = `VRF-${String(i + 1).padStart(3, "0")}`;

        const verification = await prisma.providerVerification.upsert({
            where: { publicId },
            update: {
                status: ProviderVerificationStatus.APPROVED,
                submittedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
                reviewedAt: now,
                reviewerNotes: "All documents verified and identity confirmed successfully.",
            },
            create: {
                publicId,
                providerProfileId: provider.id,
                status: ProviderVerificationStatus.APPROVED,
                submittedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
                reviewedAt: now,
                reviewerNotes: "All documents verified and identity confirmed successfully.",
            },
        });
        verifications.push(verification);

        // Verification Document (20 rows)
        const docId = `DOC-${String(i + 1).padStart(3, "0")}`;
        await prisma.providerVerificationDocument.upsert({
            where: { publicId: docId },
            update: { isVerified: true },
            create: {
                publicId: docId,
                providerVerificationId: verification.id,
                documentType: i % 2 === 0 ? "NATIONAL_ID" : "BUSINESS_PATENT_LICENSE",
                fileName: `verified_document_${i + 1}.pdf`,
                fileUrl: `https://storage.googleapis.com/fixithome-docs/doc_${i + 1}.pdf`,
                mimeType: "application/pdf",
                documentNumber: `KH-DOC-2026-${1000 + i}`,
                isVerified: true,
            },
        });

        // Verification Checklist Item (20 rows)
        const chkId = `CHK-${String(i + 1).padStart(3, "0")}`;
        await prisma.providerVerificationChecklistItem.upsert({
            where: { publicId: chkId },
            update: { isComplete: true },
            create: {
                publicId: chkId,
                providerVerificationId: verification.id,
                label: "Identity & Background Check Passed",
                isComplete: true,
                notes: "Passed automatic and manual police clearance checks.",
                sortOrder: 1,
            },
        });

        // Verification Decision (20 rows)
        const decId = `DEC-${String(i + 1).padStart(3, "0")}`;
        await prisma.providerVerificationDecision.upsert({
            where: { publicId: decId },
            update: { status: ProviderVerificationStatus.APPROVED },
            create: {
                publicId: decId,
                providerVerificationId: verification.id,
                adminProfileId: admin.id,
                status: ProviderVerificationStatus.APPROVED,
                reason: "All requirements met according to service marketplace standard.",
                decidedAt: now,
            },
        });

        // Verification Timeline Item (20 rows)
        const vtlId = `VTL-${String(i + 1).padStart(3, "0")}`;
        await prisma.providerVerificationTimelineItem.upsert({
            where: { publicId: vtlId },
            update: {},
            create: {
                publicId: vtlId,
                providerVerificationId: verification.id,
                title: "Application Approved",
                description: "Admin confirmed business certificates and approved provider onboarding.",
                status: ProviderVerificationStatus.APPROVED,
                occurredAt: now,
            },
        });
    }

    // ==========================================
    // 13. SERVICE LISTINGS & MODERATION (20 rows)
    // ==========================================
    console.log("-> Seeding 20 Service Listings & Moderation History...");
    const serviceListings = [];
    for (let i = 0; i < 20; i++) {
        const provider = providerProfiles[i];
        const cat = categories[i % categories.length];
        const area = areas[i % areas.length];
        const admin = adminProfiles[i % adminProfiles.length];
        const publicId = `SRV-${String(i + 1).padStart(3, "0")}`;

        const listing = await prisma.serviceListing.upsert({
            where: { publicId },
            update: {
                serviceStatus: ServiceStatus.ACTIVE,
                moderationStatus: ServiceModerationStatus.NORMAL,
            },
            create: {
                publicId,
                providerProfileId: provider.id,
                categoryId: cat.id,
                name: `Premium ${cat.nameEn} Package`,
                nameKm: `កញ្ចប់សេវា ${cat.nameKm} ពិសេស`,
                description: `Complete, high-grade ${cat.nameEn} service with guaranteed 30-day warranty and trained specialists.`,
                descriptionKm: `សេវាកម្ម ${cat.nameKm} ពេញលេញ ធានាគុណភាពរយៈពេល៣០ថ្ងៃ ដោយជាងជំនាញច្បាស់លាស់។`,
                price: 25.00 + (i * 5),
                priceUnit: "service",
                pricingType: "FIXED",
                duration: "2 hours",
                imageUrl: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=600&auto=format&fit=crop&q=80",
                quantityEnabled: true,
                quantityUnit: "unit",
                minQuantity: 1,
                maxQuantity: 10,
                availabilitySummary: "Available Mon-Sat 8AM - 6PM",
                serviceStatus: ServiceStatus.ACTIVE,
                moderationStatus: ServiceModerationStatus.NORMAL,
            },
        });
        serviceListings.push(listing);

        // Service Listing Area
        await prisma.serviceListingArea.upsert({
            where: {
                serviceListingId_serviceAreaId: {
                    serviceListingId: listing.id,
                    serviceAreaId: area.id,
                },
            },
            update: {},
            create: {
                serviceListingId: listing.id,
                serviceAreaId: area.id,
            },
        });

        // Service Moderation History (20 rows)
        const modId = `MOD-${String(i + 1).padStart(3, "0")}`;
        await prisma.serviceModerationHistory.upsert({
            where: { publicId: modId },
            update: {},
            create: {
                publicId: modId,
                serviceListingId: listing.id,
                adminProfileId: admin.id,
                eventType: AuditEventType.APPROVED,
                reason: "Complies with quality and safety guidelines.",
                note: "Verified service pricing and description.",
                resultingServiceStatus: ServiceStatus.ACTIVE,
                resultingModerationStatus: ServiceModerationStatus.NORMAL,
                createdAt: now,
            },
        });
    }

    // ==========================================
    // 14. CUSTOMER ADDRESSES (20 rows)
    // ==========================================
    console.log("-> Seeding 20 Customer Addresses...");
    const customerAddresses = [];
    for (let i = 0; i < 20; i++) {
        const customer = customerProfiles[i];
        const area = areas[i % areas.length];
        const publicId = `ADDR-${String(i + 1).padStart(3, "0")}`;

        const address = await prisma.customerAddress.upsert({
            where: { publicId },
            update: { isDefault: true },
            create: {
                publicId,
                customerProfileId: customer.id,
                label: i % 2 === 0 ? "Home" : "Office",
                fullName: customer.fullName,
                phone: `+855120000${String(i + 1).padStart(2, "0")}`,
                addressLine: `#${15 + i}, St. ${310 + i * 3}, Sangkat Tuol Svay Prey`,
                notes: "Please call when arriving at front gate.",
                latitude: area.latitude,
                longitude: area.longitude,
                detectedLocation: `${area.nameEn}, ${area.provinceOrCity}`,
                isDefault: true,
            },
        });
        customerAddresses.push(address);
    }

    // ==========================================
    // 15. BOOKINGS & RELATED TABLES (20 rows each)
    // ==========================================
    console.log("-> Seeding 20 Bookings & Details...");
    const bookingStatuses = [
        BookingStatus.COMPLETED,
        BookingStatus.COMPLETED,
        BookingStatus.COMPLETED,
        BookingStatus.ACCEPTED,
        BookingStatus.IN_PROGRESS,
        BookingStatus.PENDING,
        BookingStatus.COMPLETED,
        BookingStatus.COMPLETED,
        BookingStatus.RESCHEDULED,
        BookingStatus.CANCELLED,
        BookingStatus.COMPLETED,
        BookingStatus.COMPLETED,
        BookingStatus.IN_PROGRESS,
        BookingStatus.ACCEPTED,
        BookingStatus.COMPLETED,
        BookingStatus.COMPLETED,
        BookingStatus.PENDING,
        BookingStatus.COMPLETED,
        BookingStatus.COMPLETED,
        BookingStatus.COMPLETED,
    ];

    const bookings = [];
    for (let i = 0; i < 20; i++) {
        const customer = customerProfiles[i];
        const provider = providerProfiles[i];
        const listing = serviceListings[i];
        const address = customerAddresses[i];
        const area = areas[i % areas.length];
        const status = bookingStatuses[i];
        const publicId = `BK-2026-${String(i + 1).padStart(3, "0")}`;

        const booking = await prisma.booking.upsert({
            where: { publicId },
            update: { status },
            create: {
                publicId,
                customerProfileId: customer.id,
                providerProfileId: provider.id,
                serviceListingId: listing.id,
                customerAddressId: address.id,
                serviceAreaId: area.id,
                scheduledAt: new Date(Date.now() + (i - 10) * 24 * 60 * 60 * 1000),
                timeSlot: "09:00 - 11:00 AM",
                quantity: 1,
                estimatedTotal: listing.price,
                serviceAddress: address.addressLine,
                areaSummary: area.nameEn,
                accessInstructions: "Ring bell #2",
                customerNotes: "Please bring full equipment and shoe covers.",
                status,
            },
        });
        bookings.push(booking);

        // Booking Timeline Item (20 rows)
        const btlId = `BTL-2026-${String(i + 1).padStart(3, "0")}`;
        await prisma.bookingTimelineItem.upsert({
            where: { publicId: btlId },
            update: { isComplete: true },
            create: {
                publicId: btlId,
                bookingId: booking.id,
                title: status === BookingStatus.COMPLETED ? "Service Completed" : "Booking Confirmed",
                description: status === BookingStatus.COMPLETED ? "Technician finished the work with customer sign-off." : "Provider accepted the appointment.",
                isComplete: true,
                occurredAt: now,
                sortOrder: 1,
            },
        });

        // Booking Status History (20 rows)
        const bshId = `BSH-2026-${String(i + 1).padStart(3, "0")}`;
        await prisma.bookingStatusHistory.upsert({
            where: { publicId: bshId },
            update: { toStatus: status },
            create: {
                publicId: bshId,
                bookingId: booking.id,
                fromStatus: BookingStatus.PENDING,
                toStatus: status,
                reason: "Scheduled service lifecycle transition.",
                changedAt: now,
            },
        });

        // Booking Issue (20 rows)
        const issId = `ISS-${String(i + 1).padStart(3, "0")}`;
        await prisma.bookingIssue.upsert({
            where: { publicId: issId },
            update: {},
            create: {
                publicId: issId,
                bookingId: booking.id,
                status: i % 4 === 0 ? BookingIssueStatus.RESOLVED : (i % 3 === 0 ? BookingIssueStatus.NEEDS_REVIEW : BookingIssueStatus.NONE),
                summaryEn: `Routine booking check and equipment validation for #${booking.publicId}.`,
                summaryKm: `ការត្រួតពិនិត្យការកក់ជាប្រចាំសម្រាប់ #${booking.publicId}។`,
                resolution: i % 4 === 0 ? "Resolved smoothly by support agent." : null,
                resolvedAt: i % 4 === 0 ? now : null,
            },
        });

        // Review (20 rows)
        const revId = `REV-2026-${String(i + 1).padStart(3, "0")}`;
        const ratings = [5.0, 4.8, 5.0, 4.5, 4.9, 5.0, 4.7, 5.0, 4.6, 4.8, 5.0, 4.9, 4.7, 5.0, 4.8, 5.0, 4.5, 4.9, 5.0, 4.8];
        await prisma.review.upsert({
            where: { publicId: revId },
            update: { rating: ratings[i] },
            create: {
                publicId: revId,
                customerProfileId: customer.id,
                providerProfileId: provider.id,
                serviceListingId: listing.id,
                bookingId: booking.id,
                rating: ratings[i],
                comment: `Exceptional quality of work! Very punctual, polite, and skilled. Highly recommend for ${listing.name}.`,
            },
        });
    }

    // ==========================================
    // 16. PROVIDER INVOICES & BOOKING COMMISSIONS (20 rows each)
    // ==========================================
    console.log("-> Seeding 20 Invoices & Commissions...");
    for (let i = 0; i < 20; i++) {
        const provider = providerProfiles[i];
        const booking = bookings[i];
        const invPublicId = `INV-2026-${String(i + 1).padStart(3, "0")}`;
        const invNum = `INV-FIXIT-2026-${String(1001 + i)}`;

        const bookingAmount = Number(booking.estimatedTotal);
        const commissionRate = 0.10; // 10%
        const commissionAmount = bookingAmount * commissionRate;
        const providerEarning = bookingAmount - commissionAmount;

        const invoice = await prisma.providerInvoice.upsert({
            where: { invoiceNumber: invNum },
            update: {
                totalBookingAmount: bookingAmount,
                totalCommission: commissionAmount,
                status: i % 2 === 0 ? InvoiceStatus.PAID : InvoiceStatus.UNPAID,
            },
            create: {
                publicId: invPublicId,
                invoiceNumber: invNum,
                providerProfileId: provider.id,
                totalBookingAmount: bookingAmount,
                totalCommission: commissionAmount,
                status: i % 2 === 0 ? InvoiceStatus.PAID : InvoiceStatus.UNPAID,
                issuedAt: now,
                dueAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
                paidAt: i % 2 === 0 ? now : null,
                paymentReference: i % 2 === 0 ? `BAKONG-TXN-${990000 + i}` : null,
                notes: `Monthly commission invoice for ${provider.contactName}`,
            },
        });

        // Booking Commission (20 rows)
        const bcomId = `BCOM-${String(i + 1).padStart(3, "0")}`;
        await prisma.bookingCommission.upsert({
            where: { bookingId: booking.id },
            update: {
                invoiceId: invoice.id,
                status: i % 2 === 0 ? CommissionStatus.PAID : CommissionStatus.UNPAID,
            },
            create: {
                publicId: bcomId,
                bookingId: booking.id,
                providerProfileId: provider.id,
                invoiceId: invoice.id,
                commissionType: CommissionType.PERCENTAGE,
                commissionRate: 0.1000,
                bookingAmount: bookingAmount,
                commissionAmount: commissionAmount,
                providerEarning: providerEarning,
                status: i % 2 === 0 ? CommissionStatus.PAID : CommissionStatus.UNPAID,
                paidAt: i % 2 === 0 ? now : null,
            },
        });
    }

    // ==========================================
    // 17. COMMISSION SETTINGS (20 rows)
    // ==========================================
    console.log("-> Seeding 20 Commission Settings...");
    for (let i = 0; i < 20; i++) {
        const publicId = `COM-${String(i + 1).padStart(3, "0")}`;
        await prisma.commissionSetting.upsert({
            where: { publicId },
            update: { value: 0.05 + (i * 0.005) },
            create: {
                publicId,
                type: i % 3 === 0 ? CommissionType.FIXED : CommissionType.PERCENTAGE,
                value: i % 3 === 0 ? 5.0000 : (0.05 + (i * 0.005)),
                description: `Tier ${i + 1} commission rate for category specific services.`,
                isActive: true,
            },
        });
    }

    // ==========================================
    // 18. NOTIFICATIONS (20 rows)
    // ==========================================
    console.log("-> Seeding 20 Notifications...");
    const notifTypes = [
        NotificationType.BOOKING,
        NotificationType.VERIFICATION,
        NotificationType.SERVICE,
        NotificationType.SYSTEM,
        NotificationType.CUSTOMER,
        NotificationType.PROVIDER,
        NotificationType.CATEGORY,
        NotificationType.SERVICE_AREA,
    ];

    for (let i = 0; i < 20; i++) {
        const u = customerUsers[i];
        const publicId = `NOTIF-2026-${String(i + 1).padStart(3, "0")}`;
        const type = notifTypes[i % notifTypes.length];
        await prisma.notification.upsert({
            where: { publicId },
            update: { status: i % 2 === 0 ? NotificationStatus.READ : NotificationStatus.UNREAD },
            create: {
                publicId,
                userId: u.id,
                type,
                status: i % 2 === 0 ? NotificationStatus.READ : NotificationStatus.UNREAD,
                titleEn: `Update on your ${type.toLowerCase()} activity`,
                titleKm: `បច្ចុប្បន្នភាពលើសកម្មភាព ${type.toLowerCase()} របស់អ្នក`,
                messageEn: `Your service booking or profile status has been updated successfully.`,
                messageKm: `ការកក់សេវាកម្ម ឬស្ថានភាពគណនីរបស់អ្នកត្រូវបានធ្វើបច្ចុប្បន្នភាពដោយជោគជ័យ។`,
                priority: "HIGH",
                relatedModule: type,
                relatedRecordId: bookings[i]?.id ?? null,
                readAt: i % 2 === 0 ? now : null,
            },
        });
    }

    // ==========================================
    // 19. AUDIT LOGS (20 rows)
    // ==========================================
    console.log("-> Seeding 20 Audit Logs...");
    const auditEvents = [
        AuditEventType.CREATED,
        AuditEventType.UPDATED,
        AuditEventType.APPROVED,
        AuditEventType.SIGN_IN,
        AuditEventType.SYSTEM_SYNC,
    ];

    for (let i = 0; i < 20; i++) {
        const admin = adminProfiles[i % adminProfiles.length];
        const publicId = `AUD-${String(i + 1).padStart(3, "0")}`;
        await prisma.auditLog.upsert({
            where: { publicId },
            update: {},
            create: {
                publicId,
                adminProfileId: admin.id,
                actorName: admin.fullName,
                eventType: auditEvents[i % auditEvents.length],
                severity: AuditSeverity.INFO,
                actionEn: `Admin executed operation #${i + 1} on system modules`,
                actionKm: `អ្នកគ្រប់គ្រងបានអនុវត្តប្រតិបត្តិការ #${i + 1} លើប្រព័ន្ធ`,
                reasonEn: "Standard operating procedure audit trail",
                relatedModule: "MANAGEMENT",
                metadata: { ip: "127.0.0.1", userAgent: "AdminPortal/1.0" },
                createdAt: now,
            },
        });
    }

    // ==========================================
    // 20. INTERNAL ADMIN NOTES (20 rows)
    // ==========================================
    console.log("-> Seeding 20 Internal Admin Notes...");
    for (let i = 0; i < 20; i++) {
        const admin = adminProfiles[i % adminProfiles.length];
        const publicId = `NOTE-${String(i + 1).padStart(3, "0")}`;
        await prisma.internalAdminNote.upsert({
            where: { publicId },
            update: {},
            create: {
                publicId,
                adminProfileId: admin.id,
                body: `Internal operational review note #${i + 1}: Customer satisfaction score is optimal.`,
                relatedModule: "PROVIDER_VERIFICATION",
                relatedRecordId: providerProfiles[i]?.id ?? null,
            },
        });
    }

    // ==========================================
    // 21. FAQS (20 rows)
    // ==========================================
    console.log("-> Seeding 20 FAQs...");
    const faqData = [
        { qEn: "How do I book a home service?", qKm: "តើខ្ញុំអាចកក់សេវាកម្មផ្ទះដោយរបៀបណា?", aEn: "Select a service category, choose your preferred provider, pick a time slot, and confirm.", aKm: "ជ្រើសរើសប្រភេទសេវាកម្ម ជ្រើសរើសជាងដែលពេញចិត្ត កំណត់ម៉ោង និងបញ្ជាក់ការកក់។", aud: FaqAudience.CUSTOMER },
        { qEn: "What payment methods are supported?", qKm: "តើមានវិធីសាស្ត្រទូទាត់ប្រាក់អ្វីខ្លះ?", aEn: "We support Bakong KHQR, major credit cards, and cash on delivery.", aKm: "យើងគាំទ្រការទូទាត់តាម Bakong KHQR, កាតធនាគារ និងសាច់ប្រាក់ផ្ទាល់។", aud: FaqAudience.CUSTOMER },
        { qEn: "How can I reschedule my booking?", qKm: "តើខ្ញុំអាចពន្យារពេលការកក់ដោយរបៀបណា?", aEn: "Go to your bookings page, tap on the appointment, and select Reschedule.", aKm: "ចូលទៅកាន់ទំព័រការកក់ ចុចលើការណាត់ជួប ហើយជ្រើសរើសពន្យារពេល។", aud: FaqAudience.CUSTOMER },
        { qEn: "Are service providers verified?", qKm: "តើជាងទាំងអស់ត្រូវបានផ្ទៀងផ្ទាត់ដែរឬទេ?", aEn: "Yes, all providers undergo identity and background checks before activation.", aKm: "បាទ/ចាស ជាងទាំងអស់ត្រូវបានត្រួតពិនិត្យអត្តសញ្ញាណ និងប្រវត្តិយ៉ាងម៉ត់ចត់។", aud: FaqAudience.CUSTOMER },
        { qEn: "What if I am unsatisfied with the service?", qKm: "ចុះបើខ្ញុំមិនពេញចិត្តនឹងសេវាកម្ម?", aEn: "You can report an issue directly in the app within 48 hours for immediate review.", aKm: "អ្នកអាចរាយការណ៍បញ្ហានៅលើកម្មវិធីក្នុងរយៈពេល ៤៨ ម៉ោងដើម្បីដោះស្រាយភ្លាមៗ។", aud: FaqAudience.CUSTOMER },
        { qEn: "How do I join as a service provider?", qKm: "តើខ្ញុំអាចចុះឈ្មោះធ្វើជាអ្នកផ្តល់សេវាដោយរបៀបណា?", aEn: "Sign up via the Provider App, upload your credentials and ID, and await approval.", aKm: "ចុះឈ្មោះតាម Provider App ផ្ញើឯកសារអត្តសញ្ញាណ និងរង់ចាំការអនុម័ត។", aud: FaqAudience.PROVIDER },
        { qEn: "When are provider payouts disbursed?", qKm: "តើប្រាក់ចំណូលរបស់ជាងបើកជូននៅពេលណា?", aEn: "Payouts are settled bi-weekly directly to your Bakong account.", aKm: "ការទូទាត់ត្រូវបានធ្វើឡើងរៀងរាល់ពីរសប្តាហ៍ម្តងតាមគណនីបាគង។", aud: FaqAudience.PROVIDER },
        { qEn: "Can I set my own custom pricing?", qKm: "តើខ្ញុំអាចកំណត់តម្លៃផ្ទាល់ខ្លួនបានទេ?", aEn: "Yes, you can configure your service packages and rates freely.", aKm: "បាទ/ចាស អ្នកអាចកំណត់កញ្ចប់សេវា និងតម្លៃបានតាមចិត្ត។", aud: FaqAudience.PROVIDER },
        { qEn: "How does the commission rate work?", qKm: "តើកម្រៃជើងសារគិតយ៉ាងដូចម្តេច?", aEn: "A low commission fee is deducted only on successfully completed bookings.", aKm: "កម្រៃជើងសារទាបត្រូវបានកាត់តែលើការងារដែលបានបញ្ចប់ជោគជ័យប៉ុណ្ណោះ។", aud: FaqAudience.PROVIDER },
        { qEn: "Can I accept bookings in multiple areas?", qKm: "តើខ្ញុំអាចទទួលការងារនៅច្រើនតំបន់បានទេ?", aEn: "Yes, configure your service radius and active coverage areas in settings.", aKm: "បាទ/ចាស អ្នកអាចកំណត់តំបន់ផ្តល់សេវាកម្មក្នុងទំព័រកំណត់។", aud: FaqAudience.PROVIDER },
        { qEn: "How do I turn on push notifications?", qKm: "តើត្រូវបើកដំណឹង push notifications យ៉ាងដូចម្តេច?", aEn: "Enable notifications in your device settings and app preferences.", aKm: "បើកដំណើរការការជូនដំណឹងនៅក្នុងការកំណត់ឧបករណ៍របស់អ្នក។", aud: FaqAudience.CUSTOMER },
        { qEn: "Can I cancel a booking without penalty?", qKm: "តើខ្ញុំអាចបោះបង់ការកក់ដោយមិនគិតប្រាក់ពិន័យបានទេ?", aEn: "Cancellations made 2 hours prior to scheduled time are completely free.", aKm: "ការបោះបង់មុនពេល ២ ម៉ោងគឺឥតគិតថ្លៃទាំងស្រុង។", aud: FaqAudience.CUSTOMER },
        { qEn: "Is emergency repair service available?", qKm: "តើមានសេវាជួសជុលបន្ទាន់ដែរឬទេ?", aEn: "Yes, look for 24/7 tagged emergency providers in your district.", aKm: "បាទ/ចាស សូមស្វែងរកជាងដែលមានស្លាក 24/7 ក្នុងខណ្ឌរបស់អ្នក។", aud: FaqAudience.CUSTOMER },
        { qEn: "How do ratings and reviews work?", qKm: "តើប្រព័ន្ធវាយតម្លៃ និងមតិយោបល់ដំណើរការយ៉ាងដូចម្តេច?", aEn: "Only verified customers who completed a booking can submit reviews.", aKm: "មានតែអតិថិជនដែលបានបញ្ចប់ការកក់ពិតប្រាកដទើបអាចវាយតម្លៃបាន។", aud: FaqAudience.CUSTOMER },
        { qEn: "How do I update my business working hours?", qKm: "តើត្រូវកែសម្រួលម៉ោងធ្វើការយ៉ាងដូចម្តេច?", aEn: "Update your business hours anytime from the Provider Profile tab.", aKm: "កែសម្រួលម៉ោងធ្វើការបានគ្រប់ពេលវេលាក្នុងទំព័រប្រវត្តិរូប។", aud: FaqAudience.PROVIDER },
        { qEn: "What equipment do I need to bring?", qKm: "តើជាងត្រូវយកឧបករណ៍អ្វីខ្លះទៅ?", aEn: "Providers must arrive with certified tools and required protective gear.", aKm: "ជាងត្រូវនាំយកឧបករណ៍ស្តង់ដារ និងសម្ភារការពារត្រឹមត្រូវ។", aud: FaqAudience.PROVIDER },
        { qEn: "How to connect my Telegram account for alerts?", qKm: "តើភ្ជាប់គណនី Telegram ដើម្បីទទួលដំណឹងយ៉ាងដូចម្តេច?", aEn: "Open Account Settings -> Connect Telegram and send /start to our bot.", aKm: "ចូលការកំណត់ -> ភ្ជាប់ Telegram ហើយផ្ញើ /start ទៅកាន់ bot របស់យើង។", aud: FaqAudience.CUSTOMER },
        { qEn: "Can I pause my availability for holidays?", qKm: "តើខ្ញុំអាចផ្អាកការទទួលការងារពេលឈប់សម្រាកបានទេ?", aEn: "Toggle 'Temporarily Paused' in your business profile setting.", aKm: "បើកមុខងារ 'ផ្អាកជាបណ្តោះអាសន្ន' នៅក្នុងការកំណត់របស់អ្នក។", aud: FaqAudience.PROVIDER },
        { qEn: "Is there customer support on weekends?", qKm: "តើមានក្រុមគាំទ្រនៅចុងសប្តាហ៍ទេ?", aEn: "Our support agents are active 7 days a week from 7 AM to 10 PM.", aKm: "ក្រុមការងារយើងបំរើសេវា ៧ ថ្ងៃក្នុងមួយសប្តាហ៍ ចាប់ពីម៉ោង ៧ ព្រឹកដល់ ១០ យប់។", aud: FaqAudience.CUSTOMER },
        { qEn: "How can I request an official tax invoice?", qKm: "តើខ្ញុំអាចស្នើសុំវិក្កយបត្រផ្លូវការដោយរបៀបណា?", aEn: "Contact support or download VAT invoices from your booking history.", aKm: "ទាក់ទងមកកាន់ផ្នែកគាំទ្រ ឬទាញយកវិក្កយបត្រពីប្រវត្តិនៃការកក់។", aud: FaqAudience.CUSTOMER },
    ];

    for (let i = 0; i < faqData.length; i++) {
        const item = faqData[i];
        const publicId = `FAQ-${String(i + 1).padStart(3, "0")}`;
        await prisma.faq.upsert({
            where: { publicId },
            update: {
                questionEn: item.qEn,
                questionKm: item.qKm,
                answerEn: item.aEn,
                answerKm: item.aKm,
                audience: item.aud,
                sortOrder: i + 1,
                isActive: true,
            },
            create: {
                publicId,
                audience: item.aud,
                category: "general",
                questionEn: item.qEn,
                questionKm: item.qKm,
                answerEn: item.aEn,
                answerKm: item.aKm,
                keywords: ["service", "booking", "repair", "cambodia"],
                sortOrder: i + 1,
                isActive: true,
            },
        });
    }

    // ==========================================
    // 22. SUPPORT REQUESTS (20 rows)
    // ==========================================
    console.log("-> Seeding 20 Support Requests...");
    const supportStatuses = [
        SupportRequestStatus.OPEN,
        SupportRequestStatus.IN_PROGRESS,
        SupportRequestStatus.RESOLVED,
    ];

    for (let i = 0; i < 20; i++) {
        const u = customerUsers[i];
        const publicId = `SUP-${String(i + 1).padStart(3, "0")}`;
        await prisma.supportRequest.upsert({
            where: { publicId },
            update: {},
            create: {
                publicId,
                userId: u.id,
                audience: i % 2 === 0 ? FaqAudience.CUSTOMER : FaqAudience.PROVIDER,
                category: "Billing & Inquiries",
                subject: `Inquiry regarding service booking #${bookings[i]?.publicId ?? (i + 1)}`,
                description: `Customer requested detailed assistance with invoice and schedule timing adjustments.`,
                relatedBookingId: bookings[i]?.id ?? null,
                status: supportStatuses[i % supportStatuses.length],
            },
        });
    }

    // ==========================================
    // 23. SUPPORT PAGES (All 4 unique Enum keys)
    // ==========================================
    console.log("-> Seeding Support Pages (all enum keys)...");
    const supportPageKeys = [
        SupportPageKey.ABOUT,
        SupportPageKey.MISSION,
        SupportPageKey.PROVIDER_CONTACT,
        SupportPageKey.CUSTOMER_CONTACT,
    ];

    for (let i = 0; i < supportPageKeys.length; i++) {
        const key = supportPageKeys[i];
        await prisma.supportPage.upsert({
            where: { pageKey: key },
            update: {},
            create: {
                publicId: `SPG-${String(i + 1).padStart(3, "0")}`,
                pageKey: key,
                contentEn: {
                    title: `FixItHome ${key}`,
                    description: `Connecting homeowners in Cambodia with certified, trustworthy home maintenance specialists.`,
                    phone: "+855 23 888 999",
                    email: "support@fixithome.com",
                    address: "Phnom Penh, Cambodia",
                },
                contentKm: {
                    title: `FixItHome ${key}`,
                    description: `ភ្ជាប់ទំនាក់ទំនងម្ចាស់គេហដ្ឋានជាមួយជាងជំនាញថែទាំផ្ទះប្រកបដោយទំនុកចិត្ត និងវិជ្ជាជីវៈខ្ពស់នៅកម្ពុជា។`,
                    phone: "+855 23 888 999",
                    email: "support@fixithome.com",
                    address: "រាជធានីភ្នំពេញ កម្ពុជា",
                },
                isActive: true,
            },
        });
    }

    console.log("\n🎉 ALL 20-ROW SEEDING COMPLETED SUCCESSFULLY ACROSS ALL 37 MODELS & MODULES!");
}

main()
    .catch((e) => {
        console.error("❌ Error during seeding:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
