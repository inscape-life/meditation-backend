import { Response } from "express";
import { httpStatusCode } from "src/lib/constant";
import { errorResponseHandler } from "src/lib/errors/error-response-handler";
import { Request } from "express";
import { joinRequestsModel } from "src/models/user-join-requests/user-join-requests-schema";
import { usersModel } from "src/models/user/user-schema";
import { generatePasswordResetToken } from "src/utils/mails/token";
import { sendUserVerificationEmail } from "src/utils/mails/mail";
import { company } from "src/routes";
import { companyModels } from "src/models/company/company-schema";
import { queryBuilder } from "src/utils";
import { notificationsModel } from "src/models/notifications/notification-schema";

export const createJoinRequestService = async (payload: any) => {
	// Check if a join request already exists for the userId with a status other than "Rejected"
	const existingRequest = await joinRequestsModel.findOne({
		userId: payload.userId,
		companyId: payload.companyId,
		status: { $ne: "Rejected" },
	});

	if (existingRequest) {
		return { message: "Already join request sent" };
	}
const user = await usersModel.findById(payload.userId);
	// Create a new join request
	const newJoinRequest = await joinRequestsModel.create(payload);
    const companyNotif = await notificationsModel.create({
		userIds: [payload.companyId],
        userType: 'company',
        title: 'New user join request',
        description: `${user?.firstName} ${user?.lastName} has sent a join request to your company.`, 
    });
		
	// return { success: true, data: newJoinRequest };
};

export const getJoinRequestByIdService = async (companyDetails: any, payload: any, res: Response) => {
    const page = parseInt(payload.page) || 1;
    const limit = parseInt(payload.limit) || 10;
    const skip = (page - 1) * limit;

    // Build the user query based on description
    let userQuery: any = {};
    if (payload.description) {
        const searchRegex = { $regex: payload.description, $options: 'i' };
        userQuery.$or = [
            { firstName: searchRegex },
            { lastName: searchRegex },
            { email: searchRegex }
        ];
    }

    // First, find users matching the query
    const matchingUsers = await usersModel.find(userQuery).select('_id');
    const matchingUserIds = matchingUsers.map(user => user._id);

    // Use the matching user IDs in the join requests query
    const filter: any = { 
        companyId: companyDetails.currentUser, 
        status: "Pending"
    };

    // Only add userId filter if there are matching users
    // If no matches and description is provided, we want no results
    if (payload.description && matchingUserIds.length === 0) {
        // If we have a search term but no matching users, return empty result
        return { 
            success: true, 
            data: [],
            pagination: {
                total: 0,
                page,
                limit,
                totalPages: 0,
                hasNextPage: false,
                hasPrevPage: false
            }
        };
    } else if (matchingUserIds.length > 0) {
        // Only add userId filter if we have matches
        filter.userId = { $in: matchingUserIds };
    }
    // If no description provided, filter will just use companyId and status

    // Get total count of documents
    const total = await joinRequestsModel.countDocuments(filter);

    // Fetch paginated join requests
    const joinRequests = await joinRequestsModel
        .find(filter)
        .populate({
            path: "userId",
            select: "firstName lastName email identifier gender" 
        })
        .populate("companyId")
        .skip(skip)
        .limit(limit);

    // Prepare pagination metadata
    const pagination = {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1
    };

    return { 
        success: true, 
        data: joinRequests,
        pagination 
    };
};
export const getAllJoinRequestsService = async (payload: any, res: Response) => {
	try {
		const joinRequest = await joinRequestsModel.find();
		if (!joinRequest) return errorResponseHandler("Join request not found", httpStatusCode.NOT_FOUND, res);

		return res.status(httpStatusCode.OK).json({ success: true, data: joinRequest });
	} catch (error) {
		console.error("Error in getJoinRequestById:", error);
		return errorResponseHandler("Failed to fetch join request", httpStatusCode.INTERNAL_SERVER_ERROR, res);
	}
};

export const updateJoinRequestService = async (req: any, id: string, payload: any, res: Response) => {
		const joinRequest = await joinRequestsModel.find({ userId: id });
		const userData = await usersModel.findById(id);
		const companyData = await companyModels.findById(req?.currentUser);
		if (!joinRequest) return errorResponseHandler("Join request not found", httpStatusCode.NOT_FOUND, res);
		if (!userData) return errorResponseHandler("User data not found", httpStatusCode.NOT_FOUND, res);
		let updatedJoinRequest;
		if (payload.status === "deny") {
			updatedJoinRequest = await joinRequestsModel.findOneAndUpdate({ userId: id }, { status: "Rejected" }, { new: true });
			await usersModel.findByIdAndUpdate(id, { isVerifiedByCompany: "rejected" }, { new: true });
		} else if (payload.status === "approve") {

			if ((companyData?.totalUsers ?? 0) >= (companyData?.numUsersForPlan ?? 0)) {
				return errorResponseHandler(" Please buy or upgrade your plan", httpStatusCode.NOT_FOUND, res);
			}
			updatedJoinRequest = await joinRequestsModel.findOneAndUpdate({ userId: id }, { status: "Approved" }, { new: true });
			await companyModels.findByIdAndUpdate(joinRequest[0].companyId, { totalUsers: (companyData?.totalUsers ?? 0) + 1 }, { new: true });
			await usersModel.findByIdAndUpdate(id, { isVerifiedByCompany: "approved" }, { new: true });
			// const EmailVerificationToken = await generatePasswordResetToken(userData.email);
			// if (EmailVerificationToken) {
			// 	await sendUserVerificationEmail(userData.email, EmailVerificationToken.token);
			// } else {
			// 	return errorResponseHandler("Failed to send email verification", httpStatusCode.INTERNAL_SERVER_ERROR, res);
			// }
		}
		return { success: true, data: updatedJoinRequest };
	
};

export const deleteJoinRequestService = async (id: string, res: Response) => {
	try {
		const deletedJoinRequest = await joinRequestsModel.findByIdAndDelete(id);
		if (!deletedJoinRequest) return errorResponseHandler("Join request not found", httpStatusCode.NOT_FOUND, res);

		return res.status(httpStatusCode.OK).json({ success: true, message: "Join request deleted successfully" });
	} catch (error) {
		console.error("Error in deleteJoinRequest:", error);
		return errorResponseHandler("Failed to delete join request", httpStatusCode.INTERNAL_SERVER_ERROR, res);
	}
};
