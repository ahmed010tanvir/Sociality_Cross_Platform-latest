/**
 * Hook for handling image previews
 */
import { useState } from "react";
import useShowToast from "../useShowToast";

const usePreviewImg = () => {
  const [imgUrl, setImgUrl] = useState(null);
  const showToast = useShowToast();

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      showToast("Error", "File size must be less than 5MB", "error");
      setImgUrl(null);
      return;
    }

    // Check file type
    if (!file.type.startsWith("image/")) {
      showToast("Error", "File must be an image", "error");
      setImgUrl(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setImgUrl(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  return { imgUrl, setImgUrl, handleImageChange };
};

export default usePreviewImg;
