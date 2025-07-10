import { Schema, model } from "mongoose";

const contactUsSchema = new Schema(
	{
		userId: [
			{
				type: Schema.Types.ObjectId,
				ref: "users",
				// required: true,
			},
		],
		firstName: {
			type: String,
			required: true,
		},
		lastName: {
			type: Object,
			required: true,
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
		phoneNumber: {
			type: String,
		},
		reason:{
            type:String,
            required:true
        },
        status:{
            type:String,
            enum:["Pending","Resolved"],
            default:"Pending"
        }
	},
	{ timestamps: true }
);

export const contactUsModel = model("contact_us", contactUsSchema);