import { Router } from "express";
import {  deleteAUser, getAdminDetail, getAllUsers, getAnalytics, getAUserById, getDashboardStats,toggleBlockedUser, updateAdmin, updateAdminProfilepic, updateAUser,} from "../controllers/admin/admin";
import { deleteMultipleUser, getAllBlockedUser,  } from "src/controllers/user/user";
import { createCollection, deleteCollection, updateCollection } from "src/controllers/collection/collection-controller";
import { deleteAudio, searchAudios, updateAudio, uploadAudio } from "src/controllers/audio/audio-controller";
import { createCompany, deleteCompanyById, deleteMultipleCompany, getAllCompanies, getCompanyById, getCompanyByIdForAdmin, toggleBlockedCompany, updateCompanyName } from "src/controllers/company/company";
import { createBestFor, deleteBestFor, updateBestFor } from "src/controllers/bestfor/bestfor-controller";
import { createLevel, deleteLevel, updateLevel } from "src/controllers/level/level-controller";
import { getAllCoupons, getAllStripeProducts, getAllSubscriptionsHandler, getPrices, getSubscriptionByIdHandler, subscriptionExpireInAWeek, subscriptionExpireRemainder, updatePrices } from "src/controllers/subscription/subscription-controller";
import { getAllNotificationsOfCompany, markAllNotificationsAsReadAdmin, sendNotificationToUser, sendNotificationToUsers } from "src/controllers/notifications/notifications-controller";
import { createCompanyJoinRequest, deleteCompanyJoinRequest, getAllCompanyJoinRequests, getAllRejectedJoinRequests, getCompanyJoinRequestById, updateCompanyJoinRequest } from "src/controllers/company-join-requests/company-join-requests-controller";
import { createFAQ, deleteFAQ, getAllFAQ, getFAQById, updateFAQ } from "src/controllers/FAQs/FAQs-controller";
import { createSettings, getSettings } from "src/controllers/settings/settings-controller";

const router = Router();

router.get("/",getAdminDetail)
router.put("/",updateAdmin)
router.patch("/profile/pic",updateAdminProfilepic)
router.post("/upload-audio",uploadAudio)
router.post("/upload-collection",createCollection)
router.post("/create-company", createCompany);
router.post("/create-bestfor",createBestFor)
router.post("/create-level", createLevel);
router.get("/get-all-users", getAllUsers);
router.get("/users/blocked", getAllBlockedUser);
router.get("/dashboard", getDashboardStats)
router.get("/user/:id",getAUserById)
router.get("/get-all-companies", getAllCompanies);
router.get("/get-company-by-id/:id", getCompanyByIdForAdmin);
router.put("/update/collection/:id", updateCollection);
router.put("/update/audio/:id",updateAudio)
router.put("/user/update/:id",updateAUser)
router.put("/companies/:id/block", toggleBlockedCompany);
router.put("/user/:id/block", toggleBlockedUser);
router.patch("/level/:id",updateLevel)
router.patch("/bestfor/:id",updateBestFor)
router.patch("/update/company/name/:id",updateCompanyName)
router.delete("/delete-collection/:id",deleteCollection)
router.delete("/delete-company/:id", deleteCompanyById);
router.delete("/user/delete-user/:id", deleteAUser);
router.delete("/delete-audio/:id", deleteAudio);
router.delete("/delete-bestfor/:id",deleteBestFor);
router.delete("/delete-level/:id",deleteLevel)
//Analysis
router.get("/analysis", getAnalytics)
 
//plan expire remainder
router.post("/subscription-expire-remainder/:id", subscriptionExpireRemainder)

//stripe
router.post('/update-prices', updatePrices);
router.get('/products', getAllStripeProducts);
router.get('/prices', getPrices);
router.get('/coupons', getAllCoupons);
router.get('/subscriptions', getAllSubscriptionsHandler);
router.get('/subscriptions/:subscriptionId', getSubscriptionByIdHandler);
router.get('/subscriptions-expire-in-a-week', subscriptionExpireInAWeek);

//notifications route
router.post("/send-notification", sendNotificationToUsers)
router.post("/send-notification-to-specific-users", sendNotificationToUser)
router.route("/:id/notifications").get( getAllNotificationsOfCompany).put( markAllNotificationsAsReadAdmin)
// router.route("/:id/notifications/mark-as-read").put(markSingleNotificationAsRead)

//company-join-request routes
router.post("/company-join-requests", createCompanyJoinRequest);
router.get("/company-join-requests/:id", getCompanyJoinRequestById);
router.get("/rejected/company-join-requests", getAllRejectedJoinRequests);
router.get("/company-join-requests", getAllCompanyJoinRequests);
router.put("/company-join-requests/:id", updateCompanyJoinRequest);
router.delete("/company-join-requests/:id", deleteCompanyJoinRequest);
router.get("/search/audio", searchAudios);

//FAQs routes
router.route("/FAQs").post( createFAQ).get(getAllFAQ);
router.get("/FAQs/:id", getFAQById);
router.put("/FAQs/:id", updateFAQ);
router.delete("/FAQs/:id", deleteFAQ);

//Settings
router.post("/settings", createSettings);
router.get("/settings", getSettings);

//delete multiple users
router.post("/delete-multiple-user", deleteMultipleUser);
router.post("/delete-multiple-company", deleteMultipleCompany);

export { router }