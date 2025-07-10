import mongoose, { Schema, Document } from "mongoose";

const CompanySchema = new Schema(
	{
		identifier: {
			type: String,
			// required: true,
			unique: true,
		},
		firstName: {
			type: String,
		},
		lastName: {
			type: String,
		},
		dob: {
			type: Date,
		},
		gender: {
			type: String,
		},
		stripeCustomerId: {
			type: String,
			default: null,
		},
		subscriptionStatus: {
			type: String,
			default: "inactive",
		},
		subscriptionId: {
			type: String,
			default: null,
		},
		subscriptionStartDate: {
			type: Date,
			default: null,
		},
		subscriptionExpiryDate: {
			type: Date,
			default: null,
		},
		numUsersForPlan: {
			type: Number,
			default: 0,
		},
		totalUsers: {
			type: Number,
			default: 0,
		},
		role: {
			type: String,
			required: true,
			default: "company",
		},
		planInterval: {
			type: String,
			default: null,
		},
		planType: {
			type: String,
			default: null,
		},
		companyName: {
			type: String,
			required: true,
		},
		email: {
			type: String,
			trim: true,
			lowercase: true,
			required: true,
			// unique: true,
		},
		password: {
			type: String,
			required: true,
			select: false,
		},
		isBlocked: {
			type: Boolean,
			default: false,
		},
		isAccountActive: {
			type: Boolean,
			default: true,
		},
		emailVerified: {
			type: Boolean,
			default: false,
		},
		isVerifiedByAdmin: {
			type: String,
			enum: ["pending", "approved", "rejected"],
			default: "pending",
		},
	},
	{ timestamps: true }
);

export const companyModels = mongoose.model("companies", CompanySchema);
