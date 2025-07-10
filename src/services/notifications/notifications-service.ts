import { Response } from "express";
import { httpStatusCode } from "src/lib/constant";
import { errorResponseHandler } from "src/lib/errors/error-response-handler";
import { adminModel } from "src/models/admin/admin-schema";
import { companyModels } from "src/models/company/company-schema";
import { notificationsModel } from "src/models/notifications/notification-schema";
// import { NotificationPayload, sendNotification } from "src/utils/FCM/FCM";

export const sendNotificationToUsersService = async (payload: any, res: Response) => {
    try {
        const users = await companyModels.find().select('fcmToken');
        if (!users.length) return errorResponseHandler("No users found", httpStatusCode.NO_CONTENT, res);

        const notifications = users.map(user => ({
            userIds: user._id,
            title: payload.title,
            description: payload.description,
            type: payload.type
        }));

        // Save notifications to database
        await notificationsModel.insertMany(notifications);

        return { success: true, message: "Notification sent successfully to all users" };
    } catch (error) {
        console.error('Error in sendNotificationToUsersService:', error);
        throw error;
    }
};

// export const sendNotificationToUsersService = async (payload: any, res: Response) => {
//     try {
//         const users = await companyModels.find().select('_id');
//         if (!users.length) return errorResponseHandler("No users found", httpStatusCode.NO_CONTENT, res);

//         const userIds = users.map(user => user._id);

//         const notification = {
//             userIds: userIds, // Array of user IDs
//             title: payload.title,
//             description: payload.description,
//         };

//         // Save a single notification document to the database
//         await notificationsModel.create(notification);

//         return { success: true, message: "Notification sent successfully to all users" };
//     } catch (error) {
//         console.error('Error in sendNotificationToUsersService:', error);
//         throw error;
//     }
// };

// export const sendNotificationToUserService = async (payload: any, res: Response) => {
//     try {
//         const { title, description, userIds } = payload;
//         if (!userIds || !userIds.length) {
//             return errorResponseHandler("User IDs are required", httpStatusCode.BAD_REQUEST, res);
//         }

//         const users = await companyModels.find({ _id: { $in: userIds } });
//         if (!users.length) return errorResponseHandler("No users found", httpStatusCode.NO_CONTENT, res);

//         const notification = {
//             userIds: users.map(user => user._id), // Array of user IDs
//             title,
//             description,
//         };

//         // Save a single notification document to the database
//         await notificationsModel.create(notification);

//         return { success: true, message: "Notification sent successfully" };
//     } catch (error) {
//         console.error('Error in sendNotificationToUserService:', error);
//         throw error;
//     }
// };

export const sendNotificationToUserService = async (payload: any, res: Response) => {
    try {
        const { title, description, userIds, type } = payload;
        if (!userIds) {
            return errorResponseHandler("User IDs are required", httpStatusCode.BAD_REQUEST, res);
        }

        const users = await companyModels.find({ _id: { $in: userIds } });
        if (!users.length) return errorResponseHandler("No users found", httpStatusCode.NO_CONTENT, res);

        const notifications = users.map(user => ({
            userIds: user._id,
            title,
            type,
            description
        }));

        // Save notifications to database
        await notificationsModel.insertMany(notifications);

        // Send FCM notifications to specific users
        // const fcmPromises = users.map(user => {
        //     if (user.fcmToken) {
        //         return sendNotification(user.fcmToken, title, description);
        //     }
        //     return Promise.resolve();
        // });

        // await Promise.all(fcmPromises);

        return { success: true, message: "Notification sent successfully" };
    } catch (error) {
        console.error('Error in sendNotificationToUserService:', error);
        throw error;
    }
};

export const getAllNotificationsOfUserService = async (id: string, res: Response) => {
    try {
        const user = await companyModels.findById(id);
        if (!user) return errorResponseHandler("User not found", httpStatusCode.NOT_FOUND, res);

        const results = await notificationsModel
        .find({ userIds: id })
        .sort({ createdAt: -1 })
        .select("-__v -userId");
        
        return { success: true, message: "Notifications fetched successfully", data: results };
    } catch (error) {
        console.error('Error in getAllNotificationsOfUserService:', error);
        throw error;
    }
};
export const getAllNotificationsOfCompanyService = async (id: string, res: Response) => {
    try {
        const user = await adminModel.findById(id);
        if (!user) return errorResponseHandler("User not found", httpStatusCode.NOT_FOUND, res);

        const results = await notificationsModel
            .find({ userIds: id })
            .sort({ createdAt: -1 })
            .select("-__v -userId");

        return { success: true, message: "Notifications fetched successfully", data: results };
    } catch (error) {
        console.error('Error in getAllNotificationsOfUserService:', error);
        throw error;
    }
};

// export const markAllNotificationsAsReadService = async (id: string, res: Response) => {

//     try {
//         //TODO : change this to user id from token
//         const user = await companyModels.findById(id);
//         if (!user) return errorResponseHandler("User not found", httpStatusCode.NOT_FOUND, res);
//         const notifications = await notificationsModel
//         .find({ userIds: {$in:[id]}, read: false })
//         .select("-__v -userIds");

//         if (!notifications.length) {
//             return errorResponseHandler("No notifications found", httpStatusCode.NO_CONTENT, res);
//         }

//         await notificationsModel.updateMany(
//             { userIds: {$in:[id]}, read: false },
//             { $set: { read: true } }
//         );

//         return { success: true, message: "Notifications marked as read successfully" };
//     } catch (error) {
//         console.error('Error in markAllNotificationsAsReadService:', error);
//         throw error;
//     }
// };


export const markAllNotificationsAsReadService = async (id: string, res: Response) => {
    try {
        // Verify user exists
        const user = await companyModels.findById(id);
        if (!user) {
            return errorResponseHandler("User not found", httpStatusCode.NOT_FOUND, res);
        }

        // Find unread notifications for this user
        const notifications = await notificationsModel
        .find({ 
            userIds: { $in: [id] },  // Correct $in syntax for array field
            read: false 
        })
        .select("-__v -userIds");
        
        if (!notifications.length) {
            return errorResponseHandler("No unread notifications found", httpStatusCode.NO_CONTENT, res);
        }

        // Update all unread notifications to read
        const updateResult = await notificationsModel.updateMany(
            { 
                userIds: { $in: [id] },  // Correct $in syntax
                read: false 
            },
            { 
                $set: { read: true } 
            }
        );

        if (updateResult.modifiedCount === 0) {
            return errorResponseHandler("No notifications were updated", httpStatusCode.INTERNAL_SERVER_ERROR, res);
        }

        return { 
            success: true, 
            message: "Notifications marked as read successfully",
            modifiedCount: updateResult.modifiedCount
        };
    } catch (error) {
        console.error('Error in markAllNotificationsAsReadService:', error);
        throw error; // Let the controller handle the error response
    }
};
export const markAllNotificationsAsReadAdminService = async (id: string, res: Response) => {
    try {
        // Verify user exists
        const user = await adminModel.findById(id);
        if (!user) {
            return errorResponseHandler("User not found", httpStatusCode.NOT_FOUND, res);
        }

        // Find unread notifications for this user
        const notifications = await notificationsModel
        .find({ 
            userIds: { $in: [id] },  // Correct $in syntax for array field
            read: false 
        })
        .select("-__v -userIds");
        
        if (!notifications.length) {
            return errorResponseHandler("No unread notifications found", httpStatusCode.NO_CONTENT, res);
        }

        // Update all unread notifications to read
        const updateResult = await notificationsModel.updateMany(
            { 
                userIds: { $in: [id] },  // Correct $in syntax
                read: false 
            },
            { 
                $set: { read: true } 
            }
        );

        if (updateResult.modifiedCount === 0) {
            return errorResponseHandler("No notifications were updated", httpStatusCode.INTERNAL_SERVER_ERROR, res);
        }

        return { 
            success: true, 
            message: "Notifications marked as read successfully",
            modifiedCount: updateResult.modifiedCount
        };
    } catch (error) {
        console.error('Error in markAllNotificationsAsReadService:', error);
        throw error; // Let the controller handle the error response
    }
};
export const markSingleNotificationAsReadService = async (id: string,payload: any, res: Response) => {
    try {
        //TODO : change this to user id from token
        const user = await companyModels.findById(id);
        if (!user) return errorResponseHandler("User not found", httpStatusCode.NOT_FOUND, res);
        const notifications = await notificationsModel
        .find({ userIds: id,_id:payload.id, read: false })
        .select("-__v -userIds");

        if (!notifications.length) {
            return errorResponseHandler("No notifications found", httpStatusCode.NO_CONTENT, res);
        }

        await notificationsModel.updateMany(
            { userIds: id, read: false },
            { $set: { read: true } }
        );

        return { success: true, message: "Notifications marked as read successfully" };
    } catch (error) {
        console.error('Error in markAllNotificationsAsReadService:', error);
        throw error;
    }
};