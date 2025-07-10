import { Request, Response } from "express";
import mongoose from "mongoose";
import { httpStatusCode } from "src/lib/constant";
import { errorParser } from "src/lib/errors/error-response-handler";
import {  getUserAudioHistoryService, removeDownloadUrlService, UserAudioHistoryService } from "src/services/useraudiohistory/useraudiohistory-service";


// export const UserAudioHistory = async (req: Request, res: Response) => {
//   try {
//     const response = await UserAudioHistoryService(req, res);
//     return res.status(httpStatusCode.CREATED).json(response)
//   } catch (error: any) {
//     const { code, message } = errorParser(error);
//     return res.status(code || httpStatusCode.INTERNAL_SERVER_ERROR).json({
//       success: false,
//       message: message || "An error occurred while creating the company",
//     });
//   }
// };


export const UserAudioHistory = async (req: Request, res: Response) => {
  const session = await mongoose.startSession();

  try {
      let response;

      await session.withTransaction(async () => {
          // Call the service within the transaction
          response = await UserAudioHistoryService(req, session);
          
          return res.status(httpStatusCode.CREATED).json(response);
      });

      return response; // This won't be reached due to the return in the transaction

  } catch (error: any) {
      const { code, message } = errorParser(error);
      return res.status(code || httpStatusCode.INTERNAL_SERVER_ERROR).json({
          success: false,
          message: message || "An error occurred while recording audio history",
      });
  } finally {
      await session.endSession();
  }
};


export const getUserAudioHistory = async (req: Request, res: Response) => {
  try {
    const response = await getUserAudioHistoryService(req, res);
    return res.status(httpStatusCode.OK).json(response)
  } catch (error: any) {
    const { code, message } = errorParser(error);
    return res.status(code || httpStatusCode.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: message || "An error occurred while creating the company",
    });
  }
};
export const removeDownloadUrl = async (req: Request, res: Response) => {
  try {
    const response = await removeDownloadUrlService(req, res);
    return res.status(httpStatusCode.OK).json(response)
  } catch (error: any) {
    const { code, message } = errorParser(error);
    return res.status(code || httpStatusCode.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: message || "An error occurred while creating the company",
    });
  }
};

