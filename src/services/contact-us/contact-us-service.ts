import { Response, Request } from "express";
import { httpStatusCode } from "src/lib/constant";
import { errorResponseHandler } from "src/lib/errors/error-response-handler";
import { contactUsModel } from "src/models/contact-us/contact-us-schema";
import { faqsModel } from "src/models/FAQs/FAQs-schema";
import { contactUsMail } from "src/utils/mails/mail";

// Create FAQ
export const createContactUsService = async (payload: any, res: Response) => {
	try {
		const contactUs = await contactUsModel.create(payload);
		const email = await contactUsMail(payload,payload.email);
        console.log('email: ', email);
		return { success: true, message: "Contact request is sent", data: contactUs };
	} catch (error) {
		console.error("Error in createFAQService:", error);
		throw error;
	}
};

// Get All FAQs
export const getAllContactUsService = async (res: Response) => {
	try {
		const faqs = await faqsModel.find().sort({ createdAt: -1 });
		return { success: true, message: "FAQs fetched successfully", data: faqs };
	} catch (error) {
		console.error("Error in getAllFAQsService:", error);
		throw error;
	}
};

// Get Single FAQ
// export const getContactUsService = async (res: Response,page: number = 1,limit: number = 10) => {
//    // Convert page and limit to integers and ensure they are positive
//    const currentPage = Math.max(1, parseInt(page.toString(), 10));
//    const itemsPerPage = Math.max(1, parseInt(limit.toString(), 10));

//    // Calculate skip value for pagination
//    const skip = (currentPage - 1) * itemsPerPage;

//    // Fetch FAQs with pagination
//    const faqs = await faqsModel
//      .find()
//      .skip(skip)
//      .limit(itemsPerPage)
//      .sort({createdAt : -1})
//      .exec();

//    // If no FAQs are found, return an error response
//    if (!faqs || faqs.length === 0) {
//      return errorResponseHandler("FAQ not found", httpStatusCode.NOT_FOUND, res);
//    }

//    // Get total count of FAQs for pagination metadata
//    const totalItems = await faqsModel.countDocuments();

//    // Calculate total pages
//    const totalPages = Math.ceil(totalItems / itemsPerPage);

//    // Return success response with pagination metadata
//    return {
//      success: true,
//      message: "FAQs fetched successfully",
//      data: faqs,
//      pagination: {
//        currentPage,
//        totalPages,
//        totalItems,
//        limit: itemsPerPage,
//      },
//    };
// };

export const getContactUsByIdService = async (id: string, res: Response) => {
	try {
		const faq = await faqsModel.findById(id);
		if (!faq) return errorResponseHandler("FAQ not found", httpStatusCode.NOT_FOUND, res);
		return { success: true, message: "FAQ fetched successfully", data: faq };
	} catch (error) {
		console.error("Error in getFAQByIdService:", error);
		throw error;
	}
};

// Update FAQ
// export const updateFAQService = async (id: string, payload: any, res: Response) => {
//     try {
//         const faq = await faqsModel.findByIdAndUpdate(id, payload, { new: true });
//         if (!faq) return errorResponseHandler("FAQ not found", httpStatusCode.NOT_FOUND, res);
//         return { success: true, message: "FAQ updated successfully", data: faq };
//     } catch (error) {
//         console.error('Error in updateFAQService:', error);
//         throw error;
//     }
// };

// Delete FAQ
// export const deleteFAQService = async (id: string, res: Response) => {
//     try {
//         const faq = await faqsModel.findByIdAndDelete(id);
//         if (!faq) return errorResponseHandler("FAQ not found", httpStatusCode.NOT_FOUND, res);
//         return { success: true, message: "FAQ deleted successfully" };
//     } catch (error) {
//         console.error('Error in deleteFAQService:', error);
//         throw error;
//     }
// };
