import mongoose from "mongoose";

const adminSchema = new mongoose.Schema(
  {
    identifier: {
      type: String,
      // required: true,
      unique: true,
    },
    role: {
      type: String,
      requried: true,
      default: "admin",
    },
    fullName: {
      type: String,
      requried: true,
    },
    firstName: {
      type: String,
    },
    lastName: {
      type: String,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      required: true,
      unique: true,
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
    },
    gender:{
      type: String,      
    },
    address: { 
        type: String
     },
    isBlocked: {
      type: Boolean,
      default: false,
    },
    isAccountActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export const adminModel = mongoose.model("admin", adminSchema);
