-- CreateTable
CREATE TABLE "faqs" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "questionEn" TEXT NOT NULL,
    "questionKm" TEXT NOT NULL,
    "answerEn" TEXT NOT NULL,
    "answerKm" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faqs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "faqs_publicId_key" ON "faqs"("publicId");

-- CreateIndex
CREATE INDEX "faqs_isActive_sortOrder_idx" ON "faqs"("isActive", "sortOrder");

-- Seed default FAQs (matches previous support UI content)
INSERT INTO "faqs" ("id", "publicId", "questionEn", "questionKm", "answerEn", "answerKm", "sortOrder", "isActive", "createdAt", "updatedAt")
VALUES
(
  'faq_seed_payment',
  'faq-payment',
  'How does payment work? Do I need to pay online?',
  'តើការបង់ប្រាក់ដំណើរការយ៉ាងដូចម្តេច? តើខ្ញុំត្រូវបង់ប្រាក់តាមអនឡាញទេ?',
  'No upfront payment is required. Pay only after the service is completed. You can pay the provider directly in cash or by a supported bank transfer after the work is delivered.',
  'មិនតម្រូវឱ្យបង់ប្រាក់មុនទេ។ បង់ប្រាក់បន្ទាប់ពីសេវាកម្មត្រូវបានបញ្ចប់ប៉ុណ្ណោះ។ អ្នកអាចបង់ប្រាក់ដោយផ្ទាល់ទៅអ្នកផ្តល់សេវាជាសាច់ប្រាក់ ឬតាមការផ្ទេរប្រាក់តាមធនាគារដែលគាំទ្រ បន្ទាប់ពីការងារត្រូវបានបញ្ចប់។',
  1,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'faq_seed_estimate',
  'faq-estimate',
  'What happens if the actual repair costs more than the estimate?',
  'តើមានអ្វីកើតឡើង ប្រសិនបើថ្លៃជួសជុលជាក់ស្តែងខ្ពស់ជាងតម្លៃប៉ាន់ស្មាន?',
  'Booking prices are estimates. The provider will check the required work on-site and explain any price changes before starting. You can review and agree to the updated amount first.',
  'តម្លៃកក់គឺជាតម្លៃប៉ាន់ស្មាន។ អ្នកផ្តល់សេវានឹងពិនិត្យការងារដែលត្រូវធ្វើនៅទីតាំង និងពន្យល់អំពីការផ្លាស់ប្តូរតម្លៃណាមួយ មុនពេលចាប់ផ្តើមការងារ។ អ្នកអាចពិនិត្យ និងយល់ព្រមលើតម្លៃថ្មីជាមុន។',
  2,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'faq_seed_vendors',
  'faq-vendors',
  'Are the vendors on your platform trusted?',
  'តើអ្នកផ្តល់សេវានៅលើប្រព័ន្ធមានភាពគួរឱ្យទុកចិត្តទេ?',
  'Yes. FixItHome reviews provider identity, credentials, and service information before listing a provider on the platform.',
  'បាទ/ចាស។ FixItHome ពិនិត្យអត្តសញ្ញាណ លិខិតបញ្ជាក់ និងព័ត៌មានសេវាកម្មរបស់អ្នកផ្តល់សេវា មុនពេលដាក់បង្ហាញនៅលើប្រព័ន្ធ។',
  3,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'faq_seed_booking_changes',
  'faq-booking-changes',
  'Can I reschedule or cancel my booking?',
  'តើខ្ញុំអាចប្តូរពេល ឬបោះបង់ការកក់បានទេ?',
  'Yes. When your booking status allows changes, open Booking Details to reschedule or cancel your request.',
  'បាន។ នៅពេលស្ថានភាពការកក់របស់អ្នកអនុញ្ញាតឱ្យធ្វើការផ្លាស់ប្តូរ សូមបើកព័ត៌មានលម្អិតនៃការកក់ ដើម្បីប្តូរពេល ឬបោះបង់សំណើរបស់អ្នក។',
  4,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'faq_seed_contact',
  'faq-contact',
  'How do I contact support in Cambodia?',
  'តើខ្ញុំទាក់ទងផ្នែកគាំទ្រនៅកម្ពុជាបានដោយរបៀបណា?',
  'Contact our team through Telegram support or call the customer hotline at 1800-405-99.',
  'ទាក់ទងក្រុមការងាររបស់យើងតាមការគាំទ្រ Telegram ឬទូរស័ព្ទទៅផ្នែកគាំទ្រអតិថិជនតាមលេខ 1800-405-99។',
  5,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);
