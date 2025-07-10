import { Request, Response } from "express";
import { errorResponseHandler } from "../../lib/errors/error-response-handler";
import { usersModel } from "../../models/user/user-schema";
import bcrypt from "bcryptjs";
import { adminModel } from "../../models/admin/admin-schema";
import { generatePasswordResetToken, generatePasswordResetTokenByPhone, getPasswordResetTokenByToken } from "../../utils/mails/token";
import { notifyEmailChange, sendPasswordResetEmail, sendUserLoginCredentialsEmail, sendUserSignupEmail, sendUserVerificationEmail } from "../../utils/mails/mail";
import { generatePasswordResetTokenByPhoneWithTwilio } from "../../utils/sms/sms";
import { httpStatusCode } from "../../lib/constant";
import { customAlphabet } from "nanoid";
import { companyModels } from "src/models/company/company-schema";
import { queryBuilder } from "src/utils";
import { passwordResetTokenModel } from "src/models/password-token-schema";
import { createJoinRequestService } from "../join-requests/join-requests-service";
import { joinRequestsModel } from "src/models/user-join-requests/user-join-requests-schema";
import { collectionModel } from "src/models/collection/collection-schema";
import { userAudioHistoryModel } from "src/models/useraudiohistory/user-audio-history";
import { bestForModel } from "src/models/bestfor/bestfor-schema";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { AudioModel } from "src/models/audio/audio-schema";
import { deleteFileFromS3 } from "src/configF/s3";

const schemas = [usersModel, companyModels, adminModel];

// export const signupService = async (payload: any, res: Response) => {
//    const {email,lastName,firstName,password,dob,gender,companyName} = payload

//    let existingUser = null;
//   for (const schema of schemas) {
//     existingUser = await (schema as any).findOne({ email });
//     if (existingUser) break;
//   }

//   if (existingUser) {
//     return errorResponseHandler("User email already exists", httpStatusCode.CONFLICT, res);
//   }
//     const hashedPassword = await bcrypt.hash(password, 10)
//     const identifier = customAlphabet("0123456789", 5);
//     const newUser = new usersModel({
//         identifier: identifier(),
//         email,
//         firstName,
//         lastName,
//         password: hashedPassword,
//         dob: new Date(dob).toISOString().slice(0, 10),
//         gender,
//         companyName
//     })
//      await newUser.save()

//      const userData = newUser.toObject() as any;
//      delete userData.password;
//     // const EmailVerificationToken = await generatePasswordResetToken(userData.email);
//     // if(EmailVerificationToken){
//     //     await sendUserVerificationEmail(userData.email, EmailVerificationToken.token);
//     // }else{
//     //     return errorResponseHandler("Failed to send email verification", httpStatusCode.INTERNAL_SERVER_ERROR, res)
//     // }
//     return {
//         success: true,
//         message: "Email verification code send successfully verify email to signup successfully",
//         data: userData
//     }
// }

export const signupService = async (payload: any, req: Request, res: Response) => {
	const { email, lastName, firstName, password, dob, gender, companyName, companyId } = payload;
	const name = companyName;

	// Check if the company exists
	const company = await companyModels.find({ companyName: name });
	if (company === null || company.length === 0) {
		return errorResponseHandler("Company not found", httpStatusCode.NOT_FOUND, res);
	}
	const companyDetails = await companyModels.find({ _id: companyId });
	if (companyDetails === null || companyDetails.length === 0) {
		return errorResponseHandler("Company Id not found", httpStatusCode.NOT_FOUND, res);
	}
	if (companyDetails[0]?.companyName !== companyName) return errorResponseHandler("Invalid Company Details", httpStatusCode.NOT_FOUND, res);

	// Check if the user already exists
	let existingUser = null;
	for (const schema of schemas) {
		existingUser = await (schema as any).findOne({ email });
		if (existingUser) break;
	}
	const joinRequest = await joinRequestsModel.find({ userId: existingUser?._id });
	if (existingUser && existingUser.role !== "user") {
		return errorResponseHandler("User email already exists", httpStatusCode.CONFLICT, res);
	}
	if (existingUser && existingUser.role == "user" && existingUser.emailVerified === true) {
		return errorResponseHandler("Email already exist, try Login", httpStatusCode.CONFLICT, res);
	}
	if (existingUser && existingUser.role == "user" && existingUser.emailVerified === false && joinRequest) {
		const result = await createJoinRequestService({ companyId: company[0]?._id, userId: existingUser._id });
		return { success: true, message: "Request sent successfully" };
	}

	// Hash the password
	const hashedPassword = await bcrypt.hash(password, 10);
	const identifier = customAlphabet("0123456789", 5);

	// Create a new user
	const newUser = new usersModel({
		identifier: identifier(),
		email,
		firstName,
		lastName,
		password: hashedPassword,
		// dob: new Date(dob).toISOString().slice(0, 10),
		gender,
		companyName: company[0]?.companyName,
		companyId,
	});

	await newUser.save();
	const result = await createJoinRequestService({ companyId: company[0]?._id, userId: newUser?._id });
	const EmailVerificationToken = await generatePasswordResetToken(newUser.email);
			if (EmailVerificationToken) {
				await sendUserVerificationEmail(newUser.email, EmailVerificationToken.token);
			} else {
				return errorResponseHandler("Failed to send email verification", httpStatusCode.INTERNAL_SERVER_ERROR, res);
			}
	const userData = newUser.toObject() as any;
	delete userData.password;

	let token;
	// if (isMobileApp) {
	token = jwt.sign({ id: userData._id, role: userData.role }, process.env.JWT_SECRET_PHONE as string);
	// }
	return {
		success: true,
		message: "OTP sent successfully.Please check your email.",
		data: {
			userData,
			token,
		},
	};
};

export const verifyEmailService = async (req: any, res: Response) => {
	const { otp } = req.body;
	const tokenData = await getPasswordResetTokenByToken(otp);
	if (!tokenData) return errorResponseHandler("Invalid Otp", httpStatusCode.FORBIDDEN, res);
	const getUser = await usersModel.findOne({ email: tokenData.email });
	if (!getUser) return errorResponseHandler("User not found.", httpStatusCode.NOT_FOUND, res);
	const user = await usersModel.findByIdAndUpdate(getUser._id, { emailVerified: true }, { new: true });
	if (!user) return errorResponseHandler("User not found", httpStatusCode.NOT_FOUND, res);
	await sendUserSignupEmail(user.email, user.firstName + " " + user.lastName);
	// await passwordResetTokenModel.findByIdAndDelete(tokenData._id);
	const userData = user.toObject() as any;
	delete userData.password;
	const token = jwt.sign({ id: userData._id, role: userData.role }, process.env.JWT_SECRET_PHONE as string);
	return { success: true, message: "Email verified successfully", data: token };
};


export const loginService = async (payload: any, req: any, res: Response) => {
	const { email, password } = payload;
	let user: any = null;

	for (const schema of schemas) {
		user = await (schema as any).findOne({ email }).select("+password");
		if (user) break;
	}
	if (!user) {
		return errorResponseHandler("User not found", httpStatusCode.NOT_FOUND, res);
	}
	if (!user.emailVerified) {
		return errorResponseHandler("Please verify email to login", httpStatusCode.FORBIDDEN, res);
	}
	if (user.isBlocked) {
		return errorResponseHandler("User is blocked", httpStatusCode.FORBIDDEN, res);
	}
	if (user.isVerifiedByCompany === "pending") {
		return errorResponseHandler("User is request is not verified by company", httpStatusCode.FORBIDDEN, res);
	}

	// if (!user.isAccountActive) {
	// 	return errorResponseHandler("User account is not activated", httpStatusCode.FORBIDDEN, res);
	// }

	const isPasswordValid = await bcrypt.compare(password, user.password);
	if (!isPasswordValid) {
		return errorResponseHandler("Invalid password", httpStatusCode.UNAUTHORIZED, res);
	}

	const userObject = user.toObject();
	delete userObject.password;

	const isMobileApp = req.headers["x-client-type"] === "mobile";

	let token;
	if (isMobileApp) {
		token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET_PHONE as string);
	}

	return {
		success: true,
		message: "Login successful",
		data: {
			user: userObject,
			token: token || undefined,
		},
	};
};

// export const editUserInfoService = async (id: string, payload: any, res: Response) => {
// 	const user = await usersModel.findById(id);
// 	if (!user) return errorResponseHandler("User not found", httpStatusCode.NOT_FOUND, res);

// 	if (payload.password) {
// 		payload.password = await bcrypt.hash(payload.password, 10);
// 	}

// 	const updateduser = await usersModel.findByIdAndUpdate(id, { ...payload }, { new: true });
// 	if (!updateduser) return errorResponseHandler("User not found", httpStatusCode.NOT_FOUND, res);
// 	return {
// 		success: true,
// 		message: "User updated successfully",
// 		data: updateduser,
// 	};
// };

// Email sending utility (example implementation at the bottom if needed)
interface UserPayload {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  [key: string]: any; // For other optional fields
}

export const editUserInfoService = async (id: string, payload: UserPayload, res: Response) => {
	const user = await usersModel.findById(id);
	if (!user) {
	  return errorResponseHandler("User not found", httpStatusCode.NOT_FOUND, res);
	}
  
	const isEmailChanged = payload.email && payload.email !== user.email;
  
	if (payload.password) {
	  payload.password = await bcrypt.hash(payload.password, 10);
	}
  
	const updatedUser = await usersModel.findByIdAndUpdate(id, { ...payload }, { new: true });
  
	if (!updatedUser) {
	  return errorResponseHandler("User not found", httpStatusCode.NOT_FOUND, res);
	}
  
	if (isEmailChanged) {
	  await notifyEmailChange(user, updatedUser.email);
	}
  
	return {
	  success: true,
	  message: "User updated successfully",
	  data: updatedUser,
	};
  };
export const getBlockedUserService = async (req: Request, res: Response) => {
  // Extract page and limit from query parameters, with defaults
  const page = parseInt((req.query.page as string) || "1", 10);
  const limit = parseInt((req.query.limit as string) || "10", 10);

  // Validate page and limit
  if (page < 1 || limit < 1) {
    return errorResponseHandler("Page and limit must be positive integers", httpStatusCode.FORBIDDEN, res);
  }

  // Calculate skip value for pagination
  const skip = (page - 1) * limit;

  // Build the query using queryBuilder
  const { query } = queryBuilder(req.query, ["firstName", "email", "identifier","companyName"]);
  (query as any).isBlocked = true; // Add the isBlocked condition to the query

  // Query for blocked users with pagination
  const blockedUsers = await usersModel
    .find(query)
    .skip(skip)
		.sort({createdAt: -1})
    .limit(limit)
    .select("-password") // Exclude password field from response
    .lean(); // Convert to plain JavaScript objects

  // Get total count of blocked users for pagination metadata
  const totalBlockedUsers = await usersModel.countDocuments(query);

  // Calculate total pages
  const totalPages = Math.ceil(totalBlockedUsers / limit);

  // Prepare response
  return {
    success: true,
    message: "Blocked users retrieved successfully",
    data: {
      users: blockedUsers,
      pagination: {
        currentPage: page,
        limit,
        totalUsers: totalBlockedUsers,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    },
  };
};

export const updateUserDetailsService = async (user: any, payload: any, res: Response) => {
	const id = user?.id ?? null;
	if (!id) return errorResponseHandler("User not authenticated", httpStatusCode.UNAUTHORIZED, res);
	const userDetails = await usersModel.findById(id);
	if (!userDetails) return errorResponseHandler("User not found", httpStatusCode.NOT_FOUND, res);
	const updateduser = await usersModel.findByIdAndUpdate(id, { ...payload }, { new: true });
	if (!updateduser) return errorResponseHandler("User not found", httpStatusCode.NOT_FOUND, res);
	return {
		success: true,
		message: "Details updated successfully",
		data: updateduser,
	};
};
export const resendOtpService = async (req: any, res: Response) => {
	const userData = await usersModel.find({ email:req.email });
	if (!userData) return errorResponseHandler("User not found", httpStatusCode.NOT_FOUND, res);
	const EmailVerificationToken = await generatePasswordResetToken(req.email);
	if (EmailVerificationToken ) {
		if(req.type==="signUp") await sendUserSignupEmail(req.email, EmailVerificationToken.token);
		else if(req.type==="forgotPassword") {
			await sendPasswordResetEmail(req.email, EmailVerificationToken.token);
		}
		else{
			await sendPasswordResetEmail(req.email, EmailVerificationToken.token);
		}
		
	} else {
		return errorResponseHandler("Failed to send email verification", httpStatusCode.INTERNAL_SERVER_ERROR, res);
	}
	return {
		success: true,
		message: "Resend otp successfully",
	};
};

export const getUserInfoService = async (userData: any, res: Response) => {
	const user = await usersModel.findById(userData.id);
	if (!user) return errorResponseHandler("User not found", httpStatusCode.NOT_FOUND, res);
	return {
		success: true,
		message: "User info fetched successfully",
		data: user,
	};
};

export const getAllUsersService = async (payload: any) => {
	const page = parseInt(payload.page as string) || 1;
	const limit = parseInt(payload.limit as string) || 10;
	const skip = (page - 1) * limit;

	const { query } = queryBuilder(payload, ["firstName", "email", "identifier"]);
	const companies = await usersModel.find(query).sort().skip(skip).limit(limit);
	const totalCompanies = await usersModel.countDocuments(query);

	return {
		success: true,
		data: companies,
		total: totalCompanies,
		page,
		limit,
		statusCode: httpStatusCode.OK,
	};
};

export const getUserInfoByEmailService = async (email: string, res: Response) => {
	const client = await usersModel.findOne({ email });
	if (!client) return errorResponseHandler("User not found", httpStatusCode.NOT_FOUND, res);
	return {
		success: true,
		message: "Client info fetched successfully",
		data: client,
	};
};

export const forgotPasswordService = async (payload: any, res: Response) => {
	const { email, phoneNumber, password } = payload;
	const query = email ? { email } : { phoneNumber };

	const client = await usersModel.findOne(query);
	if (!client) return errorResponseHandler("User not found", httpStatusCode.NOT_FOUND, res);

	if (email) {
		const passwordResetToken = await generatePasswordResetToken(email);
		if (passwordResetToken !== null) {
			await sendPasswordResetEmail(email, passwordResetToken.token);
			return { success: true, message: "Password reset email sent with otp" };
		}
	} else {
		const generatePasswordResetTokenBysms = await generatePasswordResetTokenByPhone(phoneNumber);

		if (generatePasswordResetTokenBysms !== null) {
			await generatePasswordResetTokenByPhoneWithTwilio(phoneNumber, generatePasswordResetTokenBysms.token);
			return { success: true, message: "Password reset sms sent with otp" };
		}
	}
};

export const verifyOtpPasswordResetService = async (token: string, res: Response) => {
	const existingToken = await getPasswordResetTokenByToken(token);
	if (!existingToken) return errorResponseHandler("Invalid OTP", httpStatusCode.BAD_REQUEST, res);

	const hasExpired = new Date(existingToken.expires) < new Date();
	if (hasExpired) return errorResponseHandler("OTP expired", httpStatusCode.BAD_REQUEST, res);
	return { success: true, message: "OTP verified successfully" };
};

export const newPassswordAfterOTPVerifiedService = async (payload: { password: string; otp: string }, res: Response) => {
	const { password, otp } = payload;
	const existingToken = await getPasswordResetTokenByToken(otp);
	if (!existingToken) return errorResponseHandler("Invalid OTP", httpStatusCode.BAD_REQUEST, res);


	const hasExpired = new Date(existingToken.expires) < new Date();
	if (hasExpired) return errorResponseHandler("OTP expired", httpStatusCode.BAD_REQUEST, res);

	let existingClient: any;

	if (existingToken.email) {
		existingClient = await adminModel.findOne({ email: existingToken.email });
		if (!existingClient) {
			existingClient = await usersModel.findOne({ email: existingToken.email });
		}
		if (!existingClient) return errorResponseHandler("User not found", httpStatusCode.NOT_FOUND, res);
	} else if (existingToken.phoneNumber) {
		existingClient = await usersModel.findOne({ phoneNumber: existingToken.phoneNumber });
		if (!existingClient) {
			existingClient = await usersModel.findOne({ phoneNumber: existingToken.phoneNumber });
		}
		if (!existingClient) return errorResponseHandler("User not found", httpStatusCode.NOT_FOUND, res);
	}


	const hashedPassword = await bcrypt.hash(password, 10);

	if (existingClient.role == "admin") {
		const response = await adminModel.findByIdAndUpdate(existingClient._id, { password: hashedPassword }, { new: true });
	} else {
		const response = await usersModel.findByIdAndUpdate(existingClient._id, { password: hashedPassword }, { new: true });
	}

	// await passwordResetTokenModel.findByIdAndDelete(existingToken._id)

	return {
		success: true,
		message: "Password updated successfully",
	};
};

export const passwordResetService = async (req: Request, res: Response) => {
	const { currentPassword, newPassword } = req.body;
	const getAdmin = await usersModel.findById(req.params.id).select("+password");
	if (!getAdmin) return errorResponseHandler("Admin not found", httpStatusCode.NOT_FOUND, res);

	const passwordMatch = bcrypt.compareSync(currentPassword, getAdmin.password);
	if (!passwordMatch) return errorResponseHandler("Current password invalid", httpStatusCode.BAD_REQUEST, res);
	const hashedPassword = bcrypt.hashSync(newPassword, 10);
	const response = await usersModel.findByIdAndUpdate(req.params.id, { password: hashedPassword });
	return {
		success: true,
		message: "Password updated successfully",
		data: response,
	};
};

// Create a new user
export const createUserService = async (payload: any, res: Response) => {
	const { email, firstName, lastName, password, companyName } = payload;

	const existingUser = await usersModel.findOne({ email });
	if (existingUser) return errorResponseHandler("User email already exists", httpStatusCode.CONFLICT, res);

	const existingCompany = await companyModels.findOne({ companyName });
	if (!existingCompany) return errorResponseHandler("Company doesn't exist.", httpStatusCode.CONFLICT, res);
	if ((existingCompany as any).totalUsers >= (existingCompany as any).numUsersForPlan) {
		return errorResponseHandler("Please buy or upgrade your plan.", httpStatusCode.CONFLICT, res);
	}
	const hashedPassword = await bcrypt.hash(password, 10);
	const identifier = customAlphabet("0123456789", 5);
	const newUser = new usersModel({
		identifier: identifier(),
		email,
		firstName,
		lastName,
		password: hashedPassword,
		// dob: new Date(dob).toISOString().slice(0, 10),
		companyName,
		isVerifiedByCompany: "approved",
		role: "user",
		emailVerified: true,
	});
	await newUser.save();
	await sendUserLoginCredentialsEmail(email, firstName, lastName, password, companyName);
	await companyModels.findByIdAndUpdate(existingCompany._id, { totalUsers: (existingCompany?.totalUsers ?? 0) + 1 }, { new: true });

	const userData = newUser.toObject();

	return {
		success: true,
		message: "User created successfully",
		data: userData,
	};
};

// Read user by ID
export const getUserForCompanyService = async (id: string, res: Response) => {
	const user = await usersModel.findById(id);
	if (!user) return errorResponseHandler("User not found", httpStatusCode.NOT_FOUND, res);

	return {
		success: true,
		message: "User fetched successfully",
		data: user,
	};
};

export const getAllUserForCompanyService = async (company: any, payload: any, res: Response) => {
    const page = parseInt(payload.page as string) || 1;
    const limit = parseInt(payload.limit as string) || 10;
    const skip = (page - 1) * limit;
    const { query } = queryBuilder(payload, ["firstName", "email"]);
    
    const companyDetails = await companyModels.find({ _id: company.currentUser });
    
    // Adding query to the find operation for search functionality
    const users = await usersModel
        .find({
            companyName: companyDetails[0]?.companyName,
            isVerifiedByCompany: "approved",
			isBlocked: payload.isBlocked,
            ...query  // Spread the query object to include search parameters
        })
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit);
    
    // Apply same filters to count total documents
    const totalUsers = await usersModel.countDocuments({
        companyName: companyDetails[0]?.companyName,
		isBlocked: payload.isBlocked,
        isVerifiedByCompany: "approved",
        ...query
    });
    
    // if (!users || users.length === 0) {
    //     return errorResponseHandler("User not found", httpStatusCode.NOT_FOUND, res);
    // }

    return {
        success: true,
        message: "User fetched successfully",
        data: {
            users: (!users || users.length === 0) ? [] : users,
            totalUsers,
            page,
            limit,
        },
    };
};

export const deleteUserService = async (id: string, res: Response) => {
	const user = await usersModel.findByIdAndDelete(id);
	if (!user) return errorResponseHandler("User not found", httpStatusCode.NOT_FOUND, res);

	return {
		success: true,
		message: "User deleted successfully",
	};
};

export const deleteMultipleUserService = async (users: string[], res: Response) => {
  if (users === undefined || users.length === 0) return errorResponseHandler("Bad Request", httpStatusCode.BAD_REQUEST, res);
  const deletedUsers: string[] = [];
  const notFoundUsers: string[] = [];

  for (const id of users) {
    const user = await usersModel.findById(id);

    if (!user) {
      notFoundUsers.push(id);
      continue;
    }

    // Delete the file from S3 if image exists
    // if (user.details?.image) {
    //   await deleteFileFromS3(user.details.image);
    // }

    // Delete user from DB
    await usersModel.findByIdAndDelete(id);
    deletedUsers.push(id);
  }

  return {
    success: true,
    message: "User deletion process completed",
    deletedUsers,
    notFoundUsers,
  };
};

// export const deactivateUserService = async (id: string, res: Response) => {
// 	const user = await usersModel.findById(id);
// 	if (!user) return errorResponseHandler("User not found", httpStatusCode.NOT_FOUND, res);

// 	// Toggle the isActive field
// 	user.isBlocked = !user.isBlocked;
// 	await user.save();

// 	return {
// 		success: true,
// 		message: `User ${user.isBlocked ? "blocked" : "unblocked"} successfully`,
// 	};
// };

export const deactivateUserService = async (req:any,id: string, res: Response) => {
    const user = await usersModel.findById(id);
    if (!user) return errorResponseHandler("User not found", httpStatusCode.NOT_FOUND, res);

    // Store the original isBlocked value to determine the change
    const wasBlocked = user.isBlocked;

    // Toggle the isBlocked field
    user.isBlocked = !user.isBlocked;
    await user.save();

    // Check if the user is associated with a company (assuming a companyId field exists in usersModel)
    if (req.currentUser) {
        // Find the company associated with the user
        const company = await companyModels.findById(req.currentUser);
        if (!company) {
            console.warn(`Company with ID ${req.currentUser} not found for user ${id}`);
        } else {
            // Update totalUsers based on the change in isBlocked
            if (user.isBlocked && !wasBlocked) {
                // User was unblocked and is now blocked -> Decrease totalUsers
                company.totalUsers = (company.totalUsers || 0) > 0 ? company.totalUsers - 1 : 0;
            } else if (!user.isBlocked && wasBlocked) {
                // User was blocked and is now unblocked -> Increase totalUsers
                company.totalUsers = (company.totalUsers || 0) + 1;
            }
            await company.save();
        }
    } else {
        console.warn(`User ${id} is not associated with any company`);
    }

    return {
        success: true,
        message: `User ${user.isBlocked ? "blocked" : "unblocked"} successfully`,
    };
};

// Dashboard
export const getDashboardStatsService = async (payload: any, res: Response) => {
	// //Ongoing project count
	// const userId = payload.currentUser
	// const ongoingProjectCount = await projectsModel.countDocuments({ userId, status: { $ne: "1" } })
	// const completedProjectCount = await projectsModel.countDocuments({ userId,status: "1" })
	// const workingProjectDetails = await projectsModel.find({ userId, status: { $ne: "1" } }).select("projectName projectimageLink status"); // Adjust the fields as needed
	// const response = {
	//     success: true,
	//     message: "Dashboard stats fetched successfully",
	//     data: {
	//         ongoingProjectCount,
	//         completedProjectCount,
	//          workingProjectDetails,
	//     }
	// }
	// return response
};


export const getHomePageService = async (payload: any, res: Response) => {
	// Suggested Collection with population
	const suggestedCollection = await collectionModel.find().limit(1).populate("bestFor").populate("levels");
	if (!suggestedCollection) return errorResponseHandler("User not found", httpStatusCode.NOT_FOUND, res);

	// Trending Audio with population, including collectionType
	

		// Trending Audio with population, ensuring no duplicates
		const trendingAudio = await userAudioHistoryModel.aggregate([
			{
				$group: {
					_id: "$audio_id",
					count: { $sum: 1 },
				},
			},
			{
				$sort: { count: -1 },
			},
			{
				$limit: 5, // Limit to top 5 trending audios
			},
			{
				$lookup: {
					from: "audios",
					localField: "_id",
					foreignField: "_id",
					as: "audioDetails",
				},
			},
			{
				$unwind: {
					path: "$audioDetails",
					preserveNullAndEmptyArrays: false,
				},
			},
			// Populate collectionType for audioDetails
			{
				$lookup: {
					from: "collections",
					localField: "audioDetails.collectionType",
					foreignField: "_id",
					as: "audioDetails.collectionType",
				},
			},
			{
				$unwind: {
					path: "$audioDetails.collectionType",
					preserveNullAndEmptyArrays: true,
				},
			},
			// Populate bestFor and levels for collectionType
			{
				$lookup: {
					from: "bestfors",
					localField: "audioDetails.collectionType.bestFor",
					foreignField: "_id",
					as: "audioDetails.collectionType.bestFor",
				},
			},
			{
				$unwind: {
					path: "$audioDetails.collectionType.bestFor",
					preserveNullAndEmptyArrays: true,
				},
			},
			{
				$lookup: {
					from: "levels",
					localField: "audioDetails.collectionType.levels",
					foreignField: "_id",
					as: "audioDetails.collectionType.levels",
				},
			},
			// Populate bestFor and levels for audioDetails
			{
				$lookup: {
					from: "bestfors",
					localField: "audioDetails.bestFor",
					foreignField: "_id",
					as: "audioDetails.bestFor",
				},
			},
			{
				$lookup: {
					from: "levels",
					localField: "audioDetails.levels",
					foreignField: "_id",
					as: "audioDetails.levels",
				},
			},
			// Ensure no duplicates by grouping again by _id
			{
				$group: {
					_id: "$_id", // Group by audio_id to ensure uniqueness
					count: { $first: "$count" },
					audioDetails: { $first: "$audioDetails" },
				},
			},
		]);

	
	const collection = await collectionModel.aggregate([
		{
			$sort: { createdAt: -1 }, // Sort by creation date descending
		},
		{
			$lookup: {
				from: "audios",
				localField: "_id",
				foreignField: "collectionType",
				as: "audios",
			},
		},
		{
			$project: {
				name: 1,
				bestFor: 1,
				levels: 1,
				createdAt: 1,
				audioCount: { $size: "$audios" },
				audios: 1,
			},
		},
		{
			$match: { audioCount: { $gt: 0 } }, // Only collections with audios
		},
		{
			$limit: 1, // Get the latest with audios
		},
		// Populate bestFor and levels for the collection
		{
			$lookup: {
				from: "bestfors",
				localField: "bestFor",
				foreignField: "_id",
				as: "bestFor",
			},
		},
		{
			$unwind: {
				path: "$bestFor",
				preserveNullAndEmptyArrays: true,
			},
		},
		{
			$lookup: {
				from: "levels",
				localField: "levels",
				foreignField: "_id",
				as: "levels",
			},
		},
		// Populate bestFor and levels for audios (without unwinding audios)
		{
			$lookup: {
				from: "bestfors",
				localField: "audios.bestFor",
				foreignField: "_id",
				as: "audiosBestFor",
			},
		},
		{
			$lookup: {
				from: "levels",
				localField: "audios.levels",
				foreignField: "_id",
				as: "audiosLevels",
			},
		},
		// Merge the populated bestFor and levels back into audios
		{
			$project: {
				name: 1,
				bestFor: 1,
				levels: 1,
				createdAt: 1,
				audioCount: 1,
				audios: {
					$map: {
						input: "$audios",
						as: "audio",
						in: {
							$mergeObjects: [
								"$$audio",
								{
									bestFor: {
										$arrayElemAt: [
											"$audiosBestFor",
											{ $indexOfArray: ["$audios._id", "$$audio._id"] }
										]
									},
									levels: {
										$filter: {
											input: "$audiosLevels",
											cond: { $in: ["$$this._id", "$$audio.levels"] }
										}
									},
								},
							],
						},
					},
				},
			},
		},
	]);

	const meditationType = await bestForModel.aggregate([
		{
		  $lookup: {
			from: "audios",
			localField: "_id",
			foreignField: "bestFor",
			as: "audios",
		  },
		},
		{
		  $project: {
			name: 1,
			audioCount: { $size: "$audios" },
			// Add one audio with only imageUrl
			audio: {
			  $arrayElemAt: [
				{
				  $map: {
					input: "$audios",
					as: "audio",
					in: {
					  imageUrl: "$$audio.imageUrl",
					},
				  },
				},
				0,
			  ],
			},
		  },
		},
		{
		  $match: {
			audioCount: { $gt: 0 },
		  },
		},
	  ]);

	const bestForType = await bestForModel.find({ name: "Breathing" });

	const breathing = await AudioModel.find({
		bestFor: new mongoose.Types.ObjectId(bestForType[0]._id),
	})
		.populate({
			path: "collectionType",
			populate: [{ path: "bestFor" }, { path: "levels" }],
		})
		.populate("bestFor")
		.populate("levels")
		.exec();

	return {
		success: true,
		message: `Home page fetched successfully`,
		data: {
			suggestedCollection,
			trendingAudio,
			collection: collection[0],
			breathing,
			meditationType,
		},
	};
};

