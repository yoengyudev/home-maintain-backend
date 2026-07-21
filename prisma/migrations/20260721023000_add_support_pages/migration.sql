-- CreateEnum
CREATE TYPE "SupportPageKey" AS ENUM ('ABOUT', 'MISSION');

-- CreateTable
CREATE TABLE "support_pages" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "pageKey" "SupportPageKey" NOT NULL,
    "contentEn" JSONB NOT NULL,
    "contentKm" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_pages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "support_pages_publicId_key" ON "support_pages"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "support_pages_pageKey_key" ON "support_pages"("pageKey");

-- CreateIndex
CREATE INDEX "support_pages_isActive_idx" ON "support_pages"("isActive");

-- Seed About Us
INSERT INTO "support_pages" ("id", "publicId", "pageKey", "contentEn", "contentKm", "isActive", "createdAt", "updatedAt")
VALUES (
  'support_page_about',
  'support-about',
  'ABOUT',
  '{
    "eyebrow": "Our Cambodian Roots",
    "title": "Simple, Trusted Home Services",
    "descriptionOne": "FixItHome was created to help people in Phnom Penh find trusted home maintenance providers more easily. Customers can browse services, compare providers, and request bookings in one place.",
    "descriptionTwo": "We focus on clear service information, estimated pricing, verified providers, and payment after the service is completed.",
    "trustTitle": "Trust, Safety & Vetting",
    "trustDescription": "Providers listed on FixItHome go through a review process that includes:",
    "trustItems": [
      "Identity and background information checks.",
      "Service capability and credential review.",
      "Clear estimated pricing before a booking is submitted."
    ],
    "learnMissionLabel": "Learn about our mission"
  }'::jsonb,
  '{
    "eyebrow": "ដើមកំណើតនៅកម្ពុជា",
    "title": "សេវាកម្មផ្ទះងាយស្រួល និងគួរឱ្យទុកចិត្ត",
    "descriptionOne": "FixItHome ត្រូវបានបង្កើតឡើង ដើម្បីជួយឱ្យប្រជាជននៅភ្នំពេញស្វែងរកអ្នកផ្តល់សេវាថែទាំផ្ទះដែលគួរឱ្យទុកចិត្តបានកាន់តែងាយស្រួល។ អតិថិជនអាចរុករកសេវាកម្ម ប្រៀបធៀបអ្នកផ្តល់សេវា និងស្នើសុំការកក់នៅកន្លែងតែមួយ។",
    "descriptionTwo": "យើងផ្តោតលើព័ត៌មានសេវាកម្មច្បាស់លាស់ តម្លៃប៉ាន់ស្មាន អ្នកផ្តល់សេវាដែលបានផ្ទៀងផ្ទាត់ និងការបង់ប្រាក់បន្ទាប់ពីសេវាកម្មត្រូវបានបញ្ចប់។",
    "trustTitle": "ភាពគួរឱ្យទុកចិត្ត សុវត្ថិភាព និងការផ្ទៀងផ្ទាត់",
    "trustDescription": "អ្នកផ្តល់សេវាដែលបានដាក់បង្ហាញនៅលើ FixItHome ត្រូវឆ្លងកាត់ការពិនិត្យ រួមមាន៖",
    "trustItems": [
      "ការពិនិត្យអត្តសញ្ញាណ និងព័ត៌មានប្រវត្តិរូប។",
      "ការពិនិត្យសមត្ថភាពសេវាកម្ម និងលិខិតបញ្ជាក់។",
      "បង្ហាញតម្លៃប៉ាន់ស្មានច្បាស់លាស់ មុនពេលដាក់សំណើកក់។"
    ],
    "learnMissionLabel": "ស្វែងយល់អំពីបេសកកម្មរបស់យើង"
  }'::jsonb,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- Seed Our Mission
INSERT INTO "support_pages" ("id", "publicId", "pageKey", "contentEn", "contentKm", "isActive", "createdAt", "updatedAt")
VALUES (
  'support_page_mission',
  'support-mission',
  'MISSION',
  '{
    "statementLabel": "Our Mission",
    "title": "Supporting Better Cambodian Homes",
    "description": "Our mission is to make home services easier to find, safer to book, and clearer to manage while supporting trusted local service providers.",
    "valuesTitle": "Our Core Values",
    "values": [
      {
        "icon": "heart",
        "title": "Respect for Skilled Work",
        "description": "We support professional standards and better opportunities for skilled service providers in Cambodia."
      },
      {
        "icon": "shield",
        "title": "Clear and Honest Service",
        "description": "Customers receive estimated pricing before booking and pay after the service is completed."
      }
    ],
    "qualityTitle": "Service Quality Commitment",
    "qualityDescription": "We aim to connect customers with trusted providers and make it easier to resolve service concerns clearly and fairly."
  }'::jsonb,
  '{
    "statementLabel": "បេសកកម្មរបស់យើង",
    "title": "គាំទ្រផ្ទះនៅកម្ពុជាឱ្យកាន់តែប្រសើរ",
    "description": "បេសកកម្មរបស់យើងគឺធ្វើឱ្យសេវាកម្មផ្ទះងាយស្រួលស្វែងរក មានសុវត្ថិភាពក្នុងការកក់ និងច្បាស់លាស់ក្នុងការគ្រប់គ្រង ព្រមទាំងគាំទ្រអ្នកផ្តល់សេវាក្នុងស្រុកដែលគួរឱ្យទុកចិត្ត។",
    "valuesTitle": "គុណតម្លៃស្នូលរបស់យើង",
    "values": [
      {
        "icon": "heart",
        "title": "ការគោរពជំនាញវិជ្ជាជីវៈ",
        "description": "យើងគាំទ្រស្តង់ដារវិជ្ជាជីវៈ និងឱកាសកាន់តែប្រសើរសម្រាប់អ្នកផ្តល់សេវាដែលមានជំនាញនៅកម្ពុជា។"
      },
      {
        "icon": "shield",
        "title": "សេវាកម្មច្បាស់លាស់ និងស្មោះត្រង់",
        "description": "អតិថិជនទទួលបានតម្លៃប៉ាន់ស្មានមុនពេលកក់ និងបង់ប្រាក់បន្ទាប់ពីសេវាកម្មត្រូវបានបញ្ចប់។"
      }
    ],
    "qualityTitle": "ការប្តេជ្ញាចិត្តចំពោះគុណភាពសេវាកម្ម",
    "qualityDescription": "យើងមានគោលបំណងភ្ជាប់អតិថិជនជាមួយអ្នកផ្តល់សេវាដែលគួរឱ្យទុកចិត្ត និងធ្វើឱ្យការដោះស្រាយបញ្ហាសេវាកម្មកាន់តែងាយស្រួល ច្បាស់លាស់ និងយុត្តិធម៌។"
  }'::jsonb,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);
