import mongoose from "mongoose";

const settingSchema = new mongoose.Schema(
	{
		privacyPolicy: {
			type: String,
			default: null,
		},
		termsAndConditions: {
			type: String,
			default: null,
		},
		isActive: {
			type: Boolean,
			default: true,
		},
	},
	{ timestamps: true }
);

export const settingModel = mongoose.model("settings", settingSchema);
