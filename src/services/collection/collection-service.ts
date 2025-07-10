import { Request, Response } from "express";
import { bestForModel } from "src/models/bestfor/bestfor-schema";
import { collectionModel } from "src/models/collection/collection-schema";
import { levelModel } from "src/models/level/level-schema";
import { errorResponseHandler } from "../../lib/errors/error-response-handler";
import { httpStatusCode } from "../../lib/constant";
import mongoose from "mongoose";
import { AudioModel } from "src/models/audio/audio-schema";
import { deleteFileFromS3 } from "src/configF/s3";
import { queryBuilder } from "src/utils";

export const createCollectionService = async (req: Request, res: Response) => {
	const { name, imageUrl, levels, bestFor, description } = req.body;

	// Validate levels - Ensure all IDs are valid ObjectIds
	if (levels && levels.length > 0) {
		if (!levels.every((id: string) => mongoose.Types.ObjectId.isValid(id))) {
			return errorResponseHandler("One or more provided level IDs are invalid", httpStatusCode.BAD_REQUEST, res);
		}

		// Check if levels exist and are active
		const existingLevels = await levelModel.find({
			_id: { $in: levels },
			isActive: true,
		});

		console.log(
			"Existing levels in DB:",
			existingLevels.map((lvl) => lvl._id)
		);

		if (existingLevels.length !== levels.length) {
			return errorResponseHandler("One or more selected levels do not exist or are inactive", httpStatusCode.BAD_REQUEST, res);
		}
	}

	// Validate bestFor - Ensure all IDs are valid ObjectIds and exist
	if (bestFor && bestFor.length > 0) {
		// Check if all bestFor IDs are valid ObjectIds
		if (!bestFor.every((id: string) => mongoose.Types.ObjectId.isValid(id))) {
			return errorResponseHandler("One or more provided 'best for' IDs are invalid", httpStatusCode.BAD_REQUEST, res);
		}

		// Check if all bestFor entries exist and are active
		const existingBestFor = await bestForModel.find({
			_id: { $in: bestFor },
			isActive: true,
		});


		if (existingBestFor.length !== bestFor.length) {
			return errorResponseHandler("One or more selected 'best for' tags do not exist or are inactive", httpStatusCode.BAD_REQUEST, res);
		}
	}

	const newCollection = new collectionModel({
		name,
		imageUrl,
		levels: levels || [],
		bestFor: bestFor || [], // Store as an array
		description,
	});

	await newCollection.save();

	// Populate the references before returning
	const populatedCollection = await collectionModel.findById(newCollection._id).populate("levels").populate("bestFor");

	return {
		success: true,
		message: "Collection created successfully",
		data: populatedCollection,
	};
};

// Get all collections

export const getAllCollectionsService = async (req: Request, res: Response) => {
	// Extract pagination parameters from query
	const page = parseInt(req.query.page as string) || 1;
	const limit = parseInt(req.query.limit as string) || 0;
	const offset = (page - 1) * limit;
	const { query, sort } = queryBuilder(req.query, ["fullName"]);
	const totalDataCount = Object.keys(query).length < 1 ? await collectionModel.countDocuments() : await collectionModel.countDocuments(query);

	// Fetch paginated collections
	const collections = await collectionModel.find(query).populate("levels").populate("bestFor").sort({ createdAt: -1 }).skip(offset).limit(limit);

	// Add audio count for each collection and filter out collections with audioCount = 0
	const collectionsWithAudioCount = await Promise.all(
		collections.map(async (collection) => {
			const audioCount = await AudioModel.countDocuments({
				collectionType: collection._id,
				isActive: true,
			});
			// Only return collection if audioCount > 0
			if (audioCount > 0) {
				return {
					...collection.toObject(),
					audioCount,
				};
			}
			return null; // Return null for collections with 0 audioCount
		})
	);

	// Filter out null values and get the valid collections
	const filteredCollections = collectionsWithAudioCount.filter((collection) => collection !== null);

	// Get total number of collections with audioCount > 0
	const totalCollections = filteredCollections.length;

	// Calculate total pages based on filtered results
	const totalPages = limit > 0 ? Math.ceil(totalDataCount / limit) : 1;

	// Return response
	return {
		success: true,
		message: "Collections fetched successfully",
		data: {
			collections: filteredCollections,
			pagination: {
				total: totalCollections,
				page,
				limit,
				totalPages,
				hasNextPage: page < totalPages,
				hasPrevPage: page > 1,
			},
		},
	};
};
export const getAllCollectionsAdminService = async (req: Request, res: Response) => {
  // Extract pagination parameters from query
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 0;
  const offset = (page - 1) * limit;
  
  // Build the query object
  let query: any = {};
  
  // Add levels filter if provided
  if (req.query.levels) {
    const levelIds = (req.query.levels as string).split(',');
    query.levels = { $in: levelIds };
  }
  
  // Add bestFor filter if provided
  if (req.query.bestFor) {
    const bestForIds = (req.query.bestFor as string).split(',');
    query.bestFor = { $in: bestForIds };
  }
  
  // Add search functionality
  if (req.query.search) {
    const searchTerm = req.query.search as string;
    query.name = { $regex: searchTerm, $options: 'i' }; // Case-insensitive search
  }
  
  // Add any other filters from queryBuilder if needed
  const { query: additionalQuery, sort } = queryBuilder(req.query, ["fullName"]);
  query = { ...query, ...additionalQuery };
  
  const totalDataCount = await collectionModel.countDocuments(query);

  // Fetch paginated collections with the updated query
  const collections = await collectionModel.find(query)
    .populate("levels")
    .populate("bestFor")
    .sort({ createdAt: -1 })
    .skip(offset)
    .limit(limit);

  // Add audio count for each collection
  const collectionsWithAudioCount = await Promise.all(
    collections.map(async (collection) => {
      const audioCount = await AudioModel.countDocuments({
        collectionType: collection._id,
        isActive: true,
      });
      
      return {
        ...collection.toObject(),
        audioCount,
      };
    })
  );

  // Calculate total pages based on filtered results
  const totalPages = limit > 0 ? Math.ceil(totalDataCount / limit) : 1;

  // Return response
  return {
    success: true,
    message: "Collections fetched successfully",
    data: {
      collections: collectionsWithAudioCount,
      pagination: {
        total: totalDataCount,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    },
  };
};

export const getCollectionByIdService = async (id: any, res: Response) => {
	if (!mongoose.Types.ObjectId.isValid(id)) {
		return errorResponseHandler("Invalid collection ID", httpStatusCode.BAD_REQUEST, res);
	}

	const collection = await collectionModel.findById(id).populate("levels").populate("bestFor");

	if (!collection) {
		return errorResponseHandler("Collection not found", httpStatusCode.NOT_FOUND, res);
	}
	return {
		success: true,
		message: "Collection fetched successfully",
		data: collection,
	};
};

export const getCollectionWithAudioService = async (req: Request, res: Response) => {
	const { id } = req.params;

	if (!mongoose.Types.ObjectId.isValid(id)) {
		return errorResponseHandler("Invalid collection ID", httpStatusCode.BAD_REQUEST, res);
	}

	// Find the collection
	const collection = await collectionModel.findById(id).populate("levels").populate("bestFor");

	if (!collection) {
		return errorResponseHandler("Collection not found", httpStatusCode.NOT_FOUND, res);
	}

	// Find all audio files associated with this collection
	const audioFiles = await AudioModel.find({
		collectionType: id,
	})
		.populate("levels")
		.populate("bestFor")
		.sort({ createdAt: -1 });

	// Create response object with collection and its audio files
	const response = {
		collection,
		audioFiles,
	};

	return {
		success: true,
		message: "Collection with audio files fetched successfully",
		data: response,
	};
};

export const updateCollectionService = async (req: Request, res: Response) => {
	const { id } = req.params;
	const { name, imageUrl, levels, bestFor, description } = req.body;

	// Validate all fields are provided
	if (!name || !imageUrl || !description || !levels || !bestFor) {
		return errorResponseHandler(
			"All fields (name, imageUrl, levels, bestFor, description) are required",
			httpStatusCode.BAD_REQUEST, // Changed to BAD_REQUEST for missing fields
			res
		);
	}

	// Validate collection ID
	if (!mongoose.Types.ObjectId.isValid(id)) {
		return errorResponseHandler("Invalid collection ID", httpStatusCode.BAD_REQUEST, res);
	}

	// Validate levels
	if (!Array.isArray(levels) || levels.length === 0) {
		return errorResponseHandler("Levels must be a non-empty array", httpStatusCode.BAD_REQUEST, res);
	}

	if (!levels.every((levelId: string) => mongoose.Types.ObjectId.isValid(levelId))) {
		return errorResponseHandler("One or more provided level IDs are invalid", httpStatusCode.BAD_REQUEST, res);
	}

	const existingLevels = await levelModel.find({
		_id: { $in: levels },
		isActive: true,
	});

	if (existingLevels.length !== levels.length) {
		return errorResponseHandler("One or more selected levels do not exist or are inactive", httpStatusCode.BAD_REQUEST, res);
	}

	// Validate bestFor
	if (!Array.isArray(bestFor) || bestFor.length === 0) {
		return errorResponseHandler("BestFor must be a non-empty array", httpStatusCode.BAD_REQUEST, res);
	}

	if (!bestFor.every((bestForId: string) => mongoose.Types.ObjectId.isValid(bestForId))) {
		return errorResponseHandler("One or more provided 'best for' IDs are invalid", httpStatusCode.BAD_REQUEST, res);
	}

	const existingBestFor = await bestForModel.find({
		_id: { $in: bestFor },
		isActive: true,
	});

	if (existingBestFor.length !== bestFor.length) {
		return errorResponseHandler("One or more selected 'best for' tags do not exist or are inactive", httpStatusCode.BAD_REQUEST, res);
	}

	// Prepare update object
	const updateData = {
		name,
		imageUrl,
		levels,
		bestFor,
		description,
	};

	// Update the collection using findByIdAndUpdate
	const updatedCollection = await collectionModel
		.findByIdAndUpdate(
			id,
			{ $set: updateData },
			{ new: true, runValidators: true } // new: true returns the updated document, runValidators ensures schema validation
		)
		.populate("levels")
		.populate("bestFor");

	if (!updatedCollection) {
		return errorResponseHandler("Collection not found", httpStatusCode.NOT_FOUND, res);
	}

	// Send response with status 200
	return {
		success: true,
		message: "Collection updated successfully",
		data: updatedCollection,
	};
};

export const deleteCollectionService = async (req: Request, res: Response) => {
	const { id } = req.params;

	if (!mongoose.Types.ObjectId.isValid(id)) {
		return errorResponseHandler("Invalid collection ID", httpStatusCode.BAD_REQUEST, res);
	}

	// Check if collection exists
	const collection = await collectionModel.findById(id);

	if (!collection) {
		return errorResponseHandler("Collection not found", httpStatusCode.NOT_FOUND, res);
	}

	// Check if there are any audio files associated with this collection
	const associatedAudios = await AudioModel.countDocuments({ collectionType: id });

	if (associatedAudios > 0) {
		return errorResponseHandler("Cannot delete collection because it has associated audio files", httpStatusCode.BAD_REQUEST, res);
	}

	if (collection.imageUrl) {
		await deleteFileFromS3(collection.imageUrl);
	}

	// Delete collection
	await collectionModel.findByIdAndDelete(id);

	return {
		success: true,
		message: "Collection deleted successfully",
		data: null,
	};
};

export const getFilteredCollectionsService = async (req: Request, res: Response) => {
	const { bestFor, levels } = req.query;

	// Build filter based on query params
	const filter: any = {};
	if (bestFor) filter.bestFor = { $in: (bestFor as string).split(",") };
	if (levels) filter.levels = { $in: (levels as string).split(",") };

	// Validate ObjectIds in filter
	if (filter.bestFor && !filter.bestFor.$in.every((id: string) => mongoose.Types.ObjectId.isValid(id))) {
		return errorResponseHandler("One or more provided bestFor IDs are invalid", httpStatusCode.BAD_REQUEST, res);
	}
	if (filter.levels && !filter.levels.$in.every((id: string) => mongoose.Types.ObjectId.isValid(id))) {
		return errorResponseHandler("One or more provided level IDs are invalid", httpStatusCode.BAD_REQUEST, res);
	}

	const collections = await collectionModel.find(filter).populate("levels").populate("bestFor").sort({ createdAt: -1 });

	return {
		success: true,
		message: "Filtered collections fetched successfully",
		count: collections.length,
		data: collections,
	};
};

export const searchCollectionsService = async (req: any, res: Response) => {
	// Extract query parameters
	const { name, levels, bestFor } = req.query;

	// Initialize query with base filter for active collections
	let query: any = { isActive: true };

	// Handle songName parameter
	if (name) {
		query.name = { $regex: name, $options: "i" };
	}

	// Handle levels parameter
	if (levels) {
		const levelNames = levels.split(",").map((name: string) => name.trim());
		const levelDocs = await levelModel.find({
			name: { $in: levelNames },
			isActive: true,
		});
		const levelIds = levelDocs.map((doc) => doc._id);
		if (levelIds.length > 0) {
			query.levels = { $in: levelIds };
		} else {
			query._id = null; // No matching levels, return no results
		}
	}

	// Handle bestFor parameter (supports multiple values)
	if (bestFor) {
		const bestForNames = bestFor.split(",").map((name: string) => name.trim());
		const bestForDocs = await bestForModel.find({
			name: { $in: bestForNames },
			isActive: true,
		});
		const bestForIds = bestForDocs.map((doc) => doc._id);
		if (bestForIds.length > 0) {
			query.bestFor = { $in: bestForIds };
		} else {
			query._id = null; // No matching bestFor, return no results
		}
	}

	// Execute query and populate referenced fields
	const collections = await collectionModel.find(query).populate("levels").populate("bestFor");

	// Add audio count for each collection
	const collectionsWithAudioCount = await Promise.all(
		collections.map(async (collection) => {
			const audioCount = await AudioModel.countDocuments({
				collectionType: collection._id,
				isActive: true,
			});
			return {
				...collection.toObject(), // Convert Mongoose document to plain object
				audioCount,
			};
		})
	);

	// Return the results
	return {
		success: true,
		message: "Collections fetched successfully",
		data: collectionsWithAudioCount,
	};
};
