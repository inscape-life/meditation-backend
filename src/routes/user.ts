import { Router } from "express";
import {
  login,
  signup,
  getDashboardStats,
  getCurrentUserInfoHandler,
  verifyEmail,
  getHomePage,
  resendOtp,
  updateUserDetails,
} from "../controllers/user/user";
import { checkAuth } from "src/middleware/check-auth";
import { getUserAudioHistory, removeDownloadUrl, UserAudioHistory } from "src/controllers/useraudiohistory/useraudiohistory-controller";
import { getAudioById, getfilterOptions, getTrendingAudios, searchAudios } from "src/controllers/audio/audio-controller";
import { getAllCollections, getCollectionWithAudio } from "src/controllers/collection/collection-controller";
import { searchCollections } from "src/controllers/company/company";
import { getAllFAQ, getFAQById } from "src/controllers/FAQs/FAQs-controller";
import { createContactUs } from "src/controllers/contact-us/contact-us-controller";
import { getSettings } from "src/controllers/settings/settings-controller";

const router = Router();

router.post("/signup", signup);
router.post("/resend-otp", resendOtp);
router.post("/login", login);
router.patch("/email/verify", verifyEmail);

router.get("/dashboard", checkAuth, getDashboardStats);
router.post("/audio-history",checkAuth, UserAudioHistory);
router.get("/audio-history",checkAuth, getUserAudioHistory);
router.delete("/audio-history/:id",checkAuth, removeDownloadUrl);
router.route("/user-info").all(checkAuth).get(getCurrentUserInfoHandler).put(updateUserDetails);
// router.get("/", checkAuth, );

//HOME PAGE
router.get("/home",checkAuth, getHomePage);

//SEARCH Routes
router.get("/search/audio",checkAuth, searchAudios);
router.get("/audio/filters",checkAuth, getfilterOptions);

//Collection routes
router.get("/discover/collections",checkAuth, getAllCollections);
router.get("/collections/:id/audios",checkAuth, getCollectionWithAudio);
router.get("/search/collections",checkAuth, searchCollections);

//User-details routes
router.put("/update/details",checkAuth, updateUserDetails);

//Audio routes
router.get("/audio/:id",checkAuth, getAudioById);
router.get("/trending-audio",checkAuth, getTrendingAudios);

//FAQs routes
router.get("/FAQs/get-all",checkAuth, getAllFAQ);
router.get("/FAQs/:id",checkAuth, getFAQById);
router.post("/contact-us", createContactUs);

//Settings
router.get("/settings", getSettings);




export { router };