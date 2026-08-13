import { Request, Response } from "express";
import { getLang } from "../../utils/get-lang.util";
import { t } from "../../i18n/translate";
import { VendorLocationsService } from "../../services/vendor/vendor.locations.service";

export const getLocations = async (req: Request, res: Response) => {
    const lang = getLang(req);
    const data = await VendorLocationsService.getLocations();
    return res.status(200).json({
        success: true,
        message: t("VENDOR_LOCATIONS_RETRIEVED", lang),
        data: {
            provinces: data.provinces,
            source: data.source,
        },
    });
};
