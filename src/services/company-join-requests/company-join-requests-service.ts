import { Response } from "express";
import { httpStatusCode } from "src/lib/constant";
import { errorResponseHandler } from "src/lib/errors/error-response-handler";
import {  sendWelcomeEmail } from "src/utils/mails/mail";
import { companyJoinRequestsModel } from "src/models/company-join-requests/company-join-requests-schema";
import { companyModels } from "src/models/company/company-schema";
import stripe from "src/configF/stripe";
import { notificationsModel } from "src/models/notifications/notification-schema";
import { adminModel } from "src/models/admin/admin-schema";

export const createCompanyJoinRequestService = async (payload: any) => {
	// Check if a join request already exists for the userId with a status other than "Rejected"
	const existingRequest = await companyJoinRequestsModel.findOne({
		companyId: payload.companyId,
		status: { $ne: "Rejected" },
	});

	if (existingRequest) {
		return { message: "Already join request sent" };
	}

	// Create a new join request
	const newJoinRequest = await companyJoinRequestsModel.create(payload);
	const user = await companyModels.findById(payload.companyId);
	const admins = await adminModel.find({}, '_id'); // Fetch only the _id field
	const adminIds = admins.map(admin => admin._id);

	// Create notification for all admins
	const adminNotif = await notificationsModel.create({
		userIds: adminIds, // Map all admin IDs here
		userType: 'admin', // Changed to 'admin' since we're notifying admins
		title:  'New user join request' , // Using object format as per schema
		description:  `${user?.companyName} has sent a join request.`,
	});
};

export const getCompanyJoinRequestByIdService = async (req: any, res: Response) => {
	try {
		const joinRequest = await companyJoinRequestsModel.find({ companyId: req.currentUser ,status:"Pending"}).populate("companyId");
		// if (!joinRequest) return errorResponseHandler("Join request not found", httpStatusCode.NOT_FOUND, res);

		return { success: true, data: joinRequest };
	} catch (error) {
		console.error("Error in getJoinRequestById:", error);
		return errorResponseHandler("Failed to fetch join request", httpStatusCode.INTERNAL_SERVER_ERROR, res);
	}
};
export const getAllCompanyJoinRequestsService = async (res: Response) => {
	const joinRequest = await companyJoinRequestsModel.find({status:"Pending"}).populate("companyId").sort({ createdAt : -1});
	if (!joinRequest) return errorResponseHandler("Join request not found", httpStatusCode.NOT_FOUND, res);

	return { success: true, data: joinRequest };
};
export const getAllRejectedJoinRequestsService = async (res: Response) => {

		const joinRequest = await companyJoinRequestsModel.find({ status: "Rejected" }).populate("companyId").sort({ createdAt : -1});
		if (!joinRequest) return errorResponseHandler("Rejected request not found", httpStatusCode.NOT_FOUND, res);

		return { success: true, data: joinRequest };
};
  
export const updateCompanyJoinRequestService = async (id: string, payload: any, res: Response) => {
	console.log('id:', id);
	
	const joinRequest = await companyJoinRequestsModel.find({ companyId: id });
	const companyData = await companyModels.findById(id);
	if (!joinRequest) return errorResponseHandler("Join request not found", httpStatusCode.NOT_FOUND, res);
	if (!companyData) return errorResponseHandler("Company data not found", httpStatusCode.NOT_FOUND, res);
	let updatedJoinRequest;
	if (payload.status === "deny") {
		updatedJoinRequest = await companyJoinRequestsModel.findOneAndUpdate({companyId : id},{ status: "Rejected",description:payload.description }, { new: true });
		await companyModels.findByIdAndUpdate(id, { isVerifiedByAdmin: "rejected" }, { new: true });
	} else if (payload.status === "approve") {
		updatedJoinRequest = await companyJoinRequestsModel.findOneAndUpdate({companyId : id}, { status: "Approved" }, { new: true });
		const company =await companyModels.findByIdAndUpdate(id, { isVerifiedByAdmin: "approved",emailVerified: true }, { new: true });
			await sendWelcomeEmail(companyData.email,companyData.companyName );
			if (!company) return errorResponseHandler("Company not found", httpStatusCode.NOT_FOUND, res);
		
			// Create a Stripe customer
			let stripeCustomer;
			try {
				stripeCustomer = await stripe.customers.create({
					email: company.email,
					name: company.companyName,
					description: `Stripe customer for ${company.companyName}`,
				});
			} catch (error) {
				console.error("Error creating Stripe customer:", error);
				return errorResponseHandler("Failed to create Stripe customer", httpStatusCode.INTERNAL_SERVER_ERROR, res);
			}
		
			// Update the company with the Stripe customer ID
			company.stripeCustomerId = stripeCustomer.id;
			await company.save();
	}
	return { success: true, data: updatedJoinRequest };
};

export const deleteJoinRequestService = async (id: string, res: Response) => {
	try {
		const deletedJoinRequest = await companyJoinRequestsModel.findByIdAndDelete(id);
		if (!deletedJoinRequest) return errorResponseHandler("Join request not found", httpStatusCode.NOT_FOUND, res);

		return res.status(httpStatusCode.OK).json({ success: true, message: "Join request deleted successfully" });
	} catch (error) {
		console.error("Error in deleteJoinRequest:", error);
		return errorResponseHandler("Failed to delete join request", httpStatusCode.INTERNAL_SERVER_ERROR, res);
	}
};
