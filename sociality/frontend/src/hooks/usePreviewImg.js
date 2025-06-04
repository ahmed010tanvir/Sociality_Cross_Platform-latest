import { useState } from "react";
import useShowToast from "./useShowToast";

const usePreviewImg = () => {
	const [imgUrls, setImgUrls] = useState([]);
	const [imgUrl, setImgUrl] = useState(null); // Keep for backward compatibility
	const showToast = useShowToast();

	const handleImageChange = (e) => {
		const files = e.target.files;

		if (files.length === 0) return;

		// Check if we already have images
		const existingImages = [...imgUrls];
		const isAddingMoreImages = existingImages.length > 0;

		// For single file selection when no existing images
		if (files.length === 1 && !isAddingMoreImages) {
			const file = files[0];
			if (file && file.type.startsWith("image/")) {
				const reader = new FileReader();

				reader.onloadend = () => {
					setImgUrl(reader.result);
					setImgUrls([reader.result]); // Also update the array
				};

				reader.readAsDataURL(file);
			} else {
				showToast("Invalid file type", "Please select image files", "error");
				setImgUrl(null);
				setImgUrls([]);
			}
			return;
		}

		// For multiple files or adding to existing images
		const newImgUrls = [...existingImages]; // Start with existing images if any
		let validFiles = 0;
		let processedFiles = 0;

		// Count valid files first
		for (let i = 0; i < files.length; i++) {
			if (files[i].type.startsWith("image/")) {
				validFiles++;
			}
		}

		if (validFiles === 0) {
			showToast("Invalid file type", "Please select image files", "error");
			return;
		}

		// Process each file
		for (let i = 0; i < files.length; i++) {
			const file = files[i];

			if (file.type.startsWith("image/")) {
				const reader = new FileReader();

				reader.onloadend = () => {
					newImgUrls.push(reader.result);
					processedFiles++;

					// When all files are processed, update state
					if (processedFiles === validFiles) {
						setImgUrls(newImgUrls);

						// Only update imgUrl if we didn't have images before
						if (!isAddingMoreImages) {
							setImgUrl(newImgUrls[0]); // Set first image as imgUrl for backward compatibility
						}
					}
				};

				reader.readAsDataURL(file);
			} else {
				processedFiles++;
			}
		}
	};

	// Function to remove an image by index
	const removeImage = (index) => {
		const newImgUrls = [...imgUrls];
		newImgUrls.splice(index, 1);
		setImgUrls(newImgUrls);

		// Update imgUrl for backward compatibility
		if (newImgUrls.length > 0) {
			setImgUrl(newImgUrls[0]);
		} else {
			setImgUrl(null);
		}
	};

	// Function to clear all images
	const clearImages = () => {
		setImgUrls([]);
		setImgUrl(null);
	};

	return {
		handleImageChange,
		imgUrl,
		setImgUrl,
		imgUrls,
		setImgUrls,
		removeImage,
		clearImages
	};
};

export default usePreviewImg;
