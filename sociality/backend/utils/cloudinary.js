import { v2 as cloudinary } from "cloudinary";
import logger from "./logger.js";

const uploadImage = async (imageData) => {
	try {
		const uploadedResponse = await cloudinary.uploader.upload(imageData);
		return uploadedResponse.secure_url;
	} catch (error) {
		logger.error("Error uploading image to Cloudinary", error);
		throw new Error("Image upload failed"); // Re-throw to be handled by calling function
	}
};

const deleteImage = async (imageUrl) => {
	try {
		const imgId = imageUrl.split("/").pop().split(".")[0];
		await cloudinary.uploader.destroy(imgId);
	} catch (error) {
		logger.error("Error deleting image from Cloudinary", error);
		// Decide whether to re-throw or just log based on desired behavior
		// For now, just log and continue
	}
};

const deleteImages = async (imageUrls) => {
	if (!imageUrls || imageUrls.length === 0) {
		return;
	}
	for (const imageUrl of imageUrls) {
		await deleteImage(imageUrl); // Use the single delete function
	}
};

export { uploadImage, deleteImage, deleteImages };
