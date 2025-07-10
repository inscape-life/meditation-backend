import mongoose, { Types } from "mongoose";

const usersSchema = new mongoose.Schema(
  {
    identifier: {
      type: String,
      // required: true,
      unique: true,
    },
    role: {
      type: String,
      required: true,
      default: "user",
    },
    firstName: {
      type: String,
      required: true,
    },
    lastName: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      required: true,
      unique: true,
    },
    companyId:{
      type: Types.ObjectId,
      ref: "companies"
    },
    companyName: {
      type: String,
      default: null,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    phoneNumber: {
      type: String,
    },
    planType: {
      type: String,
    },
    profilePic: {
      type: String,
      default: null,
    },
    gender: {
      type: String,
      default: null,
    },
    dob: {
      type: Date,
      default: null,
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
    isAccountActive: {
      type: Boolean,
      default: true,
    },
    emailVerified:{
      type: Boolean,
      default: false,
    },
    totalMeditationListen:{
      type: Number,
      default: 0,
    },
    isVerifiedByCompany:{
      type:String,
      enum:["pending","approved","rejected"],
      default:"pending"
    },
    isTermsAccepted: {
      type: Boolean,
      default: false,
    },
    audioDownloaded: {
      type: Number,
      default: 0,
    },
   
  },
  { timestamps: true }
);

export const usersModel = mongoose.model("users", usersSchema);
