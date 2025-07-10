import bcrypt from "bcryptjs";
import e, { Response } from "express";
import { errorResponseHandler } from "../../lib/errors/error-response-handler";
import { httpStatusCode } from "../../lib/constant";
import { sendAdminCompanySignupEmail, sendCompanyCreationEmail, sendCompanySignupEmail, sendUserSignupEmail } from "src/utils/mails/mail";
import { companyModels } from "src/models/company/company-schema";
import { customAlphabet } from "nanoid";
import { queryBuilder } from "src/utils";
import { adminModel } from "src/models/admin/admin-schema";
import { usersModel } from "src/models/user/user-schema";
import stripe from "src/configF/stripe";
import { companyJoinRequestsModel } from "src/models/company-join-requests/company-join-requests-schema";
import { createCompanyJoinRequestService } from "../company-join-requests/company-join-requests-service";
import { getPasswordResetTokenByToken } from "src/utils/mails/token";
import { passwordResetTokenModel } from "src/models/password-token-schema";
import Stripe from "stripe";
import { getCompanyTransactionsService } from "../subscription/subscription-service";
interface BlockRequestBody {
	isBlocked: boolean;
}
const schemas = [adminModel, usersModel, companyModels]; // Add all schemas to the array

export const companySignupService = async (payload: any, req: any, res: Response) => {
	const { email, password, companyName, firstName, lastName } = payload;
	const name = companyName;

	let existingUser = null;
	for (const schema of schemas) {
		existingUser = await (schema as any).findOne({ email });
		if (existingUser) break;
	}
	if (existingUser) {
		return errorResponseHandler("email already exists", httpStatusCode.CONFLICT, res);
	}
	// Check if the company name already exists
	const existingCompanyName = await companyModels.findOne({ companyName: name });
	if (existingCompanyName) {
		return errorResponseHandler("Company name already exists", httpStatusCode.CONFLICT, res);
	}
	const joinRequest = await companyJoinRequestsModel.find({ companyId: existingUser?._id });
	if (existingUser && existingUser.role !== "company") {
		return errorResponseHandler("User email already exists", httpStatusCode.CONFLICT, res);
	}
	if (existingUser && existingUser.role == "company" && existingUser.emailVerified === true) {
		return errorResponseHandler("Email already exist, try Login", httpStatusCode.CONFLICT, res);
	}
	if (existingUser && existingUser.role == "company" && existingUser.emailVerified === false && joinRequest) {
		const result = await createCompanyJoinRequestService({ companyId: existingUser._id });
		return { success: true, message: "Request sent successfully" };
	}

	// Hash the password
	const hashedPassword = await bcrypt.hash(password, 10);
	const identifier = customAlphabet("0123456789", 5);

	// Create a new user
	const newUser = new companyModels({
		identifier: identifier(),
		email,
		password: hashedPassword,
		companyName: name,
		firstName: firstName,
		lastName: lastName,
	});

	await newUser.save();
	await createCompanyJoinRequestService({ companyId: newUser?._id });
	await sendCompanySignupEmail(email, companyName);
	await sendAdminCompanySignupEmail(companyName);
	const userData = newUser.toObject() as any;
	delete userData.password;

	return {
		success: true,
		message: "Request sent successfully",
	};
};

export const verifyCompanyEmailService = async (req: any, res: Response) => {
	const { otp } = req.body;

	// Validate OTP
	const tokenData = await getPasswordResetTokenByToken(otp);
	if (!tokenData) return errorResponseHandler("Invalid Otp", httpStatusCode.FORBIDDEN, res);

	// Find the company by email
	const getCompany = await companyModels.findOne({ email: tokenData.email });
	if (!getCompany) return errorResponseHandler("Company not found.", httpStatusCode.NOT_FOUND, res);

	// Update email verification status
	const company = await companyModels.findByIdAndUpdate(getCompany._id, { emailVerified: true }, { new: true });
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

	// Send a signup email
	await sendUserSignupEmail(company.email, company.companyName);

	// Delete the OTP token
	await passwordResetTokenModel.findByIdAndDelete(tokenData._id);

	// Prepare the response
	const companyData = company.toObject() as any;
	if (companyData.password) {
		delete companyData?.password;
	}

	return {
		success: true,
		message: "Email verified created successfully",
		data: companyData,
	};
};
export const companyCreateService = async (payload: any, req: any, res: Response) => {
	const { companyName, email, password, lastName, firstName } = payload;

	if ([companyName, email, password, firstName, lastName].some((field) => !field || field.trim() === "")) {
		return errorResponseHandler("All fields are required to create a company", httpStatusCode.BAD_REQUEST, res);
	}
	const name = companyName;

	let existingUser = null;
	for (const schema of schemas) {
		existingUser = await (schema as any).findOne({ email });
		if (existingUser) break;
	}

	if (existingUser) {
		return errorResponseHandler("email already exists", httpStatusCode.CONFLICT, res);
	}

	// Check if the company name already exists
	const existingCompanyName = await companyModels.findOne({ companyName: name });
	if (existingCompanyName) {
		return errorResponseHandler("Company name already exists", httpStatusCode.CONFLICT, res);
	}

	// Hash the password
	const hashedPassword = await bcrypt.hash(password, 10);
	const identifier = customAlphabet("0123456789", 5);

	// Create Stripe customer
	let stripeCustomer;
	try {
		stripeCustomer = await stripe.customers.create({
			email: email.toLowerCase().trim(),
			name: name,
			description: `Customer for ${name}`,
		});
	} catch (error) {
		return errorResponseHandler("Failed to create Stripe customer", httpStatusCode.INTERNAL_SERVER_ERROR, res);
	}

	// Create a new company with Stripe customer ID
	const newCompany = new companyModels({
		companyName: name,
		identifier: identifier(),
		email: email.toLowerCase().trim(),
		password: hashedPassword,
		emailVerified: true,
		isVerifiedByAdmin: "approved",
		stripeCustomerId: stripeCustomer.id,
		firstName: firstName,
		lastName: lastName,
	});

	// Save the company to the database
	await newCompany.save();

	// Send email to the company
	await sendCompanyCreationEmail(email, name, password);

	const companyData = newCompany.toObject() as any;
	delete companyData.password;

	return {
		success: true,
		message: "Company created successfully",
		data: companyData,
	};
};

export const getCompaniesService = async (payload: any) => {
	const page = parseInt(payload.page as string) || 1;
	const limit = parseInt(payload.limit as string) || 10;
	const skip = (page - 1) * limit;

	const { query } = queryBuilder(payload, ["companyName", "email"]);
	const companies = await companyModels
		.find({ ...query, isVerifiedByAdmin: "approved" })
		.sort({ createdAt: -1 })
		.skip(skip)
		.limit(limit);
	const totalCompanies = await companyModels.countDocuments({ ...query, isVerifiedByAdmin: "approved" });

	return {
		success: true,
		data: companies,
		total: totalCompanies,
		page,
		limit,
		statusCode: httpStatusCode.OK,
	};
};

export const updateCompanyService = async (payload: any, req: any, res: Response) => {
	const { companyName, password, firstName, lastName, email } = payload;
	const { id } = req.params;

	if (password) {
		const hashedPassword = await bcrypt.hash(password, 10);
		payload.password = hashedPassword;
	}
	const name = companyName;

	const existingCompany = await companyModels.findById(id);
	// Check if the email exists
	if (!existingCompany) {
		return errorResponseHandler("Company does not exist", httpStatusCode.NOT_FOUND, res);
	}

	// Hash the password

	// Update the company
	const updatedCompany = await companyModels.findByIdAndUpdate(
		existingCompany._id,
		{
			...payload,
			companyName: name,
		},
		{ new: true }
	);

	if (!updatedCompany) {
		return errorResponseHandler("Failed to update the company", httpStatusCode.INTERNAL_SERVER_ERROR, res);
	}

	const companyData = updatedCompany.toObject() as any;
	delete companyData.password;

	return {
		success: true,
		message: "Company updated successfully",
		data: companyData,
		statusCode: httpStatusCode.OK,
	};
};

export const getCompanyByIdService = async (user: any, res: Response) => {
	const company = await companyModels.findById(user.id);
	if (!company) {
		return errorResponseHandler("Company not found", httpStatusCode.NOT_FOUND, res);
	}

	const companyData = company.toObject() as any;
	delete companyData.password;

	return {
		success: true,
		data: companyData,
		statusCode: httpStatusCode.OK,
	};
};
export const getCompanyByIdForAdminService = async (req: any, res: Response) => {
	const companyId = req.params.id;

	// Validate the ID (optional but recommended)
	if (!companyId) {
		return errorResponseHandler("Company ID is required", httpStatusCode.BAD_REQUEST, res);
	}
	const company = await companyModels.findById(companyId).select("+password");
	if (!company) {
		return errorResponseHandler("Company not found", httpStatusCode.NOT_FOUND, res);
	}

	const users = await usersModel.countDocuments({ companyName: company.companyName });

	const companyData = company.toObject() as any;

	return {
		success: true,
		data: companyData,
		users: users,
		statusCode: httpStatusCode.OK,
	};
};
export const getCompanyByIdForCompanyService = async (req: any, res: Response) => {
	const companyId = req.params.id;

	// Validate the ID (optional but recommended)
	if (!companyId) {
		return errorResponseHandler("Company ID is required", httpStatusCode.BAD_REQUEST, res);
	}
	const company = await companyModels.findById(companyId).select("+password");
	if (!company) {
		return errorResponseHandler("Company not found", httpStatusCode.NOT_FOUND, res);
	}

	const users = await usersModel.countDocuments({ companyName: company.companyName });

	const companyData = company.toObject() as any;

	return {
		success: true,
		data: companyData,
		users: users,
		statusCode: httpStatusCode.OK,
	};
};

export const deleteCompanyService = async (id: string, res: Response) => {
	const company = await companyModels.findById(id);
	console.log("company: ", company);
	if (!company) {
		return errorResponseHandler("Company not found", httpStatusCode.NOT_FOUND, res);
	}

	// Find and delete all users associated with the company
	const users = await usersModel.find({ companyName: company.companyName });
	console.log("users: ", users);
	const userIds = users.map((user) => user._id);
	await usersModel.deleteMany({ _id: { $in: userIds } });
	await companyModels.findByIdAndDelete(id);

	console.log("Deleted users: ", userIds);

	return {
		success: true,
		message: "Company and associated users deleted successfully",
		statusCode: httpStatusCode.OK,
	};
};
export const toggleBlockedCompanyService = async (req: any, res: Response) => {
	// Extract company ID from URL parameters
	const { id } = req.params;

	// Validate ID
	if (!id) {
		return errorResponseHandler("Company ID is required", httpStatusCode.BAD_REQUEST, res);
	}

	// Extract isBlocked from request body
	const body = req.body as unknown;
	const { isBlocked } = body as BlockRequestBody;

	// Validate request body
	if (typeof isBlocked !== "boolean") {
		return errorResponseHandler("isBlocked must be a boolean value", httpStatusCode.BAD_REQUEST, res);
	}

	// Find and update the company
	const company = await companyModels.findByIdAndUpdate(
		id,
		{ isBlocked },
		{ new: true, runValidators: true } // Return updated document and validate schema
	);

	// Check if company exists
	if (!company) {
		return errorResponseHandler("Company not found", httpStatusCode.NOT_FOUND, res);
	}

	// Prepare response data (excluding password)
	const companyData = company.toObject() as any;
	delete companyData.password;

	// Return success response
	return {
		success: true,
		data: companyData,
		message: `Company ${isBlocked ? "blocked" : "unblocked"} successfully`,
	};
};

// export const getCompanyDashboardService = async (id: any, res: Response) => {
// 	try {
// 		const company = await companyModels.findById(id);
// 		if (!company) {
// 			return errorResponseHandler("Company not found", httpStatusCode.NOT_FOUND, res);
// 		}

// 		const companyCustomerId = company.stripeCustomerId;
// 		if (!companyCustomerId) {
// 			return errorResponseHandler("Stripe customer ID not found for the company", httpStatusCode.BAD_REQUEST, res);
// 		}

// 		// Fetch transactions using the Stripe customer ID
// 		const companyTransactions = await getSubscriptionsByCustomer(companyCustomerId);
// 		const recentUsers = await usersModel.find({ companyName: company.companyName }).sort({ createdAt: -1 }).limit(10);

// 		return {
// 			success: true,
// 			message: "Company dashboard data fetched successfully",
// 			data: {
// 				// company,
// 				transactions: companyTransactions,
// 				recentUsers,
// 			},
// 			statusCode: httpStatusCode.OK,
// 		};
// 	} catch (error) {
// 		console.error("Error in getCompanyDashboardService:", error);
// 		return errorResponseHandler("Failed to fetch company dashboard data", httpStatusCode.INTERNAL_SERVER_ERROR, res);
// 	}
// };

export const getCompanyDashboardService = async (userDeatil: any, payload: any, res: Response) => {
	try {
		const company = await companyModels.findById(userDeatil.currentUser);
		if (!company) {
			return errorResponseHandler("Company not found", httpStatusCode.NOT_FOUND, res);
		}

		const companyCustomerId = company.stripeCustomerId;
		if (!companyCustomerId) {
			return errorResponseHandler("Stripe customer ID not found for the company", httpStatusCode.BAD_REQUEST, res);
		}

		// Fetch transactions using the Stripe customer ID
		// const companyTransactions = await getSubscriptionsByCustomer(companyCustomerId);
		const companyTransactions = await getCompanyTransactionsService(userDeatil, res);

		// Pagination for recent users
		const page = parseInt(payload.page as string) || 1;
		const limit = parseInt(payload.limit as string) || 10;
		const skip = (page - 1) * limit;

		const recentUsers = await usersModel.find({ companyName: company.companyName, isVerifiedByCompany: "approved" }).sort({ createdAt: -1 }).skip(skip).limit(limit);

		const totalUsers = await usersModel.countDocuments({ companyName: company.companyName });

		return {
			success: true,
			message: "Company dashboard data fetched successfully",
			data: {
				transactions: companyTransactions,
				recentUsers,
				pagination: {
					totalUsers,
					page,
					limit,
				},
			},
			statusCode: httpStatusCode.OK,
		};
	} catch (error) {
		console.error("Error in getCompanyDashboardService:", error);
		return errorResponseHandler("Failed to fetch company dashboard data", httpStatusCode.INTERNAL_SERVER_ERROR, res);
	}
};

// Explicitly define the params type to include 'customer'
interface CustomBalanceTransactionListParams extends Stripe.BalanceTransactionListParams {
	customer?: string; // Add customer as an optional field
}
// export const getSubscriptionsByCustomer = async (
//   customerId: string
// ): Promise<Stripe.Subscription[]> => {
//   try {
//     // Define params for listing subscriptions
//     const subscriptionParams: Stripe.SubscriptionListParams = {
//       customer: customerId,
//       limit: 100, // Maximum limit per request
//     };

//     // Fetch initial set of subscriptions
//     const subscriptions = await stripe.subscriptions.list(subscriptionParams);
//     let allSubscriptions: Stripe.Subscription[] = subscriptions.data;

//     // Handle pagination if there are more subscriptions
//     while (subscriptions.has_more) {
//       const nextParams: Stripe.SubscriptionListParams = {
//         customer: customerId,
//         limit: 100,
//         starting_after: allSubscriptions[allSubscriptions.length - 1].id,
//       };
//       const nextSubscriptions = await stripe.subscriptions.list(nextParams);
//       allSubscriptions = [...allSubscriptions, ...nextSubscriptions.data];
//       subscriptions.has_more = nextSubscriptions.has_more;
//     }

//     return allSubscriptions;
//   } catch (error) {
//     console.error('Error fetching subscriptions:', error);
//     throw new Error('Failed to retrieve customer subscriptions');
//   }
// };

export const getSubscriptionsByCustomer = async (customerId: string) => {
	try {
		// Define params for listing subscriptions
		const subscriptionParams: Stripe.SubscriptionListParams = {
			customer: customerId,
			limit: 100, // Maximum limit per request
			expand: ["data.customer"], // Expand customer data to get email and name
		};

		// Fetch initial set of subscriptions
		const subscriptions = await stripe.subscriptions.list(subscriptionParams);
		let allSubscriptions: Stripe.Subscription[] = subscriptions.data;

		// Handle pagination if there are more subscriptions
		while (subscriptions.has_more) {
			const nextParams: Stripe.SubscriptionListParams = {
				customer: customerId,
				limit: 100,
				starting_after: allSubscriptions[allSubscriptions.length - 1].id,
				expand: ["data.customer"], // Expand customer data in paginated requests
			};
			const nextSubscriptions = await stripe.subscriptions.list(nextParams);
			allSubscriptions = [...allSubscriptions, ...nextSubscriptions.data];
			subscriptions.has_more = nextSubscriptions.has_more;
		}

		// Map subscriptions to the required details
		const subscriptionDetails: any[] = allSubscriptions.map((sub) => {
			// Extract customer data (expanded via 'data.customer')
			const customer = sub.customer as Stripe.Customer | string;
			const customerData: Stripe.Customer | {} = typeof customer === "string" ? {} : customer;

			return {
				id: sub.id,
				planName: sub.metadata.planType || "Unknown Plan",
				price: sub.items.data[0]?.plan?.amount ? sub.items.data[0].plan.amount / 100 : null,
				username: "name" in customerData && customerData.name !== null ? customerData.name : undefined,
				email: "email" in customerData && customerData.email !== null ? customerData.email : undefined,
				purchaseDate: new Date(sub.created * 1000).toISOString(),
				expiryDate: new Date(sub.current_period_end * 1000).toISOString(),
			};
		});

		return subscriptionDetails;
	} catch (error) {
		console.error("Error fetching subscriptions:", error);
		throw new Error("Failed to retrieve customer subscriptions");
	}
};

// export const updateCompanyNameService = async(req: any, res: Response) => {
// 	const { companyName } = req.body;
// 	const { id } = req.params;

// 	if (!companyName || companyName.trim() === "") {
// 		return errorResponseHandler("Company name is required", httpStatusCode.BAD_REQUEST, res);
// 	}

// 	const existingCompany = await companyModels.findById(id);
// 	if (!existingCompany) {
// 		return errorResponseHandler("Company not found", httpStatusCode.NOT_FOUND, res);
// 	}
// 	const company = await companyModels.find({companyName: companyName});
// 	if (company.length > 0) {
// 		return errorResponseHandler("Company name already exists", httpStatusCode.CONFLICT, res);
// 	}

// 	const updatedCompany = await companyModels.findByIdAndUpdate(
// 		existingCompany._id,
// 		{ companyName },
// 		{ new: true }
// 	);

// 	if (!updatedCompany) {
// 		return errorResponseHandler("Failed to update the company name", httpStatusCode.INTERNAL_SERVER_ERROR, res);
// 	}

// 	const companyData = updatedCompany.toObject() as any;
// 	delete companyData.password;

// 	return {
// 		success: true,
// 		message: "Company name updated successfully",
// 		data: companyData,
// 	};
// }

export const updateCompanyNameService = async (req: any, res: Response) => {
	const { companyName, password } = req.body;
	const { id } = req.params;
	if (password) {
		const hashedPassword = await bcrypt.hash(password, 10);
		req.body.password = hashedPassword;
	}
	// if (!companyName || companyName.trim() === "") {
	// 	return errorResponseHandler("Company name is required", httpStatusCode.BAD_REQUEST, res);
	// }

	const existingCompany = await companyModels.findById(id);
	if (!existingCompany) {
		return errorResponseHandler("Company not found", httpStatusCode.NOT_FOUND, res);
	}
	const name = companyName;
	const company = await companyModels.find({ companyName });
	// if (company.length > 0) {
	// 	return errorResponseHandler("Company name already exists", httpStatusCode.CONFLICT, res);
	// }

	const oldCompanyName = existingCompany.companyName;

	const updatedCompany = await companyModels.findByIdAndUpdate(existingCompany._id, { ...req.body }, { new: true });

	if (!updatedCompany) {
		return errorResponseHandler("Failed to update the company name", httpStatusCode.INTERNAL_SERVER_ERROR, res);
	}

	// Update all users with the old company name to the new company name
	await usersModel.updateMany({ companyName: oldCompanyName }, { $set: { companyName: name } });

	const companyData = updatedCompany.toObject() as any;
	delete companyData.password;

	return {
		success: true,
		message: "Company name updated successfully",
		data: companyData,
	};
};
export const getCompanyNameAndIDService = async (payload: any, res: Response) => {
	const { query } = queryBuilder(payload, ["companyName"]);

	const companies = await companyModels.find(query);
	const companyLists = companies.map((company) => ({
		id: company._id,
		companyName: company.companyName,
	}));

	return {
		success: true,
		message: "Company list retrived successfully",
		data: companyLists,
	};
};

export const deleteMultipleCompanyService = async (companies: string[], res: Response) => {
  if (companies === undefined || companies.length === 0) return errorResponseHandler("Bad Request", httpStatusCode.BAD_REQUEST, res);
  const deletedCompanies: string[] = [];
  const notFoundCompanies: string[] = [];

  for (const id of companies) {
	const company = await companyModels.findById(id);

	if (!company) {
	  notFoundCompanies.push(id);
	  continue;
	}
	const deletedUsers = await usersModel.deleteMany({ companyName: company.companyName });
	await companyModels.findByIdAndDelete(id);
	deletedCompanies.push(id);
  }

  return {
	success: true,
	message: "Company deletion process completed",
	deletedCompanies,
	notFoundCompanies,
  };
};
