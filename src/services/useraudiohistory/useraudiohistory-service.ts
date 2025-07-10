import { Request, Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import mongoose from "mongoose";
import { httpStatusCode } from "src/lib/constant";
import { errorResponseHandler } from "src/lib/errors/error-response-handler";
import { usersModel } from "src/models/user/user-schema";
import { userAudioHistoryModel } from "src/models/useraudiohistory/user-audio-history";

// export const UserAudioHistoryService = async(req: Request, res: Response) =>{
//     const { user_id, audio_id, type } = req.body;

//         // Validate input
//         if (!user_id || !audio_id || !type) {
//             return res.status(400).json({
//                 status: 'error',
//                 message: 'user_id, audio_id, and type are required'
//             });
//         }

//         // Validate type
//         const validTypes = ['LISTEN', 'DOWNLOAD'];
//         if (!validTypes.includes(type.toUpperCase())) {
//             return res.status(400).json({
//                 status: 'error',
//                 message: 'Invalid type. Must be "LISTEN" or "DOWNLOAD"'
//             });
//         }

//         // Prepare update based on type
//         let update = {};
//         if (type.toUpperCase() === 'LISTEN') {
//             update = {
//                 $set: { has_listened: true },
//             };
//         } else if (type.toUpperCase() === 'DOWNLOAD') {
//             update = {
//                 $set: { has_downloaded: true }
//             };
//         }

//         // Upsert: Update if exists, create if not
//         const history = await userAudioHistoryModel.findOneAndUpdate(
//             { user_id, audio_id }, // Query to find existing document
//             update, // Dynamic update based on type
//             { upsert: true, new: true } // Create if not exists, return updated doc
//         );

//         return{
//             status: 'success',
//             message: `${type.toUpperCase()} activity recorded`,
//             history_id: history._id
//         };
// }

export const UserAudioHistoryService = async (req: any, session: any) => {
  const user_id = req.user.id;
  const { audio_id, type } = req.body;

  // Validate input
  if (!user_id || !audio_id || !type) {
    throw new Error("user_id, audio_id, and type are required");
  }

  // Validate type
  const validTypes = ["LISTEN", "DOWNLOAD"];
  if (!validTypes.includes(type.toUpperCase())) {
    throw new Error('Invalid type. Must be "LISTEN" or "DOWNLOAD"');
  }

  // Prepare updates
  let historyUpdate = {};
  let userUpdate = {};

  if (type.toUpperCase() === "LISTEN") {
    historyUpdate = { $set: { has_listened: true } };
    userUpdate = { $inc: { totalMeditationListen: 1 } };
  } else if (type.toUpperCase() === "DOWNLOAD") {
    historyUpdate = {
      $set: { has_downloaded: true, downloadUrl: req.body.downloadUrl },
    };
    userUpdate = { $inc: { audioDownloaded: 1 } };
  }

  // Update userAudioHistory
  const history = await userAudioHistoryModel.findOneAndUpdate(
    { user_id, audio_id },
    historyUpdate,
    {
      upsert: true,
      new: true,
      session, // Use the session passed from controller
    }
  );

  // Update userModel
  const user = await usersModel.findOneAndUpdate({ _id: user_id }, userUpdate, {
    new: true,
    session, // Use the session passed from controller
  });

  if (!user) {
    throw new Error("User not found");
  }

  return {
    status: "success",
    message: `${type.toUpperCase()} activity recorded`,
    history_id: history._id,
  };
};

export const getUserAudioHistoryService = async (req: any,res: Response) => {
    const user = req?.user;
    console.log('user object:', user);
  
    if (!user || !user.id) {
      return {
        success: false,
        message: "User ID is required",
      };
    }
  
    // Extract the user ID from the user object
    const userId = user.id;
    console.log('extracted userId:', userId);

  // Find records that have a downloadUrl (not null)
  const downloadedAudioHistory = await userAudioHistoryModel
    .find({
      user_id: userId,
      downloadUrl: { $ne: null },
      has_downloaded: true,
    })
    .populate({
      path: "audio_id",
      populate: [
        { path: "bestFor" },
        { path: "levels" },
        {
          path: "collectionType",
          populate: [
            { path: "bestFor" },
            { path: "levels" }
          ]
        }
      ]
    })
    .sort({ updatedAt: -1 });

    if(!downloadedAudioHistory){
        errorResponseHandler("User not found", httpStatusCode.NOT_FOUND, res);  
    }

  return {
    success: true,
    count: downloadedAudioHistory.length,
    data: downloadedAudioHistory,
  };
};

export const removeDownloadUrlService = async (req: any, res: Response) => {
  const user = req?.user;
  console.log('user:', user);
  const { id } = req.params;
  console.log('audioHistoryId:', id);

  if (!user) {
    return {
      success: false,
      message: "User ID is required",
    };
  }
  const userId = user.id;

  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
   errorResponseHandler("Invalid audio history ID", httpStatusCode.BAD_REQUEST, res);
  }

  // First verify the record belongs to the user
  const audioHistoryRecord = await userAudioHistoryModel.findOne({
    _id: id,
    user_id: userId,
  });

  if (!audioHistoryRecord) {
    return {
      success: false,
      message: "Audio history record not found or does not belong to the user",
    };
  }

  // Update the record to remove the downloadUrl and set has_downloaded to false
  const updatedRecord = await userAudioHistoryModel.findByIdAndUpdate(
    id,
    {
    downloadUrl: null,
    },
    { new: true } // Return the updated document
  );

  return {
    success: true,
    message: "Download URL removed successfully",
    data: updatedRecord,
  };
};
